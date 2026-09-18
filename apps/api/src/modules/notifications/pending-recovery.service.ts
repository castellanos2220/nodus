import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { NotificationChannel, NotificationStatus } from '@prisma/client';
import { Queue } from 'bullmq';
import { PrismaService } from '../../core/prisma/prisma.service';
import { JOB_NAMES, QUEUE_NAMES } from '../../core/queue/queue.constants';

const BATCH_SIZE = 500;

/**
 * Recuperación de notificaciones pendientes al arrancar el worker.
 *
 * Una fila `Notification` en estado `PENDIENTE` significa que se decidió
 * enviarla pero el envío no llegó a confirmarse: el worker cayó a mitad, Redis
 * se vació, o el trabajo se perdió. Sin esta recuperación, esa notificación
 * quedaría pendiente para siempre — visible en la base y nunca entregada.
 *
 * Al arrancar, el worker vuelve a encolar lo pendiente. El `jobId` derivado del
 * id de la notificación hace la operación idempotente: si el trabajo ya estaba
 * en la cola, BullMQ lo ignora en lugar de duplicarlo. (El separador es «-»:
 * BullMQ reserva los dos puntos para sus claves de Redis.)
 */
@Injectable()
export class PendingNotificationsRecovery implements OnApplicationBootstrap {
  private readonly logger = new Logger(PendingNotificationsRecovery.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(QUEUE_NAMES.EMAIL) private readonly emailQueue: Queue,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    try {
      const pending = await this.prisma.notification.findMany({
        where: {
          status: { in: [NotificationStatus.PENDIENTE, NotificationStatus.FALLIDA] },
          channel: NotificationChannel.EMAIL,
          // Se descartan las que ya agotaron sus reintentos: reencolarlas en
          // cada arranque sería un bucle sin salida.
          attempts: { lt: 5 },
        },
        orderBy: { createdAt: 'asc' },
        take: BATCH_SIZE,
        select: { id: true },
      });

      if (pending.length === 0) return;

      for (const notification of pending) {
        await this.emailQueue.add(
          JOB_NAMES.SEND_EMAIL,
          { notificationId: notification.id },
          { jobId: `email-${notification.id}` },
        );
      }

      this.logger.log(
        `Recuperadas ${pending.length} notificación(es) pendiente(s) de envío`,
      );
    } catch (error) {
      // La recuperación es best-effort: si falla, el worker debe arrancar igual.
      this.logger.warn(
        `No se pudieron recuperar las notificaciones pendientes: ` +
          (error instanceof Error ? error.message : String(error)),
      );
    }
  }
}
