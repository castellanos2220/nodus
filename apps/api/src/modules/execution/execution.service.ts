import { Injectable } from '@nestjs/common';
import {
  ActivityStatus,
  CaseStatusCode,
  DeliverableStatus,
  ImpactLevel,
  IncidentStatus,
  MilestoneStatus,
  Prisma,
  SlaStatus,
} from '@prisma/client';
import { AuditService, type AuditActor } from '../../core/audit/audit.service';
import type { AuthenticatedUser } from '../../core/auth/auth.types';
import { CaseAccessService } from '../../core/auth/case-access.service';
import { BusinessRuleError, NotFoundError } from '../../core/common/errors/domain.errors';
import { domainEvent } from '../../core/events/domain-events';
import { EventBusService } from '../../core/events/event-bus.service';
import { PrismaService } from '../../core/prisma/prisma.service';
import { LookupsService } from '../lookups/lookups.service';
import type {
  AddDeliverableVersionDto,
  CreateActivityDto,
  CreateDeliverableDto,
  CreateIncidentDto,
  CreateMeetingDto,
  CreateMilestoneDto,
  UpdateActivityDto,
  UpdateDeliverableDto,
  UpdateIncidentDto,
  UpdateMilestoneDto,
} from './dto/execution.dto';

/**
 * Ejecución del caso (Punto 8): agenda, actividades, hitos, incidencias,
 * entregables, reuniones y seguimiento.
 *
 * Nota de estructura: el brief lista `activities`, `milestones`, `incidents` y
 * `deliverables` como módulos. Aquí son **archivos y controladores separados
 * dentro de un mismo módulo Nest**, porque los cuatro comparten exactamente las
 * mismas reglas de acceso (el consultor responsable escribe, advisory supervisa,
 * el cliente lee) y el mismo ciclo (sólo se tocan con el caso en ejecución).
 * Cuatro módulos Nest que importan el mismo guard y el mismo servicio de acceso
 * serían ceremonia sin frontera.
 */
