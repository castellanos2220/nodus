'use client';

import * as React from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CASE_STATUS_LABEL, type CaseStatusCode, type SlaStatus } from '@nodus/types';
import { RefreshCw, ShieldAlert, Timer } from 'lucide-react';
import { api } from '@/lib/api';
import { formatDateTime, formatRelative } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Badge,
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  Skeleton,
  TBody,
  TD,
  TH,
  THead,
  TR,
  Table,
} from '@/components/ui/primitives';
import { FilterBar } from '@/components/ui/filter-bar';
import { Kpi, KpiStrip } from '@/components/ui/kpi';
import { SegmentedControl } from '@/components/ui/segmented';
import { SlaBar, SlaIndicator } from '@/components/ui/status';
import type { Paginated } from '@/features/cases/types';

interface SlaInstanceRow {
  id: string;
  stage: string;
  startedAt: string;
  deadline: string;
  completedAt: string | null;
  status: SlaStatus;
  percentConsumed: number;
  escalated: boolean;
  case: { id: string; code: string; title: string; status: CaseStatusCode };
  rule: { code: string; name: string; durationHours: number };
  alerts: Array<{ id: string; kind: string; message: string; createdAt: string }>;
}

interface SlaRuleRow {
  id: string;
  code: string;
  name: string;
  stage: string;
  durationHours: number;
  warningThresholdPercent: number;
  escalationAfterHours: number | null;
  complexityCode: string | null;
  priorityCode: string | null;
  isActive: boolean;
}

/** Subconjunto de los KPIs del dashboard que resume el estado de los relojes. */
interface SlaSummary {
  overdueSlas: number;
  atRiskSlas: number;
  slaCompliancePercent: number | null;
}

type StatusFilter = '' | 'ON_TRACK' | 'AT_RISK' | 'OVERDUE' | 'COMPLETED';

const FILTERS: Array<{ value: StatusFilter; label: string }> = [
  { value: '', label: 'Todos' },
  { value: 'ON_TRACK', label: 'En tiempo' },
  { value: 'AT_RISK', label: 'En riesgo' },
  { value: 'OVERDUE', label: 'Vencidos' },
  { value: 'COMPLETED', label: 'Cumplidos' },
];

