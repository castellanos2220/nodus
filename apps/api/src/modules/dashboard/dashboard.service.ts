import { Injectable } from '@nestjs/common';
import {
  ApplicationStatus,
  CaseStatusCode,
  ConsultantStatus,
  ProposalVersionStatus,
  RoleCode,
  SlaStatus,
} from '@prisma/client';
import { CASE_STATUS_LABEL } from '@nodus/types';
import type { AuthenticatedUser } from '../../core/auth/auth.types';
import { CACHE_KEYS, CacheService } from '../../core/cache/cache.service';
import { PrismaService } from '../../core/prisma/prisma.service';

const TERMINAL: CaseStatusCode[] = [
  CaseStatusCode.CERRADO,
  CaseStatusCode.CERRADO_SIN_CONTRATACION,
];

const CRITICAL_IMPACTS = ['CRITICO', 'ALTO'];

/**
 * Dashboard PMO (§31).
 *
 * Regla que gobierna todo este servicio: **no se carga la base para contar**.
 * Cada KPI es un `count`, un `groupBy` o un agregado SQL que PostgreSQL resuelve
 * con índices; en ningún momento se traen filas a Node para sumarlas en
 * JavaScript. Los tiempos medios por etapa salen de `hoursInPreviousStatus`, que
 * se materializa en cada transición justo para no tener que reconstruirlos
 * recorriendo todo el historial.
 *
 * El resultado se cachea 60 s por alcance de rol: un tablero de gestión no
 * necesita ser exacto al segundo, y recalcularlo en cada visita sí se nota.
 */
@Injectable()
export class DashboardService {
  private static readonly CACHE_TTL_SECONDS = 60;

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  async kpis(user: AuthenticatedUser) {
    const scope = this.scopeKey(user);

    return this.cache.remember(
      CACHE_KEYS.dashboardKpis(scope),
      DashboardService.CACHE_TTL_SECONDS,
      () => this.computeKpis(user),
    );
  }

