'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import type { CaseStatusCode, Role } from '@nodus/types';
import { CASE_STATUS_LABEL } from '@nodus/types';
import { AlertTriangle, ArrowUpRight, CheckCircle2, Hourglass } from 'lucide-react';
import { api } from '@/lib/api';
import { CASE_STAGES } from '@/lib/case-stages';
import { cn, formatRelative } from '@/lib/utils';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  Skeleton,
} from '@/components/ui/primitives';
import { Kpi, KpiStrip } from '@/components/ui/kpi';
import { Stagger, StaggerItem } from '@/components/ui/motion';
import { StatusBadge } from '@/components/ui/status';

interface Kpis {
  activeCases: number;
  criticalCases: number;
  overdueSlas: number;
  atRiskSlas: number;
  closedCases: number;
  closedWithoutContracting: number;
  activeConsultants: number;
  pendingApplications: number;
  pendingProposalReviews: number;
  totalCases: number;
  casesByStatus: { status: CaseStatusCode; label: string; count: number }[];
  avgHoursToClassification: number | null;
  avgHoursToProposal: number | null;
  avgHoursToClosure: number | null;
  slaCompliancePercent: number | null;
  proposalConversionPercent: number | null;
  proposalsSent: number;
  proposalsAccepted: number;
  averageCustomerSatisfaction: number | null;
  generatedAt: string;
}

interface Attention {
  overdueSla: Array<{
    id: string;
    code: string;
    title: string;
    status: CaseStatusCode;
    company: { name: string };
    sla: { stage: string; deadline: string; percentConsumed: number } | null;
  }>;
  stalled: Array<{
    id: string;
    code: string;
    title: string;
    status: CaseStatusCode;
    updatedAt: string;
    company: { name: string };
  }>;
  pendingClientDecision: number;
}

