import { BullModule } from '@nestjs/bullmq';
import { Module, type Provider } from '@nestjs/common';
import { QUEUE_NAMES } from '../../core/queue/queue.constants';
import { DomainEventNotificationHandler } from './handlers/domain-event.handler';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { PendingNotificationsRecovery } from './pending-recovery.service';
import { EmailProcessor, NotificationsProcessor } from './processors/notifications.processor';
import { RecipientResolverService } from './recipient-resolver.service';
import { TemplateRendererService } from './template-renderer.service';

/**
 * Los procesadores se registran **sólo en el proceso worker**.
 *
 * Es una corrección importante y no evidente: `@Processor` arranca un consumidor
 * de BullMQ en cuanto el módulo se instancia. Registrarlo siempre significa que
 * la API —y cualquier proceso que levante `AppModule`, incluido el seed— compite
 * con el worker por los mismos trabajos. Un proceso efímero como el seed puede
 * tomar un trabajo y morir antes de terminarlo, y ese correo no se envía nunca.
 *
 * Con este reparto, la API **produce** y el worker **consume**. Es la separación
 * que justifica que el worker exista.
 */
const isWorker = process.env.WORKER_MODE === 'true';

const workerOnlyProviders: Provider[] = isWorker
  ? [NotificationsProcessor, EmailProcessor, PendingNotificationsRecovery]
  : [];

@Module({
  imports: [
    BullModule.registerQueue({ name: QUEUE_NAMES.NOTIFICATIONS }, { name: QUEUE_NAMES.EMAIL }),
  ],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    RecipientResolverService,
    TemplateRendererService,
    DomainEventNotificationHandler,
    ...workerOnlyProviders,
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
