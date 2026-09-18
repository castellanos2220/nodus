import { Injectable } from '@nestjs/common';
import { AuditOrigin, Prisma, type RoleCode } from '@prisma/client';
import { PrismaService, type TxClient } from '../prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/auth.types';

export interface AuditEntry {
  action: string;
  entity: string;
  entityId?: string | null;
  caseId?: string | null;
  companyId?: string | null;
  previousValue?: unknown;
  newValue?: unknown;
  origin?: AuditOrigin;
  metadata?: Record<string, unknown>;
}

export interface AuditActor {
  id: string | null;
  role: RoleCode | null;
  ip?: string | null;
  userAgent?: string | null;
  requestId?: string | null;
}

/** Actor "sistema": transiciones automáticas, jobs, alertas de SLA. */
export const SYSTEM_ACTOR: AuditActor = { id: null, role: null };

export function actorFrom(
  user: AuthenticatedUser,
  request?: { ip?: string; headers?: Record<string, unknown> },
): AuditActor {
  return {
    id: user.id,
    role: user.role,
    ip: request?.ip ?? null,
    userAgent: (request?.headers?.['user-agent'] as string | undefined) ?? null,
    requestId: (request?.headers?.['x-request-id'] as string | undefined) ?? null,
  };
}

/**
 * Bitácora de auditoría (RT-001 .. RT-005).
 *
 * Regla de oro: **se escribe dentro de la misma transacción que el cambio que
 * describe**. Por eso el método principal exige un `TxClient`. Si la operación
 * de negocio hace rollback, su registro de auditoría desaparece con ella; y si
 * la operación tiene éxito, es imposible que falte su rastro.
 *
 * La tabla es append-only: no hay método de actualización ni de borrado, y la
 * migración 002 instala triggers que rechazan UPDATE/DELETE a nivel de motor.
 */
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  /** Registra dentro de una transacción en curso. Es la vía normal. */
  async record(tx: TxClient, actor: AuditActor, entry: AuditEntry): Promise<void> {
    await tx.auditLog.create({
      data: {
        actorId: actor.id,
        actorRole: actor.role,
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId ?? null,
        caseId: entry.caseId ?? null,
        companyId: entry.companyId ?? null,
        previousValue: toJson(entry.previousValue),
        newValue: toJson(entry.newValue),
        origin: entry.origin ?? (actor.id ? AuditOrigin.USER : AuditOrigin.SYSTEM),
        ip: actor.ip ?? null,
        userAgent: actor.userAgent?.slice(0, 400) ?? null,
        requestId: actor.requestId ?? null,
        metadata: toJson(entry.metadata),
      },
    });
  }

  /**
   * Registra fuera de transacción. Reservado para eventos que no acompañan a un
   * cambio transaccional (p. ej. un inicio de sesión, o una alerta emitida por
   * el worker). Nunca para sustituir a `record`.
   */
  async recordStandalone(actor: AuditActor, entry: AuditEntry): Promise<void> {
    await this.record(this.prisma, actor, entry);
  }

  /**
   * Calcula el diff entre dos objetos y devuelve sólo lo que cambió.
   *
   * Guardar el objeto entero en `previousValue`/`newValue` hace la bitácora
   * ilegible y pesada; guardar sólo el delta es lo que una auditoría necesita.
   */
  static diff(
    before: Record<string, unknown>,
    after: object,
  ): { previous: Record<string, unknown>; next: Record<string, unknown> } | null {
    const previous: Record<string, unknown> = {};
    const next: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(after as Record<string, unknown>)) {
      if (value === undefined) continue;
      const old = before[key];
      if (JSON.stringify(old) !== JSON.stringify(value)) {
        previous[key] = old ?? null;
        next[key] = value ?? null;
      }
    }

    return Object.keys(next).length > 0 ? { previous, next } : null;
  }
}

function toJson(value: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  if (value === undefined || value === null) return Prisma.JsonNull;
  return value as Prisma.InputJsonValue;
}