@Injectable()
export class ExecutionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly events: EventBusService,
    private readonly caseAccess: CaseAccessService,
    private readonly lookups: LookupsService,
  ) {}

  // ==========================================================================
  //  Resumen de ejecución (los "subestados" del Punto 8)
  // ==========================================================================

  /**
   * Estado agregado de la ejecución.
   *
   * El blueprint recomienda no fragmentar el estado del caso durante la
   * ejecución y controlarla con atributos; esto es esa vista. Además indica
   * exactamente qué bloquea el cierre técnico, con los mismos criterios que los
   * guards del workflow — leídos de la base, no reimplementados.
   */
  async summary(user: AuthenticatedUser, caseId: string) {
    await this.caseAccess.assertCanRead(user, caseId);

    const [activities, milestones, incidents, deliverables, sla, framework] = await Promise.all([
      this.prisma.activity.groupBy({
        by: ['status'],
        where: { caseId },
        _count: { _all: true },
      }),
      this.prisma.milestone.groupBy({
        by: ['status'],
        where: { caseId },
        _count: { _all: true },
      }),
      this.prisma.incident.groupBy({
        by: ['status'],
        where: { caseId },
        _count: { _all: true },
      }),
      this.prisma.deliverable.groupBy({
        by: ['status'],
        where: { caseId },
        _count: { _all: true },
      }),
      this.prisma.slaInstance.findFirst({
        where: {
          caseId,
          status: { in: [SlaStatus.ON_TRACK, SlaStatus.AT_RISK, SlaStatus.OVERDUE] },
        },
        orderBy: { deadline: 'asc' },
        select: { status: true, deadline: true, percentConsumed: true, stage: true },
      }),
      this.prisma.operationalFramework.findUnique({
        where: { caseId },
        select: { id: true },
      }),
    ]);

    const [overdueMilestones, pendingDeliverables, openMilestones, criticalIncidents] =
      await Promise.all([
        this.prisma.milestone.count({
          where: {
            caseId,
            targetDate: { lt: new Date() },
            status: { notIn: [MilestoneStatus.CUMPLIDO, MilestoneStatus.JUSTIFICADO] },
          },
        }),
        this.prisma.deliverable.findMany({
          where: { caseId, status: { not: DeliverableStatus.LISTO_PARA_CIERRE } },
          select: { name: true, status: true },
        }),
        this.prisma.milestone.findMany({
          where: {
            caseId,
            status: { notIn: [MilestoneStatus.CUMPLIDO, MilestoneStatus.JUSTIFICADO] },
          },
          select: { name: true, status: true },
        }),
        this.prisma.incident.findMany({
          where: {
            caseId,
            impact: { in: [ImpactLevel.ALTO, ImpactLevel.CRITICO] },
            status: {
              in: [IncidentStatus.ABIERTA, IncidentStatus.EN_ATENCION, IncidentStatus.ESCALADA],
            },
          },
          select: { title: true, status: true },
        }),
      ]);

    const closureBlockers: string[] = [];
    if (pendingDeliverables.length > 0) {
      closureBlockers.push(
        `${pendingDeliverables.length} entregable(s) no están listos para cierre`,
      );
    }
    if (openMilestones.length > 0) {
      closureBlockers.push(`${openMilestones.length} hito(s) sin cumplir ni justificar`);
    }
    if (criticalIncidents.length > 0) {
      closureBlockers.push(
        `${criticalIncidents.length} incidencia(s) de alto impacto sin cerrar`,
      );
    }

    const totalAgenda =
      activities.reduce((sum, row) => sum + row._count._all, 0) +
      milestones.reduce((sum, row) => sum + row._count._all, 0);

    return {
      agendaActivated: totalAgenda > 0,
      operationalFrameworkLoaded: Boolean(framework),
      activities: toCounts(activities, Object.values(ActivityStatus)),
      milestones: toCounts(milestones, Object.values(MilestoneStatus)),
      milestonesOverdue: overdueMilestones,
      incidents: toCounts(incidents, Object.values(IncidentStatus)),
      deliverables: toCounts(deliverables, Object.values(DeliverableStatus)),
      sla: sla ? { ...sla, percentConsumed: Number(sla.percentConsumed) } : null,
      readyForTechnicalClosure: closureBlockers.length === 0 && totalAgenda > 0,
      closureBlockers,
      pendingDetail: {
        deliverables: pendingDeliverables,
        milestones: openMilestones,
        incidents: criticalIncidents,
      },
    };
  }

  // ==========================================================================
  //  T8B — Actividades
  // ==========================================================================

  async listActivities(user: AuthenticatedUser, caseId: string) {
    await this.caseAccess.assertCanRead(user, caseId);
    return this.prisma.activity.findMany({
      where: { caseId },
      orderBy: [{ targetDate: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async createActivity(
    user: AuthenticatedUser,
    caseId: string,
    dto: CreateActivityDto,
    actor: AuditActor,
  ) {
    const kase = await this.assertExecutionWritable(user, caseId);

    return this.prisma.$transaction(async (tx) => {
      const activity = await tx.activity.create({
        data: {
          caseId,
          name: dto.name,
          description: dto.description ?? null,
          responsible: dto.responsible,
          targetDate: dto.targetDate,
          status: dto.status ?? ActivityStatus.NO_INICIADA,
          notes: dto.notes ?? null,
        },
      });

      await this.audit.record(tx, actor, {
        action: 'ACTIVITY_CREATED',
        entity: 'Activity',
        entityId: activity.id,
        caseId,
        companyId: kase.companyId,
        newValue: { name: activity.name, targetDate: activity.targetDate, status: activity.status },
        metadata: { template: 'T8B' },
      });

      return activity;
    });
  }

  async updateActivity(
    user: AuthenticatedUser,
    caseId: string,
    activityId: string,
    dto: UpdateActivityDto,
    actor: AuditActor,
  ) {
    const kase = await this.assertExecutionWritable(user, caseId);

    const current = await this.prisma.activity.findFirst({
      where: { id: activityId, caseId },
    });
    if (!current) throw new NotFoundError('la actividad', activityId);

    return this.prisma.$transaction(async (tx) => {
      const changes = AuditService.diff(current as unknown as Record<string, unknown>, dto);

      const activity = await tx.activity.update({
        where: { id: activityId },
        data: {
          ...dto,
          completedAt:
            dto.status === ActivityStatus.COMPLETADA
              ? (current.completedAt ?? new Date())
              : dto.status
                ? null
                : current.completedAt,
        },
      });

      if (changes) {
        await this.audit.record(tx, actor, {
          action: 'ACTIVITY_UPDATED',
          entity: 'Activity',
          entityId: activityId,
          caseId,
          companyId: kase.companyId,
          previousValue: changes.previous,
          newValue: changes.next,
        });
      }

      return activity;
    });
  }

  // ==========================================================================
  //  T8C — Hitos
  // ==========================================================================

  async listMilestones(user: AuthenticatedUser, caseId: string) {
    await this.caseAccess.assertCanRead(user, caseId);

    const milestones = await this.prisma.milestone.findMany({
      where: { caseId },
      orderBy: [{ targetDate: 'asc' }],
    });

    const now = new Date();
    return milestones.map((milestone) => ({
      ...milestone,
      isOverdue:
        milestone.targetDate < now &&
        milestone.status !== MilestoneStatus.CUMPLIDO &&
        milestone.status !== MilestoneStatus.JUSTIFICADO,
    }));
  }

  async createMilestone(
    user: AuthenticatedUser,
    caseId: string,
    dto: CreateMilestoneDto,
    actor: AuditActor,
  ) {
    const kase = await this.assertExecutionWritable(user, caseId);

    return this.prisma.$transaction(async (tx) => {
      const milestone = await tx.milestone.create({
        data: {
          caseId,
          name: dto.name,
          description: dto.description ?? null,
          responsible: dto.responsible,
          targetDate: dto.targetDate,
          criticality: dto.criticality ?? ImpactLevel.MEDIO,
          expectedResult: dto.expectedResult ?? null,
          status: MilestoneStatus.PENDIENTE,
        },
      });

      await this.audit.record(tx, actor, {
        action: 'MILESTONE_CREATED',
        entity: 'Milestone',
        entityId: milestone.id,
        caseId,
        companyId: kase.companyId,
        newValue: {
          name: milestone.name,
          targetDate: milestone.targetDate,
          criticality: milestone.criticality,
        },
        metadata: { template: 'T8C' },
      });

      return milestone;
    });
  }

  async updateMilestone(
    user: AuthenticatedUser,
    caseId: string,
    milestoneId: string,
    dto: UpdateMilestoneDto,
    actor: AuditActor,
  ) {
    const kase = await this.assertExecutionWritable(user, caseId);

    const current = await this.prisma.milestone.findFirst({
      where: { id: milestoneId, caseId },
    });
    if (!current) throw new NotFoundError('el hito', milestoneId);

    // Justificar o reprogramar un hito exige explicación: sin ella, el guard de
    // cierre aceptaría hitos "justificados" que no dicen nada.
    const needsJustification =
      dto.status === MilestoneStatus.JUSTIFICADO || dto.status === MilestoneStatus.REPROGRAMADO;
    if (needsJustification && (dto.justification ?? '').trim().length < 15) {
      throw new BusinessRuleError(
        'MILESTONE_JUSTIFICATION_REQUIRED',
        'Para justificar o reprogramar un hito debe registrar una explicación de al menos 15 caracteres.',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const changes = AuditService.diff(current as unknown as Record<string, unknown>, dto);

      const milestone = await tx.milestone.update({
        where: { id: milestoneId },
        data: {
          ...dto,
          completedAt:
            dto.status === MilestoneStatus.CUMPLIDO
              ? (current.completedAt ?? new Date())
              : dto.status
                ? null
                : current.completedAt,
        },
      });

      if (changes) {
        await this.audit.record(tx, actor, {
          action: 'MILESTONE_UPDATED',
          entity: 'Milestone',
          entityId: milestoneId,
          caseId,
          companyId: kase.companyId,
          previousValue: changes.previous,
          newValue: changes.next,
        });
      }

      return milestone;
    });
  }

  // ==========================================================================
  //  T8D — Incidencias
  // ==========================================================================

  async listIncidents(user: AuthenticatedUser, caseId: string) {
    await this.caseAccess.assertCanRead(user, caseId);
    return this.prisma.incident.findMany({
      where: { caseId },
      orderBy: [{ createdAt: 'desc' }],
      include: { reportedBy: { select: { id: true, fullName: true } } },
    });
  }

  async createIncident(
    user: AuthenticatedUser,
    caseId: string,
    dto: CreateIncidentDto,
    actor: AuditActor,
  ) {
    const kase = await this.assertExecutionWritable(user, caseId, { allowAdvisory: true });
    const collector = this.events.collector();

    const incident = await this.prisma.$transaction(async (tx) => {
      await this.lookups.assertValidCode(
        tx,
        'TIPO_INCIDENCIA',
        dto.typeCode,
        'tipo de incidencia',
      );

      const created = await tx.incident.create({
        data: {
          caseId,
          typeCode: dto.typeCode,
          title: dto.title,
          description: dto.description,
          impact: dto.impact,
          suggestedAction: dto.suggestedAction,
          status: IncidentStatus.ABIERTA,
          reportedById: user.id,
        },
      });

      await this.audit.record(tx, actor, {
        action: 'INCIDENT_OPENED',
        entity: 'Incident',
        entityId: created.id,
        caseId,
        companyId: kase.companyId,
        newValue: { title: created.title, impact: created.impact, typeCode: created.typeCode },
        metadata: { template: 'T8D' },
      });

      collector.add(
        domainEvent('IncidentOpened', {
          actorId: user.id,
          caseId,
          companyId: kase.companyId,
          payload: {
            caseCode: kase.code,
            caseTitle: kase.title,
            incidentTitle: created.title,
            impact: created.impact,
          },
        }),
      );

      return created;
    });

    await collector.flush();
    return incident;
  }

  async updateIncident(
    user: AuthenticatedUser,
    caseId: string,
    incidentId: string,
    dto: UpdateIncidentDto,
    actor: AuditActor,
  ) {
    const kase = await this.assertExecutionWritable(user, caseId, { allowAdvisory: true });

    const current = await this.prisma.incident.findFirst({ where: { id: incidentId, caseId } });
    if (!current) throw new NotFoundError('la incidencia', incidentId);

    const closing =
      dto.status === IncidentStatus.RESUELTA || dto.status === IncidentStatus.CERRADA;
    if (closing && (dto.decision ?? current.decision ?? '').trim().length < 10) {
      throw new BusinessRuleError(
        'INCIDENT_DECISION_REQUIRED',
        'Para resolver o cerrar una incidencia debe registrar la decisión tomada.',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const changes = AuditService.diff(current as unknown as Record<string, unknown>, dto);

      const incident = await tx.incident.update({
        where: { id: incidentId },
        data: {
          ...dto,
          resolvedAt: closing ? (current.resolvedAt ?? new Date()) : null,
        },
      });

      if (changes) {
        await this.audit.record(tx, actor, {
          action: 'INCIDENT_UPDATED',
          entity: 'Incident',
          entityId: incidentId,
          caseId,
          companyId: kase.companyId,
          previousValue: changes.previous,
          newValue: changes.next,
        });
      }

      return incident;
    });
  }

  // ==========================================================================
  //  T8G — Entregables (versionamiento obligatorio)
  // ==========================================================================

  async listDeliverables(user: AuthenticatedUser, caseId: string) {
    await this.caseAccess.assertCanRead(user, caseId);

    return this.prisma.deliverable.findMany({
      where: { caseId },
      orderBy: [{ targetDate: 'asc' }],
      include: {
        versions: {
          orderBy: { versionNumber: 'desc' },
          select: {
            id: true,
            versionNumber: true,
            notes: true,
            createdAt: true,
            uploadedBy: { select: { id: true, fullName: true } },
            documentVersion: {
              select: { id: true, fileName: true, mimeType: true, sizeBytes: true },
            },
          },
        },
      },
    });
  }

  async createDeliverable(
    user: AuthenticatedUser,
    caseId: string,
    dto: CreateDeliverableDto,
    actor: AuditActor,
  ) {
    const kase = await this.assertExecutionWritable(user, caseId);

    return this.prisma.$transaction(async (tx) => {
      await this.lookups.assertValidCode(
        tx,
        'TIPO_ENTREGABLE',
        dto.typeCode,
        'tipo de entregable',
      );

      const deliverable = await tx.deliverable.create({
        data: {
          caseId,
          name: dto.name,
          description: dto.description ?? null,
          typeCode: dto.typeCode ?? null,
          responsible: dto.responsible,
          targetDate: dto.targetDate,
          status: DeliverableStatus.PENDIENTE,
        },
      });

      await this.audit.record(tx, actor, {
        action: 'DELIVERABLE_CREATED',
        entity: 'Deliverable',
        entityId: deliverable.id,
        caseId,
        companyId: kase.companyId,
        newValue: { name: deliverable.name, targetDate: deliverable.targetDate },
        metadata: { template: 'T8G' },
      });

      return deliverable;
    });
  }

  async updateDeliverable(
    user: AuthenticatedUser,
    caseId: string,
    deliverableId: string,
    dto: UpdateDeliverableDto,
    actor: AuditActor,
  ) {
    const kase = await this.assertExecutionWritable(user, caseId, { allowAdvisory: true });

    const current = await this.prisma.deliverable.findFirst({
      where: { id: deliverableId, caseId },
      select: { id: true, status: true, currentVersion: true, name: true, notes: true, targetDate: true },
    });
    if (!current) throw new NotFoundError('el entregable', deliverableId);

    // Un entregable no puede declararse cargado o listo sin al menos una versión:
    // el versionamiento es obligatorio (§24).
    const requiresVersion =
      dto.status === DeliverableStatus.CARGADO ||
      dto.status === DeliverableStatus.EN_REVISION ||
      dto.status === DeliverableStatus.LISTO_PARA_CIERRE;

    if (requiresVersion && current.currentVersion === 0) {
      throw new BusinessRuleError(
        'DELIVERABLE_VERSION_REQUIRED',
        `El entregable "${current.name}" no tiene ninguna versión cargada.`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const changes = AuditService.diff(current as unknown as Record<string, unknown>, dto);

      const deliverable = await tx.deliverable.update({
        where: { id: deliverableId },
        data: dto,
      });

      if (changes) {
        await this.audit.record(tx, actor, {
          action: 'DELIVERABLE_UPDATED',
          entity: 'Deliverable',
          entityId: deliverableId,
          caseId,
          companyId: kase.companyId,
          previousValue: changes.previous,
          newValue: changes.next,
        });
      }

      return deliverable;
    });
  }

  /** Carga una versión nueva del entregable. Nunca sustituye a la anterior. */
  async addDeliverableVersion(
    user: AuthenticatedUser,
    caseId: string,
    deliverableId: string,
    dto: AddDeliverableVersionDto,
    actor: AuditActor,
  ) {
    const kase = await this.assertExecutionWritable(user, caseId);

    const deliverable = await this.prisma.deliverable.findFirst({
      where: { id: deliverableId, caseId },
      select: { id: true, name: true, currentVersion: true },
    });
    if (!deliverable) throw new NotFoundError('el entregable', deliverableId);

    const collector = this.events.collector();

    const version = await this.prisma.$transaction(async (tx) => {
      const versionNumber = deliverable.currentVersion + 1;

      const created = await tx.deliverableVersion.create({
        data: {
          deliverableId,
          versionNumber,
          documentVersionId: dto.documentVersionId ?? null,
          notes: dto.notes ?? null,
          uploadedById: user.id,
        },
        select: { id: true, versionNumber: true, createdAt: true },
      });

      await tx.deliverable.update({
        where: { id: deliverableId },
        data: { currentVersion: versionNumber, status: DeliverableStatus.CARGADO },
      });

      await this.audit.record(tx, actor, {
        action: 'DELIVERABLE_VERSION_UPLOADED',
        entity: 'DeliverableVersion',
        entityId: created.id,
        caseId,
        companyId: kase.companyId,
        newValue: { deliverable: deliverable.name, versionNumber },
      });

      collector.add(
        domainEvent('DeliverableUploaded', {
          actorId: user.id,
          caseId,
          companyId: kase.companyId,
          payload: {
            caseCode: kase.code,
            caseTitle: kase.title,
            deliverableName: deliverable.name,
            versionNumber,
          },
        }),
      );

      return created;
    });

    await collector.flush();
    return version;
  }

  // ==========================================================================
  //  T8E — Reuniones
  // ==========================================================================

  async listMeetings(user: AuthenticatedUser, caseId: string) {
    await this.caseAccess.assertCanRead(user, caseId);
    return this.prisma.meeting.findMany({
      where: { caseId },
      orderBy: { heldAt: 'desc' },
      include: { registeredBy: { select: { id: true, fullName: true } } },
    });
  }

  async createMeeting(
    user: AuthenticatedUser,
    caseId: string,
    dto: CreateMeetingDto,
    actor: AuditActor,
  ) {
    const access = await this.caseAccess.assertFullAccess(user, caseId);
    const kase = await this.prisma.case.findUniqueOrThrow({
      where: { id: caseId },
      select: { companyId: true },
    });
    void access;

    return this.prisma.$transaction(async (tx) => {
      const meeting = await tx.meeting.create({
        data: { caseId, ...dto, registeredById: user.id },
      });

      await this.audit.record(tx, actor, {
        action: 'MEETING_REGISTERED',
        entity: 'Meeting',
        entityId: meeting.id,
        caseId,
        companyId: kase.companyId,
        newValue: { title: meeting.title, type: meeting.type, heldAt: meeting.heldAt },
        metadata: { template: meeting.type === 'CIERRE' ? 'T9E' : 'T8E' },
      });

      return meeting;
    });
  }

  // ==========================================================================
  //  Interno
  // ==========================================================================

  /**
   * La agenda y sus elementos sólo se escriben con el caso autorizado o en
   * ejecución, y sólo por el consultor responsable (o advisory cuando procede).
   */
  private async assertExecutionWritable(
    user: AuthenticatedUser,
    caseId: string,
    options?: { allowAdvisory?: boolean },
  ) {
    const access = options?.allowAdvisory
      ? await this.caseAccess.assertFullAccess(user, caseId)
      : await this.caseAccess.assertIsLeadConsultant(user, caseId);

    const kase = await this.prisma.case.findUniqueOrThrow({
      where: { id: caseId },
      select: { id: true, code: true, title: true, companyId: true, status: true },
    });

    const writable: CaseStatusCode[] = [
      CaseStatusCode.AUTORIZADO_PARA_EJECUCION,
      CaseStatusCode.EN_EJECUCION,
      CaseStatusCode.LISTO_PARA_CIERRE,
    ];

    if (!writable.includes(kase.status)) {
      throw new BusinessRuleError(
        'EXECUTION_NOT_WRITABLE',
        `La agenda operativa sólo puede gestionarse desde que el caso está autorizado para ejecución. Estado actual: ${kase.status}.`,
        { status: kase.status },
      );
    }

    void access;
    return kase;
  }
}

/** Convierte un `groupBy` en un mapa completo con ceros en las claves ausentes. */
function toCounts<T extends string>(
  rows: Array<{ status: T; _count: { _all: number } }>,
  allKeys: T[],
): Record<T, number> {
  const result = Object.fromEntries(allKeys.map((key) => [key, 0])) as Record<T, number>;
  for (const row of rows) result[row.status] = row._count._all;
  return result;
}

export type { Prisma };
