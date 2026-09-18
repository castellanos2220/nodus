'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import type { CaseStatusCode, Role } from '@nodus/types';
import { CASE_STATUS_ORDER } from '@nodus/types';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileStack,
  FolderKanban,
  TrendingUp,
  UserCheck,
  Users,
} from 'lucide-react';
import { api } from '@/lib/api';
import { cn, formatRelative } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle, EmptyState, Skeleton } from '@/components/ui/primitives';
import { CaseStatusBadge } from '@/components/ui/status';

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
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <Skeleton key={index} className="h-[104px]" />
        ))}
      </div>
    );
  }

  const isAdvisory = role === 'ADVISORY' || role === 'SUPER_ADMIN';

  return (
    <div className="space-y-6">
      {/* --- Indicadores principales -------------------------------------- */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          label="Casos activos"
          value={kpis.activeCases}
          icon={FolderKanban}
          hint={`${kpis.totalCases} en total`}
        />
        <Kpi
          label="Casos críticos"
          value={kpis.criticalCases}
          icon={AlertTriangle}
          tone={kpis.criticalCases > 0 ? 'warning' : undefined}
          hint="Impacto alto/crítico o SLA vencido"
        />
        <Kpi
          label="SLA vencidos"
          value={kpis.overdueSlas}
          icon={Clock}
          tone={kpis.overdueSlas > 0 ? 'danger' : undefined}
          hint={`${kpis.atRiskSlas} en riesgo`}
        />
        <Kpi
          label="Casos cerrados"
          value={kpis.closedCases}
          icon={CheckCircle2}
          tone="success"
          hint={`${kpis.closedWithoutContracting} sin contratación`}
        />
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          label="Cumplimiento de SLA"
          value={kpis.slaCompliancePercent === null ? '—' : `${kpis.slaCompliancePercent}%`}
          icon={TrendingUp}
          hint="Instancias cerradas dentro de plazo"
        />
        <Kpi
          label="Conversión de propuestas"
          value={
            kpis.proposalConversionPercent === null ? '—' : `${kpis.proposalConversionPercent}%`
          }
          icon={FileStack}
          hint={`${kpis.proposalsAccepted} de ${kpis.proposalsSent} enviadas`}
        />
        <Kpi
          label="Consultores habilitados"
          value={kpis.activeConsultants}
          icon={Users}
          hint="Pueden ver oportunidades y postularse"
        />
        <Kpi
          label="Satisfacción media"
          value={
            kpis.averageCustomerSatisfaction === null
              ? '—'
              : `${kpis.averageCustomerSatisfaction} / 5`
          }
          icon={UserCheck}
          hint="Encuestas de cierre registradas"
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        {/* --- Distribución por estado ------------------------------------ */}
        <Card>
          <CardHeader>
            <CardTitle>Casos por estado</CardTitle>
            <p className="text-xs text-muted-foreground">
              Distribución a lo largo del ciclo de vida
            </p>
          </CardHeader>
          <CardContent className="space-y-2">
            {kpis.casesByStatus
              .filter((row) => row.count > 0)
              .sort((a, b) => CASE_STATUS_ORDER[a.status] - CASE_STATUS_ORDER[b.status])
              .map((row) => {
                const max = Math.max(...kpis.casesByStatus.map((item) => item.count), 1);
                return (
                  <Link
                    key={row.status}
                    href={`/cases?status=${row.status}`}
                    className="flex items-center gap-3 rounded-lg px-1 py-1 transition-colors hover:bg-secondary/50"
                  >
                    <div className="w-44 shrink-0">
                      <CaseStatusBadge status={row.status} />
                    </div>
                    <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-secondary">
                      <div
                        className="h-full rounded-full bg-primary/70"
                        style={{ width: `${(row.count / max) * 100}%` }}
                      />
                    </div>
                    <span className="w-6 shrink-0 text-right font-mono text-xs">{row.count}</span>
                  </Link>
                );
              })}
            {kpis.casesByStatus.every((row) => row.count === 0) && (
              <EmptyState title="Aún no hay casos registrados" />
            )}
          </CardContent>
        </Card>

        {/* --- Tiempos medios --------------------------------------------- */}
        <Card>
          <CardHeader>
            <CardTitle>Tiempos medios por etapa</CardTitle>
            <p className="text-xs text-muted-foreground">
              Calculados sobre el historial de transiciones
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <StageTime label="Hasta clasificación" hours={kpis.avgHoursToClassification} />
            <StageTime label="Hasta envío de propuesta" hours={kpis.avgHoursToProposal} />
            <StageTime label="Hasta cierre" hours={kpis.avgHoursToClosure} />

            {isAdvisory && (
              <div className="space-y-2 border-t border-border pt-4">
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
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* --- Cola de atención --------------------------------------------- */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="size-4 text-destructive" aria-hidden />
              SLA vencido
            </CardTitle>
            <p className="text-xs text-muted-foreground">Requieren intervención inmediata</p>
          </CardHeader>
          <CardContent className="p-0">
            {attention && attention.overdueSla.length > 0 ? (
              <ul className="divide-y divide-border">
                {attention.overdueSla.map((item) => (
                  <li key={item.id}>
                    <Link
                      href={`/cases/${item.id}`}
                      className="block px-5 py-3 transition-colors hover:bg-secondary/40"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{item.title}</p>
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">
                            <span className="font-mono">{item.code}</span> · {item.company.name}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <CaseStatusBadge status={item.status} />
                          {item.sla && (
                            <p className="mt-1 text-2xs text-destructive">
                              venció {formatRelative(item.sla.deadline)}
                            </p>
                          )}
                        </div>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                icon={<CheckCircle2 className="size-8" />}
                title="Ningún SLA vencido"
                description="Todos los relojes activos están dentro de plazo."
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="size-4 text-muted-foreground" aria-hidden />
              Casos estancados
            </CardTitle>
            <p className="text-xs text-muted-foreground">Sin movimiento en más de 14 días</p>
          </CardHeader>
          <CardContent className="p-0">
            {attention && attention.stalled.length > 0 ? (
              <ul className="divide-y divide-border">
                {attention.stalled.map((item) => (
                  <li key={item.id}>
                    <Link
                      href={`/cases/${item.id}`}
                      className="block px-5 py-3 transition-colors hover:bg-secondary/40"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{item.title}</p>
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">
                            <span className="font-mono">{item.code}</span> · {item.company.name}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <CaseStatusBadge status={item.status} />
                          <p className="mt-1 text-2xs text-muted-foreground">
                            {formatRelative(item.updatedAt)}
                          </p>
                        </div>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                icon={<CheckCircle2 className="size-8" />}
                title="Ningún caso estancado"
                description="Todos los casos han tenido movimiento reciente."
              />
            )}
          </CardContent>
        </Card>
      </div>

      <p className="text-center text-2xs text-muted-foreground">
        Indicadores calculados con agregados SQL · actualizados {formatRelative(kpis.generatedAt)}
      </p>
    </div>
  );
}

function Kpi({
  label,
  value,
  icon: Icon,
  hint,
  tone,
}: {
  label: string;
  value: number | string;
  icon: typeof FolderKanban;
  hint?: string;
  tone?: 'success' | 'warning' | 'danger';
}) {
  return (
    <Card>
      <CardContent className="space-y-1.5">
        <div className="flex items-center justify-between">
          <p className="label-caps">{label}</p>
          <Icon
            className={cn(
              'size-4',
              tone === 'danger'
                ? 'text-destructive'
                : tone === 'warning'
                  ? 'text-warning'
                  : tone === 'success'
                    ? 'text-success'
                    : 'text-muted-foreground',
            )}
            aria-hidden
          />
        </div>
        <p
          className={cn(
            'font-mono text-2xl font-semibold tabular-nums',
            tone === 'danger' && 'text-destructive',
            tone === 'warning' && 'text-warning',
          )}
        >
          {value}
        </p>
        {hint && <p className="text-2xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}

function StageTime({ label, hours }: { label: string; hours: number | null }) {
  const display =
    hours === null
      ? '—'
      : hours < 24
        ? `${hours.toFixed(1)} h`
        : `${(hours / 24).toFixed(1)} días`;

  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="font-mono text-sm font-semibold tabular-nums">{display}</span>
    </div>
  );
}

function PendingRow({ label, count, href }: { label: string; count: number; href: string }) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between rounded-lg px-2 py-1.5 transition-colors hover:bg-secondary/60"
    >
      <span className="text-xs text-muted-foreground">{label}</span>
      <span
        className={cn(
          'rounded-md px-1.5 py-0.5 font-mono text-xs font-semibold',
          count > 0 ? 'bg-accent text-accent-foreground' : 'text-muted-foreground',
        )}
      >
        {count}
      </span>
    </Link>
  );
}
