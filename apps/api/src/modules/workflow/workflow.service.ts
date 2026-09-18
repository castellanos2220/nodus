import { Injectable, Logger } from '@nestjs/common';
import { AuditOrigin, CaseStatusCode, Prisma, RoleCode } from '@prisma/client';
import type { AuthenticatedUser } from '../../core/auth/auth.types';
import { AuditService, type AuditActor, SYSTEM_ACTOR } from '../../core/audit/audit.service';
import {
  ForbiddenError,
  InvalidTransitionError,
  NotFoundError,
  WorkflowGuardError,
} from '../../core/common/errors/domain.errors';
import { caseTransitionEvent, type DomainEvent } from '../../core/events/domain-events';
import { EventBusService } from '../../core/events/event-bus.service';
import { PrismaService, type TxClient } from '../../core/prisma/prisma.service';
import { SlaService } from '../sla/sla.service';
import { GUARDS, PAYLOAD_DEPENDENT_GUARDS } from './guards/workflow.guards';
import { TRANSITION_EFFECTS } from './transitions/transition.effects';
import { findTransition, transitionsFrom } from './transitions/transitions.registry';
import type { TransitionDefinition, WorkflowCase } from './workflow.types';

export interface TransitionRequest {
  transition: string;
  note?: string;
  payload?: Record<string, unknown>;
}

export interface TransitionResult {
  caseId: string;
  caseCode: string;
  from: CaseStatusCode;
  to: CaseStatusCode;
  transition: string;
  /** Transiciones automáticas encadenadas, en orden. */
  chained: string[];
  appliedAt: string;
}

export interface AvailableTransitionView {
  code: string;
  label: string;
  toStatus: CaseStatusCode;
  description: string;
  allowed: boolean;
  blockedBy: string[];
  blockedReason: string | null;
  requiresPayload: boolean;
}

const CASE_SELECT = {
  id: true,
  code: true,
  companyId: true,
  status: true,
  title: true,
  complexityCode: true,
  interventionTypeCode: true,
  urgencyCode: true,
} as const;

/**
 * Motor de workflow: la **única** puerta por la que el estado de un caso cambia.
 *
 * No existe ningún endpoint que escriba `case.status` directamente. Todo pasa por
 * `execute()`, que dentro de una sola transacción:
 *
 *   1. bloquea el caso (`FOR UPDATE`) para que dos peticiones simultáneas no
 *      apliquen transiciones incompatibles;
 *   2. comprueba que la arista existe desde el estado actual;
 *   3. comprueba rol y ámbito del actor sobre el recurso;
 *   4. ejecuta los guards de negocio;
 *   5. ejecuta el efecto propio de la transición;
 *   6. persiste el estado y escribe `CaseStatusHistory`;
 *   7. escribe la bitácora de auditoría;
 *   8. actualiza los relojes de SLA;
 *   9. encadena la transición automática si la hay.
 *
 * Los eventos de dominio se publican **después** del commit: un correo enviado
 * por un cambio que luego hizo rollback no se puede deshacer.
 */
@Injectable()
export class WorkflowService {
  private readonly logger = new Logger(WorkflowService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly events: EventBusService,
    private readonly sla: SlaService,
  ) {}

  async execute(
    user: AuthenticatedUser,
    caseId: string,
    request: TransitionRequest,
    auditActor: AuditActor,
  ): Promise<TransitionResult> {
    const collector = this.events.collector();
    const chained: string[] = [];

    const result = await this.prisma.$transaction(
      async (tx) => {
        // (1) Bloqueo pesimista. Sin esto, dos advisories pulsando "asignar" a la
        // vez podrían pasar ambos la comprobación de estado.
        await this.lockCase(tx, caseId);

        const kase = await this.loadCase(tx, caseId);
        const from = kase.status;

        const applied = await this.applyTransition(tx, {
          kase,
          request,
          user,
          auditActor,
          collector,
          chained,
        });

        return {
          caseId: kase.id,
          caseCode: kase.code,
          from,
          to: applied,
          transition: request.transition,
          chained: [...chained],
          appliedAt: new Date().toISOString(),
        } satisfies TransitionResult;
      },
      {
        // Una transición toca varias tablas y ejecuta guards; 15 s es holgado
        // para lo que en la práctica tarda milisegundos, y acota el bloqueo.
        timeout: 15_000,
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
      },
    );

    // (9) Sólo aquí, con el commit confirmado, salen los efectos externos.
    await collector.flush();

    this.logger.log(
      `Caso ${result.caseCode}: ${result.from} → ${result.to} vía ${result.transition}` +
        (result.chained.length > 0 ? ` (encadenó ${result.chained.join(', ')})` : ''),
    );

    return result;
  }

