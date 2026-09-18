import type { CaseStatusCode } from '@prisma/client';

/**
 * Eventos de dominio.
 *
 * Los eventos describen **hechos ocurridos**, en pasado, y no conocen a sus
 * consumidores. Ningún evento sabe que existe el correo, ni Redis, ni ningún
 * proveedor externo: eso desacopla el dominio de la infraestructura, que es
 * exactamente lo que pide el brief (§27: "Los eventos no deben acoplarse
 * directamente a proveedores externos").
 */

export interface DomainEventBase {
  /** Nombre estable del evento; también es la clave de las plantillas TCOM. */
  name: string;
  occurredAt: Date;
  /** Quién lo provocó. `null` = el sistema. */
  actorId: string | null;
  caseId?: string | null;
  companyId?: string | null;
  payload: Record<string, unknown>;
}

export type DomainEventName =
  | 'CaseCreated'
  | 'CaseReviewStarted'
  | 'CaseInformationRequested'
  | 'CaseClassified'
  | 'CasePublished'
  | 'ApplicationSubmitted'
  | 'ConsultantAssigned'
  | 'ProposalCreated'
  | 'ProposalSubmitted'
  | 'ProposalReviewed'
  | 'ProposalAdjustmentRequested'
  | 'ProposalSent'
  | 'ClientDecisionWindowOpened'
  | 'ClientDecisionReceived'
  | 'ContractingStarted'
  | 'ExecutionAuthorized'
  | 'ExecutionStarted'
  | 'ExecutionReopened'
  | 'MilestoneAtRisk'
  | 'MilestoneOverdue'
  | 'IncidentOpened'
  | 'DeliverableUploaded'
  | 'CaseReadyForClosure'
  | 'CaseClosed'
  | 'CaseClosedWithoutContracting'
  | 'SlaAtRisk'
  | 'SlaOverdue'
  | 'SlaEscalated';

export interface DomainEvent extends DomainEventBase {
  name: DomainEventName;
}

export function domainEvent(
  name: DomainEventName,
  input: {
    actorId: string | null;
    caseId?: string | null;
    companyId?: string | null;
    payload?: Record<string, unknown>;
  },
): DomainEvent {
  return {
    name,
    occurredAt: new Date(),
    actorId: input.actorId,
    caseId: input.caseId ?? null,
    companyId: input.companyId ?? null,
    payload: input.payload ?? {},
  };
}

/** Evento de transición de caso: el más frecuente del sistema. */
export function caseTransitionEvent(
  name: DomainEventName,
  input: {
    actorId: string | null;
    caseId: string;
    companyId: string;
    caseCode: string;
    from: CaseStatusCode | null;
    to: CaseStatusCode;
    transition: string;
    extra?: Record<string, unknown>;
  },
): DomainEvent {
  return domainEvent(name, {
    actorId: input.actorId,
    caseId: input.caseId,
    companyId: input.companyId,
    payload: {
      caseCode: input.caseCode,
      from: input.from,
      to: input.to,
      transition: input.transition,
      ...input.extra,
    },
  });
}
