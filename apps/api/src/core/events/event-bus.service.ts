import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { DomainEvent } from './domain-events';

/**
 * Bus de eventos de dominio.
 *
 * Regla que este servicio existe para hacer cumplir: **un evento se publica
 * después del commit, nunca dentro de la transacción**. Publicar dentro
 * significaría que un correo puede salir por un cambio que luego hace rollback —
 * y ese correo no se puede deshacer.
 *
 * El patrón de uso es:
 *
 * ```ts
 * const collector = eventBus.collector();
 * await prisma.$transaction(async (tx) => {
 *   ...
 *   collector.add(domainEvent('CaseClassified', {...}));
 * });
 * await collector.flush();   // ← sólo aquí salen
 * ```
 */
@Injectable()
export class EventBusService {
  private readonly logger = new Logger(EventBusService.name);

  constructor(private readonly emitter: EventEmitter2) {}

  /** Publica inmediatamente. Usar sólo fuera de transacción. */
  async publish(event: DomainEvent): Promise<void> {
    this.logger.debug(`Evento ${event.name} (caso ${event.caseId ?? '—'})`);
    // `emitAsync` espera a los handlers; un fallo en un handler no debe tumbar
    // la petición que ya confirmó su cambio, así que se captura y se registra.
    const results = await this.emitter.emitAsync(event.name, event);
    for (const result of results) {
      if (result instanceof Error) {
        this.logger.error(`Handler de ${event.name} falló: ${result.message}`, result.stack);
      }
    }
  }

  /** Crea un recolector para publicar tras confirmar la transacción. */
  collector(): EventCollector {
    return new EventCollector(this);
  }
}

export class EventCollector {
  private readonly events: DomainEvent[] = [];

  constructor(private readonly bus: EventBusService) {}

  add(...events: DomainEvent[]): void {
    this.events.push(...events);
  }

  get size(): number {
    return this.events.length;
  }

  /** Publica en orden todo lo acumulado y vacía el recolector. */
  async flush(): Promise<void> {
    const pending = this.events.splice(0, this.events.length);
    for (const event of pending) {
      await this.bus.publish(event);
    }
  }
}