  /**
   * Aplica una transición y, recursivamente, su `autoNext`. Las encadenadas se
   * ejecutan con actor SISTEMA y quedan en el historial y la bitácora con
   * `origin = SYSTEM`: se atraviesan los estados, no se saltan.
   */
  private async applyTransition(
    tx: TxClient,
    input: {
      kase: WorkflowCase;
      request: TransitionRequest;
      user: AuthenticatedUser | null;
      auditActor: AuditActor;
      collector: ReturnType<EventBusService['collector']>;
      chained: string[];
      depth?: number;
    },
  ): Promise<CaseStatusCode> {
    const depth = input.depth ?? 0;
    if (depth > 4) {
      throw new WorkflowGuardError(
        'TRANSITION_CHAIN_TOO_DEEP',
        'La cadena de transiciones automáticas es demasiado profunda',
      );
    }

    const { kase, request, user } = input;
    const definition = findTransition(kase.status, request.transition);

    if (!definition) {
      throw new InvalidTransitionError(kase.status, request.transition);
    }

    // (3) Autorización a nivel de arista: rol + ámbito sobre el recurso.
    if (depth === 0) {
      await this.assertActorAllowed(tx, definition, kase, user);
    }

    const guardContext = {
      tx,
      case: kase,
      payload: request.payload ?? {},
      note: request.note,
      user,
    };

    // (4) Guards de negocio.
    for (const guardCode of definition.guards) {
      const guard = GUARDS[guardCode];
      if (!guard) {
        throw new Error(`Guard no registrado: ${guardCode}`);
      }
      await guard(guardContext);
    }

    // (5) Efecto propio.
    const effect = TRANSITION_EFFECTS[definition.code];
    const effectResult = effect
      ? ((await effect({ ...guardContext, to: definition.to })) ?? {})
      : {};

    // (6) Estado + historial.
    const previousEntry = await tx.caseStatusHistory.findFirst({
      where: { caseId: kase.id },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });

    const now = new Date();
    const hoursInPrevious = previousEntry
      ? (now.getTime() - previousEntry.createdAt.getTime()) / 3_600_000
      : null;

    await tx.case.update({
      where: { id: kase.id },
      data: { status: definition.to },
    });

    await tx.caseStatusHistory.create({
      data: {
        caseId: kase.id,
        previousStatus: kase.status,
        newStatus: definition.to,
        transitionCode: definition.code,
        note: request.note ?? null,
        origin: depth === 0 ? AuditOrigin.USER : AuditOrigin.SYSTEM,
        actorId: depth === 0 ? (user?.id ?? null) : null,
        hoursInPreviousStatus:
          hoursInPrevious === null ? null : new Prisma.Decimal(hoursInPrevious.toFixed(2)),
      },
    });

    // (7) Auditoría, en la misma transacción.
    await this.audit.record(tx, depth === 0 ? input.auditActor : SYSTEM_ACTOR, {
      action: `CASE_TRANSITION_${definition.code}`,
      entity: 'Case',
      entityId: kase.id,
      caseId: kase.id,
      companyId: kase.companyId,
      previousValue: { status: kase.status },
      newValue: { status: definition.to },
      origin: depth === 0 ? AuditOrigin.USER : AuditOrigin.SYSTEM,
      metadata: {
        transition: definition.code,
        label: definition.label,
        note: request.note ?? null,
        ...(effectResult as Record<string, unknown>),
      },
    });

    // (8) Relojes de SLA.
    await this.sla.onTransition(tx, {
      caseId: kase.id,
      companyId: kase.companyId,
      from: kase.status,
      to: definition.to,
      complexityCode: kase.complexityCode,
      interventionTypeCode: kase.interventionTypeCode,
    });

    input.collector.add(
      caseTransitionEvent(definition.event, {
        actorId: depth === 0 ? (user?.id ?? null) : null,
        caseId: kase.id,
        companyId: kase.companyId,
        caseCode: kase.code,
        from: kase.status,
        to: definition.to,
        transition: definition.code,
        extra: { caseTitle: kase.title, ...(effectResult as Record<string, unknown>) },
      }),
    );

    // (9) Encadenado automático, dentro de la misma transacción.
    if (definition.autoNext) {
      input.chained.push(definition.autoNext);
      return this.applyTransition(tx, {
        ...input,
        kase: { ...kase, status: definition.to },
        request: { transition: definition.autoNext, payload: request.payload },
        depth: depth + 1,
      });
    }

    return definition.to;
  }

