import { BullModule } from '@nestjs/bullmq';
import { Module, type Provider } from '@nestjs/common';
import { QUEUE_NAMES } from '../../core/queue/queue.constants';
import { SlaController } from './sla.controller';
import { SlaProcessor, SlaScheduler } from './sla.processor';
import { SlaService } from './sla.service';

/**
 * El procesador y el programador de barridos viven **sólo en el worker**.
 *
 * Misma razón que en notificaciones: `@Processor` arranca un consumidor de
 * BullMQ al instanciarse. Si la API lo registrara, competiría por los barridos
 * periódicos; y si lo registrara un proceso efímero como el seed, podría tomar
 * uno y morir a mitad.
 *
 * `SlaService` sí se registra siempre: la API lo necesita para abrir y cerrar
 * relojes en cada transición, y para el endpoint de evaluación manual.
 */
const isWorker = process.env.WORKER_MODE === 'true';

const workerOnlyProviders: Provider[] = isWorker ? [SlaScheduler, SlaProcessor] : [];

@Module({
  imports: [BullModule.registerQueue({ name: QUEUE_NAMES.SLA })],
  controllers: [SlaController],
  providers: [SlaService, ...workerOnlyProviders],
  exports: [SlaService],
})
export class SlaModule {}