  private async computeKpis(user: AuthenticatedUser) {
    const caseFilter = this.caseFilter(user);

    const [
      byStatus,
      criticalCases,
      overdueSlas,
      atRiskSlas,
      activeConsultants,
      pendingApplications,
      pendingReviews,
      stageTimes,
      slaCompliance,
      proposalStats,
      satisfaction,
    ] = await Promise.all([
      // Casos por estado: un solo GROUP BY sobre el índice (status, createdAt).
      this.prisma.case.groupBy({
        by: ['status'],
        where: caseFilter,
        _count: { _all: true },
      }),

      this.prisma.case.count({
        where: {
          ...caseFilter,
          status: { notIn: TERMINAL },
          OR: [
            { impactCode: { in: CRITICAL_IMPACTS } },
            { slaInstances: { some: { status: SlaStatus.OVERDUE } } },
          ],
        },
      }),

      this.prisma.slaInstance.count({
        where: { status: SlaStatus.OVERDUE, case: caseFilter },
      }),

      this.prisma.slaInstance.count({
        where: { status: SlaStatus.AT_RISK, case: caseFilter },
      }),

      this.prisma.consultant.count({ where: { status: ConsultantStatus.HABILITADO } }),

      this.prisma.application.count({
        where: {
          status: { in: [ApplicationStatus.PRESENTADA, ApplicationStatus.EN_EVALUACION] },
          case: { ...caseFilter, status: CaseStatusCode.EN_POSTULACION },
        },
      }),

      this.prisma.proposalVersion.count({
        where: { status: ProposalVersionStatus.EN_QA, proposal: { case: caseFilter } },
      }),

      this.stageAverages(user),
      this.slaCompliance(user),
      this.proposalConversion(user),
      this.averageSatisfaction(user),
    ]);

    const counts = new Map(byStatus.map((row) => [row.status, row._count._all]));
    const total = [...counts.values()].reduce((sum, value) => sum + value, 0);
    const closed = counts.get(CaseStatusCode.CERRADO) ?? 0;
    const closedWithout = counts.get(CaseStatusCode.CERRADO_SIN_CONTRATACION) ?? 0;

    return {
      activeCases: total - closed - closedWithout,
      criticalCases,
      overdueSlas,
      atRiskSlas,
      closedCases: closed,
      closedWithoutContracting: closedWithout,
      activeConsultants,
      pendingApplications,
      pendingProposalReviews: pendingReviews,
      totalCases: total,

      casesByStatus: Object.values(CaseStatusCode).map((status) => ({
        status,
        label: CASE_STATUS_LABEL[status],
        count: counts.get(status) ?? 0,
      })),

      avgHoursToClassification: stageTimes.classification,
      avgHoursToProposal: stageTimes.proposal,
      avgHoursToClosure: stageTimes.closure,

      slaCompliancePercent: slaCompliance,
      proposalConversionPercent: proposalStats.conversionPercent,
      proposalsSent: proposalStats.sent,
      proposalsAccepted: proposalStats.accepted,
      averageCustomerSatisfaction: satisfaction,

      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Tiempos medios por etapa.
   *
   * Se calculan sobre `case_status_history.hoursInPreviousStatus`, que se rellena
   * en cada transición. La alternativa —reconstruir el tiempo restando pares de
   * filas consecutivas en cada consulta— obliga a leer el historial completo de
   * todos los casos; esto es un `AVG` sobre un índice.
   */
  private async stageAverages(user: AuthenticatedUser) {
    const scopeCompanyId = user.role === RoleCode.CLIENTE_MIPYME ? user.companyId : null;

    const rows = await this.prisma.$queryRaw<
      Array<{ newStatus: CaseStatusCode; avg_hours: number | null }>
    >`
      SELECT h."newStatus", AVG(h."hoursInPreviousStatus")::float AS avg_hours
      FROM "case_status_history" h
      JOIN "cases" c ON c."id" = h."caseId"
      WHERE h."hoursInPreviousStatus" IS NOT NULL
        AND (${scopeCompanyId}::uuid IS NULL OR c."companyId" = ${scopeCompanyId}::uuid)
      GROUP BY h."newStatus"
    `;

    const byStatus = new Map(rows.map((row) => [row.newStatus, row.avg_hours]));

    return {
      classification: round(byStatus.get(CaseStatusCode.CLASIFICADO)),
      proposal: round(byStatus.get(CaseStatusCode.PROPUESTA_ENVIADA)),
      closure: round(byStatus.get(CaseStatusCode.CERRADO)),
    };
  }

  /** % de instancias de SLA cerradas dentro de plazo. */
  private async slaCompliance(user: AuthenticatedUser): Promise<number | null> {
    const caseFilter = this.caseFilter(user);

    const [completed, onTime] = await Promise.all([
      this.prisma.slaInstance.count({
        where: { status: SlaStatus.COMPLETED, case: caseFilter },
      }),
      this.prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*)::bigint AS count
        FROM "sla_instances" s
        WHERE s."status" = 'COMPLETED'
          AND s."completedAt" IS NOT NULL
          AND s."completedAt" <= s."deadline"
      `,
    ]);

    if (completed === 0) return null;
    const onTimeCount = Number(onTime[0]?.count ?? 0);
    return Math.round((onTimeCount / completed) * 100);
  }

  /** Conversión: propuestas enviadas → aceptadas. */
  private async proposalConversion(user: AuthenticatedUser) {
    const caseFilter = this.caseFilter(user);

    const [sent, accepted] = await Promise.all([
      this.prisma.proposalVersion.count({
        where: {
          status: {
            in: [
              ProposalVersionStatus.ENVIADA,
              ProposalVersionStatus.ACEPTADA,
              ProposalVersionStatus.SUPERADA,
            ],
          },
          sentAt: { not: null },
          proposal: { case: caseFilter },
        },
      }),
      this.prisma.proposalVersion.count({
        where: { status: ProposalVersionStatus.ACEPTADA, proposal: { case: caseFilter } },
      }),
    ]);

    return {
      sent,
      accepted,
      conversionPercent: sent === 0 ? null : Math.round((accepted / sent) * 100),
    };
  }

  private async averageSatisfaction(user: AuthenticatedUser): Promise<number | null> {
    const result = await this.prisma.customerEvaluation.aggregate({
      where: { case: this.caseFilter(user) },
      _avg: { overallSatisfaction: true },
    });
    const value = result._avg.overallSatisfaction;
    return value === null ? null : Number(value.toFixed(2));
  }

  /** Casos que requieren atención de quien mira el tablero. */
  async attentionQueue(user: AuthenticatedUser) {
    const caseFilter = this.caseFilter(user);

    const [overdue, stalled, pendingDecision] = await Promise.all([
      this.prisma.case.findMany({
        where: { ...caseFilter, slaInstances: { some: { status: SlaStatus.OVERDUE } } },
        take: 10,
        orderBy: { updatedAt: 'asc' },
        select: {
          id: true,
          code: true,
          title: true,
          status: true,
          company: { select: { name: true } },
          slaInstances: {
            where: { status: SlaStatus.OVERDUE },
            take: 1,
            select: { stage: true, deadline: true, percentConsumed: true },
          },
        },
      }),

      // "Estancado": sin movimiento en 14 días y no terminal.
      this.prisma.case.findMany({
        where: {
          ...caseFilter,
          status: { notIn: TERMINAL },
          updatedAt: { lt: new Date(Date.now() - 14 * 24 * 3_600_000) },
        },
        take: 10,
        orderBy: { updatedAt: 'asc' },
        select: {
          id: true,
          code: true,
          title: true,
          status: true,
          updatedAt: true,
          company: { select: { name: true } },
        },
      }),

      this.prisma.case.count({
        where: { ...caseFilter, status: CaseStatusCode.EN_DECISION_CLIENTE },
      }),
    ]);

    return {
      overdueSla: overdue.map((kase) => ({
        ...kase,
        sla: kase.slaInstances[0]
          ? {
              ...kase.slaInstances[0],
              percentConsumed: Number(kase.slaInstances[0].percentConsumed),
            }
          : null,
        slaInstances: undefined,
      })),
      stalled,
      pendingClientDecision: pendingDecision,
    };
  }

  /**
   * Alcance de los KPIs según el rol.
   *
   * El cliente ve los indicadores de su empresa; el consultor, los de sus casos;
   * advisory y admin, los de la plataforma. Se aplica en la consulta, no
   * ocultando números en la interfaz.
   */
  private caseFilter(user: AuthenticatedUser) {
    switch (user.role) {
      case RoleCode.CLIENTE_MIPYME:
        return { companyId: user.companyId ?? '00000000-0000-0000-0000-000000000000' };
      case RoleCode.CONSULTOR:
        return {
          assignments: { some: { consultantId: user.consultantId ?? '', isActive: true } },
        };
      default:
        return {};
    }
  }

  private scopeKey(user: AuthenticatedUser): string {
    switch (user.role) {
      case RoleCode.CLIENTE_MIPYME:
        return `company:${user.companyId ?? 'none'}`;
      case RoleCode.CONSULTOR:
        return `consultant:${user.consultantId ?? 'none'}`;
      default:
        return 'platform';
    }
  }
}

function round(value: number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  return Math.round(value * 10) / 10;
}