export function SlaView() {
  const queryClient = useQueryClient();
  const [status, setStatus] = React.useState<StatusFilter>('');

  const summary = useQuery({
    queryKey: ['dashboard', 'kpis'],
    queryFn: () => api.get<SlaSummary>('/dashboard/kpis'),
  });

  const instances = useQuery({
    queryKey: ['sla', 'instances', status],
    queryFn: () =>
      api.get<Paginated<SlaInstanceRow>>('/sla', {
        status: status || undefined,
        pageSize: 50,
      }),
  });

  const rules = useQuery({
    queryKey: ['sla', 'rules'],
    queryFn: () => api.get<SlaRuleRow[]>('/sla/rules'),
  });

  const evaluate = useMutation({
    mutationFn: () => api.patch<{ eventsGenerated: number }>('/sla/evaluate'),
    onSuccess: (result) => {
      toast.success('Evaluación de SLA ejecutada', {
        description:
          result.eventsGenerated > 0
            ? `${result.eventsGenerated} evento(s) generado(s): se emitieron alertas.`
            : 'Ningún reloj cambió de estado en esta pasada.',
      });
      void queryClient.invalidateQueries({ queryKey: ['sla'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: () =>
      toast.error('No se pudo ejecutar la evaluación', {
        description: 'Se requiere el permiso SLA_MANAGE.',
      }),
  });

  return (
    <div className="space-y-8">
      {summary.data && (
        <KpiStrip columns={3}>
          <Kpi
            label="Relojes vencidos"
            value={summary.data.overdueSlas}
            tone={summary.data.overdueSlas > 0 ? 'danger' : 'default'}
            signal="Intervención inmediata"
            hint={summary.data.overdueSlas > 0 ? undefined : 'Ningún reloj fuera de plazo'}
          />
          <Kpi
            label="Relojes en riesgo"
            value={summary.data.atRiskSlas}
            tone={summary.data.atRiskSlas > 0 ? 'warning' : 'default'}
            signal="Superaron el umbral de aviso"
            hint={summary.data.atRiskSlas > 0 ? undefined : 'Sin alertas preventivas'}
          />
          <Kpi
            label="Cumplimiento histórico"
            value={
              summary.data.slaCompliancePercent === null
                ? '—'
                : `${summary.data.slaCompliancePercent}%`
            }
            meter={summary.data.slaCompliancePercent}
            hint="Relojes cerrados dentro de plazo"
          />
        </KpiStrip>
      )}

      <section className="space-y-4">
        <FilterBar
          trailing={
            <Button
              variant="secondary"
              size="sm"
              loading={evaluate.isPending}
              onClick={() => evaluate.mutate()}
              title="El worker lo hace cada pocos minutos; esto lo fuerza para la demostración"
            >
              <RefreshCw /> Evaluar ahora
            </Button>
          }
        >
          <SegmentedControl
            options={FILTERS}
            value={status}
            onValueChange={setStatus}
            layoutId="sla-filter"
            ariaLabel="Filtrar por estado de SLA"
          />
        </FilterBar>

        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle>Relojes de SLA</CardTitle>
            <CardDescription>
              Un reloj por etapa y caso; se cierra al transitar y se abre el de la etapa siguiente
            </CardDescription>
          </CardHeader>
          {instances.isLoading ? (
            <div className="space-y-3 p-6 pt-0">
              {Array.from({ length: 5 }).map((_, index) => (
                <Skeleton key={index} className="h-12" />
              ))}
            </div>
          ) : instances.data && instances.data.data.length > 0 ? (
            <Table>
              <THead>
                <tr>
                  <TH>Caso</TH>
                  <TH>Etapa</TH>
                  <TH>Regla aplicada</TH>
                  <TH className="w-40">Consumo</TH>
                  <TH>Estado</TH>
                  <TH className="text-right">Vence</TH>
                </tr>
              </THead>
              <TBody>
                {instances.data.data.map((instance) => {
                  const open =
                    instance.status === 'ON_TRACK' ||
                    instance.status === 'AT_RISK' ||
                    instance.status === 'OVERDUE';

                  return (
                    <TR key={instance.id}>
                      <TD>
                        <Link
                          href={`/cases/${instance.case.id}`}
                          className="group block max-w-[260px]"
                        >
                          <span className="block truncate text-sm font-medium group-hover:text-brand-strong">
                            {instance.case.title}
                          </span>
                          <span className="code">{instance.case.code}</span>
                        </Link>
                      </TD>
                      <TD className="text-sm text-ink-2">
                        {CASE_STATUS_LABEL[instance.stage as CaseStatusCode] ?? instance.stage}
                      </TD>
                      <TD className="max-w-[220px]">
                        <span className="block truncate text-sm text-ink-2">
                          {instance.rule.name}
                        </span>
                        <span className="tabular text-xs text-muted-foreground">
                          {instance.rule.durationHours} h
                        </span>
                      </TD>
                      <TD className="w-40">
                        {open ? (
                          <span className="flex items-center gap-2">
                            <SlaBar status={instance.status} percent={instance.percentConsumed} />
                            <span className="tabular w-9 shrink-0 text-right text-xs text-muted-foreground">
                              {Math.round(instance.percentConsumed)}%
                            </span>
                          </span>
                        ) : (
                          <span className="text-xs text-subtle-foreground">—</span>
                        )}
                      </TD>
                      <TD>
                        <span className="flex flex-wrap items-center gap-2">
                          <SlaIndicator status={instance.status} />
                          {instance.escalated && (
                            <Badge tone="danger">
                              <ShieldAlert className="size-3" aria-hidden /> Escalado
                            </Badge>
                          )}
                        </span>
                        {instance.alerts.length > 0 && (
                          <span className="mt-1 block text-xs text-muted-foreground">
                            {instance.alerts.length} alerta{instance.alerts.length === 1 ? '' : 's'}
                          </span>
                        )}
                      </TD>
                      <TD className="whitespace-nowrap text-right">
                        <span className="block text-xs text-ink-2">
                          {formatDateTime(instance.deadline)}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatRelative(instance.deadline)}
                        </span>
                      </TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          ) : (
            <EmptyState icon={<Timer />} title="No hay relojes que mostrar" />
          )}
        </Card>
      </section>

      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle>Reglas parametrizadas</CardTitle>
          <CardDescription>
            Gana la regla más específica: a igual etapa, la que más dimensiones coincidentes tenga
          </CardDescription>
        </CardHeader>
        {rules.data && rules.data.length > 0 ? (
          <Table>
            <THead>
              <tr>
                <TH>Regla</TH>
                <TH>Etapa</TH>
                <TH>Dimensiones</TH>
                <TH className="text-right">Duración</TH>
                <TH className="text-right">Aviso</TH>
                <TH className="text-right">Escalamiento</TH>
              </tr>
            </THead>
            <TBody>
              {rules.data.map((rule) => (
                <TR key={rule.id}>
                  <TD>
                    <span className="block text-sm">{rule.name}</span>
                    <span className="code">{rule.code}</span>
                  </TD>
                  <TD className="text-sm text-ink-2">
                    {CASE_STATUS_LABEL[rule.stage as CaseStatusCode] ?? rule.stage}
                  </TD>
                  <TD>
                    <div className="flex flex-wrap gap-1">
                      {rule.complexityCode && (
                        <Badge tone="outline">
                          Complejidad {rule.complexityCode.toLowerCase()}
                        </Badge>
                      )}
                      {rule.priorityCode && (
                        <Badge tone="outline">Urgencia {rule.priorityCode.toLowerCase()}</Badge>
                      )}
                      {!rule.complexityCode && !rule.priorityCode && (
                        <span className="text-xs text-muted-foreground">General</span>
                      )}
                    </div>
                  </TD>
                  <TD className="tabular text-right text-sm font-medium">{rule.durationHours} h</TD>
                  <TD className="tabular text-right text-xs text-muted-foreground">
                    {rule.warningThresholdPercent}%
                  </TD>
                  <TD className="tabular text-right text-xs text-muted-foreground">
                    {rule.escalationAfterHours !== null ? `+${rule.escalationAfterHours} h` : '—'}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        ) : (
          <EmptyState title="Sin reglas configuradas" />
        )}
      </Card>
    </div>
  );
}
