import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { NotificationChannel, NotificationStatus } from '@prisma/client';
import { Queue } from 'bullmq';
import { paginate, type PaginatedResult, type PaginationDto } from '../../core/common/dto/pagination.dto';
import { NotFoundError } from '../../core/common/errors/domain.errors';
import type { AuthenticatedUser } from '../../core/auth/auth.types';
import type { DomainEvent } from '../../core/events/domain-events';
import { JOB_NAMES, QUEUE_NAMES } from '../../core/queue/queue.constants';
import { PrismaService } from '../../core/prisma/prisma.service';
import { RecipientResolverService, type Audience } from './recipient-resolver.service';
import { TemplateRendererService } from './template-renderer.service';

export interface DispatchJobData {
  event: DomainEvent;
}

export interface EmailJobData {
  notificationId: string;
}

/**
 * Módulo de notificaciones (§28).
 *
 * La cadena es exactamente la del brief:
 *
 *   evento de dominio → handler → RecipientResolver → plantilla TCOM → cola → email
 *
 * Nada de esto ocurre dentro del request HTTP. El handler sólo encola; el worker
 * resuelve destinatarios, renderiza, persiste la `Notification` y envía. Si el
 * SMTP está caído, BullMQ reintenta con backoff exponencial y el caso sigue su
 * curso — que es justo lo que no pasaría enviando el correo en línea.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly recipients: RecipientResolverService,
    private readonly renderer: TemplateRendererService,
    @InjectQueue(QUEUE_NAMES.NOTIFICATIONS) private readonly notificationsQueue: Queue,
    @InjectQueue(QUEUE_NAMES.EMAIL) private readonly emailQueue: Queue,
  ) {}

  /** Punto de entrada desde los handlers de eventos. Sólo encola. */
  async enqueueForEvent(event: DomainEvent): Promise<void> {
    await this.notificationsQueue.add(
      JOB_NAMES.DISPATCH_NOTIFICATION,
      { event } satisfies DispatchJobData,
      {
        // Idempotencia razonable: mismo evento, mismo caso, misma marca temporal.
        // El separador es «-» y no «:» porque BullMQ reserva los dos puntos para
        // sus propias claves de Redis y rechaza un `jobId` que los contenga.
        jobId: `${event.name}-${event.caseId ?? 'global'}-${event.occurredAt.getTime()}`,
      },
    );
  }

  /**
   * Materializa las notificaciones de un evento. Lo ejecuta el worker.
   *
   * Crea una fila `Notification` por destinatario y canal, y encola el envío de
   * correo. La fila existe **antes** del envío: así hay registro incluso si el
   * correo falla, y `status`/`error` cuentan qué pasó (RT-013).
   */
  async materialize(event: DomainEvent): Promise<number> {
    const templates = await this.prisma.notificationTemplate.findMany({
      where: { eventName: event.name, isActive: true },
    });

    if (templates.length === 0) {
      this.logger.debug(`Sin plantilla activa para el evento ${event.name}`);
      return 0;
    }

    let created = 0;

    for (const template of templates) {
      const audiences = template.audiences as Audience[];
      const recipients = await this.recipients.resolve(audiences, event.caseId ?? null);

      if (recipients.length === 0) {
        this.logger.debug(`Plantilla ${template.code}: sin destinatarios para ${event.name}`);
        continue;
      }

      for (const recipient of recipients) {
        const variables = {
          ...event.payload,
          recipientName: recipient.fullName,
          recipientEmail: recipient.email,
          eventName: event.name,
          caseUrl: event.caseId ? `{{appUrl}}/cases/${event.caseId}` : undefined,
        };

        const subject = this.renderer.render(template.subjectTemplate, variables).slice(0, 300);
        const body = this.renderer.render(template.bodyTemplate, variables);

        const notification = await this.prisma.notification.create({
          data: {
            templateId: template.id,
            recipientId: recipient.userId,
            caseId: event.caseId ?? null,
            eventName: event.name,
            channel: template.channel,
            status: NotificationStatus.PENDIENTE,
            subject,
            body,
          },
          select: { id: true, channel: true },
        });
        created += 1;

        if (notification.channel === NotificationChannel.EMAIL) {
          await this.emailQueue.add(
            JOB_NAMES.SEND_EMAIL,
            { notificationId: notification.id } satisfies EmailJobData,
            { jobId: `email-${notification.id}` },
          );
        } else {
          // Las notificaciones in-app no requieren envío: nacen entregadas.
          await this.prisma.notification.update({
            where: { id: notification.id },
            data: { status: NotificationStatus.ENVIADA, sentAt: new Date() },
          });
        }
      }
    }

    return created;
  }

  // ------------------------------------------------------------- consulta ----

  async findForUser(
    user: AuthenticatedUser,
    query: PaginationDto,
    unreadOnly = false,
  ): Promise<PaginatedResult<NotificationView>> {
    const where = {
      recipientId: user.id,
      ...(unreadOnly ? { readAt: null } : {}),
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: query.skip,
        take: query.take,
        select: {
          id: true,
          eventName: true,
          channel: true,
          status: true,
          subject: true,
          body: true,
          createdAt: true,
          sentAt: true,
          readAt: true,
          error: true,
          caseId: true,
          case: { select: { code: true, title: true } },
          template: { select: { code: true } },
        },
      }),
      this.prisma.notification.count({ where }),
    ]);

    return paginate(
      rows.map((row) => ({
        id: row.id,
        templateCode: row.template?.code ?? null,
        eventName: row.eventName,
        channel: row.channel,
        status: row.status,
        subject: row.subject,
        body: row.body,
        caseId: row.caseId,
        caseCode: row.case?.code ?? null,
        caseTitle: row.case?.title ?? null,
        createdAt: row.createdAt,
        sentAt: row.sentAt,
        readAt: row.readAt,
        error: row.error,
      })),
      total,
      query,
    );
  }

  async unreadCount(user: AuthenticatedUser): Promise<{ unread: number }> {
    const unread = await this.prisma.notification.count({
      where: { recipientId: user.id, readAt: null },
    });
    return { unread };
  }

  async markRead(user: AuthenticatedUser, notificationId: string) {
    const notification = await this.prisma.notification.findFirst({
      where: { id: notificationId, recipientId: user.id },
      select: { id: true, readAt: true },
    });
    if (!notification) throw new NotFoundError('la notificación', notificationId);

    if (notification.readAt) return notification;

    return this.prisma.notification.update({
      where: { id: notificationId },
      data: { readAt: new Date(), status: NotificationStatus.LEIDA },
      select: { id: true, readAt: true },
    });
  }

  async markAllRead(user: AuthenticatedUser): Promise<{ updated: number }> {
    const result = await this.prisma.notification.updateMany({
      where: { recipientId: user.id, readAt: null },
      data: { readAt: new Date(), status: NotificationStatus.LEIDA },
    });
    return { updated: result.count };
  }

  /** Plantillas TCOM configuradas, para administración. */
  async listTemplates() {
    return this.prisma.notificationTemplate.findMany({
      orderBy: { code: 'asc' },
      select: {
        id: true,
        code: true,
        name: true,
        eventName: true,
        audiences: true,
        subjectTemplate: true,
        bodyTemplate: true,
        channel: true,
        isActive: true,
        _count: { select: { notifications: true } },
      },
    });
  }
}

export interface NotificationView {
  id: string;
  templateCode: string | null;
  eventName: string;
  channel: NotificationChannel;
  status: NotificationStatus;
  subject: string;
  body: string;
  caseId: string | null;
  caseCode: string | null;
  caseTitle: string | null;
  createdAt: Date;
  sentAt: Date | null;
  readAt: Date | null;
  error: string | null;
}
