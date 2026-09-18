import type { CaseStatusCode, RoleCode } from '@prisma/client';
import type { AuthenticatedUser } from '../../core/auth/auth.types';
import type { DomainEventName } from '../../core/events/domain-events';
import type { TxClient } from '../../core/prisma/prisma.service';

/** El caso tal y como lo ve el motor: lo mínimo para decidir, nada más. */
export interface WorkflowCase {
  id: string;
  code: string;
  companyId: string;
  status: CaseStatusCode;
  title: string;
  complexityCode: string | null;
  interventionTypeCode: string | null;
}

/**
 * Ámbito del actor sobre el recurso, además del rol.
 *
 * Distinguirlo del rol es lo que impide que "un consultor" mueva el caso de otro
 * consultor, o que "un cliente" acepte la propuesta de otra empresa.
 */
export type ActorScope = 'ANY' | 'LEAD_CONSULTANT' | 'CLIENT_OWNER' | 'SYSTEM';

export interface GuardContext {
  tx: TxClient;
  case: WorkflowCase;
  payload: Record<string, unknown>;
  note?: string;
  user: AuthenticatedUser | null;
}

/**
 * Precondición de negocio de una transición.
 *
 * Un guard hace **una** comprobación y lanza `WorkflowGuardError` con un código
 * estable si no se cumple. Ese mismo guard se reutiliza en modo "dry run" para
 * que `GET /cases/:id` pueda decir qué falta sin ejecutar nada.
 */
export interface WorkflowGuard {
  readonly code: string;
  check(context: GuardContext): Promise<void>;
}

export interface EffectContext extends GuardContext {
  /** Estado al que se está transitando. */
  to: CaseStatusCode;
}

/** Datos extra que un efecto quiere añadir al evento de dominio resultante. */
export type EffectResult = Record<string, unknown> | void;

export interface TransitionDefinition {
  code: string;
  label: string;
  from: CaseStatusCode;
  to: CaseStatusCode;
  /** Roles autorizados. Vacío + `scope: 'SYSTEM'` = sólo transición automática. */
  roles: RoleCode[];
  scope: ActorScope;
  /** Códigos de guard, resueltos contra el registro de guards. */
  guards: string[];
  event: DomainEventName;
  /** Transición encadenada automáticamente en la misma transacción. */
  autoNext?: string;
  requiresPayload: boolean;
  /** Descripción de lo que la transición produce, para Swagger y para la UI. */
  description: string;
}