export function DashboardView({ role }: { role: Role }) {
  const { data: kpis, isLoading } = useQuery({
    queryKey: ['dashboard', 'kpis'],
    queryFn: () => api.get<Kpis>('/dashboard/kpis'),
  });

  const { data: attention } = useQuery({
    queryKey: ['dashboard', 'attention'],
    queryFn: () => api.get<Attention>('/dashboard/attention'),
  });

  if (isLoading || !kpis) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-[168px] rounded-md" />
        <Skeleton className="h-[168px] rounded-md" />
        <Skeleton className="h-72 rounded-md" />
      </div>
    );
  }

  const isAdvisory = role === 'ADVISORY' || role === 'SUPER_ADMIN';

  return (
    <div className="space-y-10">
      {/* --- Operación ---------------------------------------------------- */}
      <section className="space-y-4">
        <SectionHeading title="Operación" description="Estado actual de la cartera de casos" />
        <Stagger>
          <KpiStrip>
            <StaggerItem>
              <Kpi
                label="Casos activos"
                value={kpis.activeCases}
                hint={`${kpis.totalCases} registrados en total`}
              />
            </StaggerItem>
            <StaggerItem>
              <Kpi
                label="Casos críticos"
                value={kpis.criticalCases}
                tone={kpis.criticalCases > 0 ? 'warning' : 'default'}
                signal="Requieren atención"
                hint={kpis.criticalCases > 0 ? undefined : 'Impacto alto o SLA vencido'}
              />
            </StaggerItem>
            <StaggerItem>
              <Kpi
                label="SLA vencidos"
                value={kpis.overdueSlas}
                tone={kpis.overdueSlas > 0 ? 'danger' : 'default'}
                signal="Intervención inmediata"
                hint={`${kpis.atRiskSlas} en riesgo`}
              />
            </StaggerItem>
            <StaggerItem>
              <Kpi
                label="Casos cerrados"
                value={kpis.closedCases}
                hint={`${kpis.closedWithoutContracting} sin contratación`}
              />
            </StaggerItem>
          </KpiStrip>
        </Stagger>
      </section>

      {/* --- Rendimiento -------------------------------------------------- */}
      <section className="space-y-4">
        <SectionHeading title="Rendimiento" description="Calidad del servicio y del ecosistema" />
        <Stagger>
          <KpiStrip>
            <StaggerItem>
              <Kpi
                label="Cumplimiento de SLA"
                value={formatPercent(kpis.slaCompliancePercent)}
                meter={kpis.slaCompliancePercent}
                hint="Relojes cerrados dentro de plazo"
              />
            </StaggerItem>
            <StaggerItem>
              <Kpi
                label="Conversión de propuestas"
                value={formatPercent(kpis.proposalConversionPercent)}
                meter={kpis.proposalConversionPercent}
                hint={`${kpis.proposalsAccepted} de ${kpis.proposalsSent} enviadas`}
              />
            </StaggerItem>
            <StaggerItem>
              <Kpi
                label="Consultores habilitados"
                value={kpis.activeConsultants}
                hint="Pueden postularse a la bolsa"
              />
            </StaggerItem>
            <StaggerItem>
              <Kpi
                label="Satisfacción media"
                value={
                  kpis.averageCustomerSatisfaction === null ? (
                    '—'
                  ) : (
                    <>
                      {kpis.averageCustomerSatisfaction}
                      <span className="ml-1 text-lg font-medium text-subtle-foreground">/ 5</span>
                    </>
                  )
                }
                hint="Encuestas de cierre"
              />
            </StaggerItem>
          </KpiStrip>
        </Stagger>
      </section>

      {/* --- Pipeline ----------------------------------------------------- */}
      <section className="space-y-4">
        <SectionHeading
          title="Pipeline"
          description="Casos en cada etapa del ciclo de vida"
          action={
            <Link href="/cases" className="link inline-flex items-center gap-1 text-xs">
              Ver todos <ArrowUpRight className="size-3.5" aria-hidden />
            </Link>
          }
        />
        <Pipeline rows={kpis.casesByStatus} />
      </section>

      {/* --- Ciclo y bandeja ---------------------------------------------- */}
      <section className={cn('grid gap-6', isAdvisory && 'lg:grid-cols-[1.25fr_1fr]')}>
        <Card>
          <CardHeader>
            <CardTitle>Tiempos de ciclo</CardTitle>
            <CardDescription>Promedio calculado sobre el historial de transiciones</CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="grid gap-6 sm:grid-cols-3">
              <CycleTime
                step={1}
                label="Hasta clasificación"
                hours={kpis.avgHoursToClassification}
              />
              <CycleTime step={2} label="Hasta propuesta" hours={kpis.avgHoursToProposal} />
              <CycleTime step={3} label="Hasta cierre" hours={kpis.avgHoursToClosure} />
            </ol>
          </CardContent>
        </Card>

        {isAdvisory && (
          <Card>
            <CardHeader>
              <CardTitle>Bandeja de Advisory</CardTitle>
              <CardDescription>Decisiones que esperan a su equipo</CardDescription>
            </CardHeader>
            <CardContent className="space-y-1 px-3 pb-3">
              <PendingRow
                label="Postulaciones por evaluar"
                count={kpis.pendingApplications}
                href="/cases?status=EN_POSTULACION"
              />
              <PendingRow
                label="Propuestas en QA"
                count={kpis.pendingProposalReviews}
                href="/proposals"
              />
              <PendingRow
                label="Esperando decisión del cliente"
                count={attention?.pendingClientDecision ?? 0}
                href="/cases?status=EN_DECISION_CLIENTE"
              />
            </CardContent>
          </Card>
        )}
      </section>

      {/* --- Cola de atención --------------------------------------------- */}
      <section className="grid gap-6 lg:grid-cols-2">
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              SLA vencido
              {attention && attention.overdueSla.length > 0 && (
                <span className="tabular rounded-full bg-danger-soft px-1.5 text-[11px] font-semibold text-danger">
                  {attention.overdueSla.length}
                </span>
              )}
            </CardTitle>
            <CardDescription>Casos cuyo reloj de etapa ya expiró</CardDescription>
          </CardHeader>
          {attention && attention.overdueSla.length > 0 ? (
            <ul className="divide-y divide-border border-t border-border">
              {attention.overdueSla.map((item) => (
                <AttentionRow
                  key={item.id}
                  href={`/cases/${item.id}`}
                  title={item.title}
                  code={item.code}
                  company={item.company.name}
                  status={item.status}
                  meta={
                    item.sla ? (
                      <span className="inline-flex items-center gap-1 text-danger">
                        <AlertTriangle className="size-3" aria-hidden />
                        venció {formatRelative(item.sla.deadline)}
                      </span>
                    ) : null
                  }
                />
              ))}
            </ul>
          ) : (
            <EmptyState
              className="py-10"
              icon={<CheckCircle2 />}
              title="Ningún SLA vencido"
              description="Todos los relojes activos están dentro de plazo."
            />
          )}
        </Card>

        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle>Casos estancados</CardTitle>
            <CardDescription>Sin movimiento en más de 14 días</CardDescription>
          </CardHeader>
          {attention && attention.stalled.length > 0 ? (
            <ul className="divide-y divide-border border-t border-border">
              {attention.stalled.map((item) => (
                <AttentionRow
                  key={item.id}
                  href={`/cases/${item.id}`}
                  title={item.title}
                  code={item.code}
                  company={item.company.name}
                  status={item.status}
                  meta={
                    <span className="inline-flex items-center gap-1">
                      <Hourglass className="size-3" aria-hidden />
                      {formatRelative(item.updatedAt)}
                    </span>
                  }
                />
              ))}
            </ul>
          ) : (
            <EmptyState
              className="py-10"
              icon={<CheckCircle2 />}
              title="Ningún caso estancado"
              description="Todos los casos han tenido movimiento reciente."
            />
          )}
        </Card>
      </section>

      <p className="text-center text-2xs text-subtle-foreground">
        Indicadores calculados con agregados SQL · actualizados {formatRelative(kpis.generatedAt)}
      </p>
    </div>
  );
}

// ============================================================================

