import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { NotificationStatus } from '@prisma/client';
import type { Job } from 'bullmq';
import { MailerService } from '../../../core/mailer/mailer.service';
import { PrismaService } from '../../../core/prisma/prisma.service';
import { JOB_NAMES, QUEUE_NAMES } from '../../../core/queue/queue.constants';
import { NotificationsService, type DispatchJobData } from '../notifications.service';
import { TemplateRendererService } from '../template-renderer.service';

/**
 * Procesa los eventos encolados: resuelve destinatarios, renderiza la plantilla
 * TCOM y crea las filas `Notification`. Corre en el worker, nunca en la API.
 */
@Processor(QUEUE_NAMES.NOTIFICATIONS, { concurrency: 5 })
export class NotificationsProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationsProcessor.name);

  constructor(private readonly notifications: NotificationsService) {
    super();
  }

  async process(job: Job<DispatchJobData>): Promise<{ created: number }> {
    if (job.name !== JOB_NAMES.DISPATCH_NOTIFICATION) {
      return { created: 0 };
    }

    // BullMQ serializa a JSON: `occurredAt` vuelve como cadena.
    const event = {
      ...job.data.event,
      occurredAt: new Date(job.data.event.occurredAt),
    };

    const created = await this.notifications.materialize(event);
    this.logger.debug(`Evento ${event.name}: ${created} notificación(es) creada(s)`);
    return { created };
  }
}

/**
 * Envío efectivo de correo.
 *
 * Reintentos con backoff exponencial (configurado en `DEFAULT_JOB_OPTIONS`). El
 * estado y el último error quedan en la fila `Notification`, que es lo que exige
 * RT-013: registrar evento origen, destinatario, canal, estado, fecha y error.
 */
@Processor(QUEUE_NAMES.EMAIL, { concurrency: 3 })
export class EmailProcessor extends WorkerHost {
  private readonly logger = new Logger(EmailProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailer: MailerService,
    private readonly renderer: TemplateRendererService,
  ) {
    super();
  }

  async process(job: Job<{ notificationId: string }>): Promise<{ sent: boolean }> {
    if (job.name !== JOB_NAMES.SEND_EMAIL) return { sent: false };

    const notification = await this.prisma.notification.findUnique({
      where: { id: job.data.notificationId },
      select: {
        id: true,
        subject: true,
        body: true,
        status: true,
        attempts: true,
        caseId: true,
        recipient: { select: { email: true, fullName: true } },
      },
    });

    if (!notification) {
      this.logger.warn(`Notificación ${job.data.notificationId} no encontrada; se descarta`);
      return { sent: false };
    }

    // Idempotencia: si un reintento de BullMQ repite un job ya enviado, no se
    // envía el correo dos veces.
    if (notification.status === NotificationStatus.ENVIADA) {
      return { sent: true };
    }

    try {
      const caseUrl = notification.caseId ? `/cases/${notification.caseId}` : undefined;

      await this.mailer.send({
        to: notification.recipient.email,
        subject: notification.subject,
        text: notification.body,
        html: this.renderer.toHtml(
          notification.subject,
          notification.body,
          caseUrl ? this.renderer.render(`{{appUrl}}${caseUrl}`, {}) : undefined,
          'Abrir el caso en NODUS',
        ),
      });

      await this.prisma.notification.update({
        where: { id: notification.id },
        data: {
          status: NotificationStatus.ENVIADA,
          sentAt: new Date(),
          attempts: notification.attempts + 1,
          error: null,
        },
      });

      return { sent: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      await this.prisma.notification.update({
        where: { id: notification.id },
        data: {
          status: NotificationStatus.FALLIDA,
          attempts: notification.attempts + 1,
          error: message.slice(0, 1000),
        },
      });

      this.logger.error(`Fallo al enviar la notificación ${notification.id}: ${message}`);
      // Se relanza para que BullMQ reintente con backoff.
      throw error;
    }
  }
}