  /**
   * Comprueba que el actor puede ejecutar **esta** arista sobre **este** caso.
   *
   * Dos comprobaciones distintas y ambas necesarias: el rol (¿un consultor puede
   * clasificar? no) y el ámbito (¿este consultor es el responsable de este caso?).
   */
  private async assertActorAllowed(
    tx: TxClient,
    definition: TransitionDefinition,
    kase: WorkflowCase,
    user: AuthenticatedUser | null,
  ): Promise<void> {
    if (definition.scope === 'SYSTEM') {
      throw new ForbiddenError(
        `La transición ${definition.code} sólo puede ejecutarla el sistema`,
        'SYSTEM_ONLY_TRANSITION',
      );
    }

    if (!user) {
      throw new ForbiddenError('No autenticado', 'UNAUTHENTICATED');
    }

    if (!definition.roles.includes(user.role)) {
      throw new ForbiddenError(
        `Su rol (${user.role}) no puede ejecutar la transición ${definition.label}`,
        'TRANSITION_ROLE_NOT_ALLOWED',
        { requiredRoles: definition.roles, actualRole: user.role },
      );
    }

    if (definition.scope === 'LEAD_CONSULTANT') {
      if (user.role === RoleCode.SUPER_ADMIN) return;
      const assignment = await tx.caseAssignment.findFirst({
        where: {
          caseId: kase.id,
          isPrimary: true,
          isActive: true,
          consultantId: user.consultantId ?? '00000000-0000-0000-0000-000000000000',
        },
        select: { id: true },
      });
      if (!assignment) {
        throw new ForbiddenError(
          'Sólo el consultor responsable principal de este caso puede ejecutar esta acción',
          'NOT_LEAD_CONSULTANT',
        );
      }
    }

    if (definition.scope === 'CLIENT_OWNER') {
      if (user.role === RoleCode.SUPER_ADMIN) return;
      if (!user.companyId || user.companyId !== kase.companyId) {
        throw new ForbiddenError(
          'Sólo el cliente propietario de este caso puede ejecutar esta acción',
          'NOT_CASE_OWNER',
        );
      }
    }
  }

  /**
   * Calcula, para el usuario dado, qué transiciones puede ver y ejecutar desde el
   * estado actual, y **por qué** cada una está bloqueada si lo está.
   *
   * Los guards se ejecutan en seco (sólo leen) contra el cliente normal. Los que
   * dependen del payload se omiten y la transición se marca `requiresPayload`.
   * Así el frontend nunca duplica una regla de negocio: la pregunta y la
   * respuesta vienen las dos del backend.
   */
  async availableTransitions(
    user: AuthenticatedUser,
    caseId: string,
  ): Promise<AvailableTransitionView[]> {
    const kase = await this.loadCase(this.prisma, caseId);
    const candidates = transitionsFrom(kase.status).filter(
      (definition) => definition.scope !== 'SYSTEM',
    );

    const views: AvailableTransitionView[] = [];

    for (const definition of candidates) {
      // Las que el rol no puede ejecutar no se listan: no tiene sentido ofrecer
      // a un cliente el botón "clasificar".
      if (!definition.roles.includes(user.role)) continue;

      try {
        await this.assertActorAllowed(this.prisma, definition, kase, user);
      } catch {
        continue;
      }

      const blockedBy: string[] = [];
      let blockedReason: string | null = null;

      for (const guardCode of definition.guards) {
        if (PAYLOAD_DEPENDENT_GUARDS.has(guardCode)) continue;
        const guard = GUARDS[guardCode];
        if (!guard) continue;

        try {
          await guard({ tx: this.prisma, case: kase, payload: {}, user });
        } catch (error) {
          if (error instanceof WorkflowGuardError) {
            blockedBy.push(error.guardCode);
            blockedReason ??= error.message;
          } else {
            throw error;
          }
        }
      }

      views.push({
        code: definition.code,
        label: definition.label,
        toStatus: definition.to,
        description: definition.description,
        allowed: blockedBy.length === 0,
        blockedBy,
        blockedReason,
        requiresPayload: definition.requiresPayload,
      });
    }

    return views;
  }

  private async lockCase(tx: TxClient, caseId: string): Promise<void> {
    const rows = await tx.$queryRaw<{ id: string }[]>`
      SELECT "id" FROM "cases" WHERE "id" = ${caseId}::uuid FOR UPDATE
    `;
    if (rows.length === 0) {
      throw new NotFoundError('el caso', caseId);
    }
  }

  private async loadCase(tx: TxClient, caseId: string): Promise<WorkflowCase> {
    const kase = await tx.case.findUnique({ where: { id: caseId }, select: CASE_SELECT });
    if (!kase) throw new NotFoundError('el caso', caseId);
    return kase;
  }

  /** Publica eventos generados por procesos de fondo (worker de SLA). */
  async publishSystemEvents(events: DomainEvent[]): Promise<void> {
    for (const event of events) {
      await this.events.publish(event);
    }
  }
}