function SectionHeading({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div>
        <h2 className="text-base font-semibold">{title}</h2>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}

function formatPercent(value: number | null): string {
  return value === null ? '—' : `${value}%`;
}

function formatHours(hours: number | null): { value: string; unit: string } {
  if (hours === null) return { value: '—', unit: '' };
  if (hours < 24) return { value: hours.toFixed(1), unit: 'horas' };
  return { value: (hours / 24).toFixed(1), unit: 'días' };
}

/**
 * Pipeline por etapas. Una sola serie (casos) en un solo color: la barra de cada
 * etapa es proporcional a la etapa más cargada. Los estados de la etapa se
 * listan debajo como enlaces al listado filtrado.
 */
function Pipeline({ rows }: { rows: Kpis['casesByStatus'] }) {
  const byStatus = new Map(rows.map((row) => [row.status, row.count]));
  const stages = CASE_STAGES.map((stage) => ({
    ...stage,
    total: stage.statuses.reduce((sum, status) => sum + (byStatus.get(status) ?? 0), 0),
  }));
  const max = Math.max(...stages.map((stage) => stage.total), 1);

  if (stages.every((stage) => stage.total === 0)) {
    return (
      <Card>
        <EmptyState title="Aún no hay casos registrados" />
      </Card>
    );
  }

  return (
    <div className="grid gap-px overflow-hidden rounded-md border border-border bg-border sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
      {stages.map((stage, index) => (
        <div key={stage.id} className="flex flex-col gap-4 bg-card p-5">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">
                <span className="tabular mr-1.5 text-subtle-foreground">
                  {String(index + 1).padStart(2, '0')}
                </span>
                {stage.label}
              </span>
            </div>
            <p
              className={cn(
                'text-2xl font-semibold',
                stage.total === 0 ? 'text-subtle-foreground' : 'text-foreground',
              )}
            >
              {stage.total}
            </p>
            <div className="h-1 overflow-hidden rounded-full bg-muted" aria-hidden>
              <div
                className="h-full rounded-full bg-brand transition-[width] duration-700"
                style={{ width: `${(stage.total / max) * 100}%` }}
              />
            </div>
          </div>

          <ul className="space-y-1">
            {stage.statuses.map((status) => {
              const count = byStatus.get(status) ?? 0;
              return (
                <li key={status}>
                  <Link
                    href={`/cases?status=${status}`}
                    className={cn(
                      '-mx-1.5 flex items-center justify-between gap-2 rounded-md px-1.5 py-1 text-xs transition-colors hover:bg-muted',
                      count > 0 ? 'text-ink-2' : 'text-subtle-foreground',
                    )}
                  >
                    <span className="truncate">{CASE_STATUS_LABEL[status]}</span>
                    <span className="tabular shrink-0 font-medium">{count}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}

function CycleTime({ step, label, hours }: { step: number; label: string; hours: number | null }) {
  const { value, unit } = formatHours(hours);

  return (
    <li className="relative space-y-2 border-l border-border pl-4">
      <span className="absolute -left-[3.5px] top-1 size-1.5 rounded-full bg-brand" aria-hidden />
      <p className="text-xs text-muted-foreground">
        <span className="tabular mr-1.5 text-subtle-foreground">{step}</span>
        {label}
      </p>
      <p className="text-2xl font-semibold">
        {value}
        {unit && <span className="ml-1.5 text-sm font-medium text-muted-foreground">{unit}</span>}
      </p>
    </li>
  );
}

function PendingRow({ label, count, href }: { label: string; count: number; href: string }) {
  return (
    <Link
      href={href}
      className="group flex items-center justify-between gap-3 rounded-md px-3 py-2.5 transition-colors hover:bg-muted"
    >
      <span className="text-sm text-ink-2">{label}</span>
      <span className="flex items-center gap-2">
        <span
          className={cn(
            'tabular min-w-7 rounded-md px-2 py-0.5 text-center text-sm font-semibold',
            count > 0 ? 'bg-brand-soft text-brand-strong' : 'text-subtle-foreground',
          )}
        >
          {count}
        </span>
        <ArrowUpRight
          className="size-3.5 text-subtle-foreground transition-colors group-hover:text-foreground"
          aria-hidden
        />
      </span>
    </Link>
  );
}

function AttentionRow({
  href,
  title,
  code,
  company,
  status,
  meta,
}: {
  href: string;
  title: string;
  code: string;
  company: string;
  status: CaseStatusCode;
  meta: React.ReactNode;
}) {
  return (
    <li>
      <Link
        href={href}
        className="flex items-start justify-between gap-4 px-6 py-3.5 transition-colors hover:bg-muted/50"
      >
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium text-foreground">{title}</span>
          <span className="mt-1 flex items-center gap-2 truncate text-xs text-muted-foreground">
            <span className="code">{code}</span>
            <span className="truncate">{company}</span>
          </span>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-1.5">
          <StatusBadge status={status} variant="plain" />
          <span className="text-2xs text-muted-foreground">{meta}</span>
        </span>
      </Link>
    </li>
  );
}
