import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import type { DomainEvent } from '../../../core/events/domain-events';
import { NotificationsService } from '../notifications.service';

/**
 * Puente entre los eventos de dominio y el módulo de notificaciones.
 *
 * Es deliberadamente tonto: recibe el evento y **encola**. No decide
 * destinatarios, no renderiza y no envía nada — eso ocurre en el worker. Así, un
 * fallo de SMTP o una plantilla mal escrita no pueden afectar a la petición que
 * ya confirmó su transacción.
 *
 * La lista de eventos es explícita, no un comodín: un evento sin notificación
 * asociada debe ser una decisión visible, no un olvido silencioso.
 */
@Injectable()
export class DomainEventNotificationHandler {
  private readonly logger = new Logger(DomainEventNotificationHandler.name);

  constructor(private readonly notifications: NotificationsService) {}

  @OnEvent('CaseCreated')
  @OnEvent('CaseReviewStarted')
  @OnEvent('CaseInformationRequested')
  @OnEvent('CaseClassified')
  @OnEvent('CasePublished')
  @OnEvent('ApplicationSubmitted')
  @OnEvent('ConsultantAssigned')
  @OnEvent('ProposalCreated')
  @OnEvent('ProposalSubmitted')
  @OnEvent('ProposalReviewed')
  @OnEvent('ProposalAdjustmentRequested')
  @OnEvent('ProposalSent')
  @OnEvent('ClientDecisionWindowOpened')
  @OnEvent('ClientDecisionReceived')
  @OnEvent('ContractingStarted')
  @OnEvent('ExecutionAuthorized')
  @OnEvent('ExecutionStarted')
  @OnEvent('ExecutionReopened')
  @OnEvent('IncidentOpened')
  @OnEvent('DeliverableUploaded')
  @OnEvent('CaseReadyForClosure')
  @OnEvent('CaseClosed')
  @OnEvent('CaseClosedWithoutContracting')
  @OnEvent('SlaAtRisk')
  @OnEvent('SlaOverdue')
  @OnEvent('SlaEscalated')
  @OnEvent('MilestoneAtRisk')
  @OnEvent('MilestoneOverdue')
  async handle(event: DomainEvent): Promise<void> {
    try {
      await this.notifications.enqueueForEvent(event);
    } catch (error) {
      // Encolar no debe romper nada: la transacción ya está confirmada y el
      // caso avanzó. Se registra para poder reprocesar si hiciera falta.
      this.logger.error(
        `No se pudo encolar la notificación del evento ${event.name} (caso ${event.caseId ?? '—'}): ` +
          (error instanceof Error ? error.message : String(error)),
      );
    }
  }
}
