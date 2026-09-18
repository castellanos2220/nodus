'use client';

import * as React from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CASE_STATUS_LABEL, type CaseStatusCode, type SlaStatus } from '@nodus/types';
import { RefreshCw, Timer } from 'lucide-react';
import { api } from '@/lib/api';
import { cn, formatDateTime, formatRelative } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge, Card, CardContent, CardHeader, CardTitle, EmptyState, Select, Skeleton, TBody, TD, TH, THead, TR, Table } from '@/components/ui/primitives';
import { SlaBadge } from '@/components/ui/status';
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

export function SlaView() {
  const queryClient = useQueryClient();
  const [status, setStatus] = React.useState('');

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
    },
    onError: () =>
      toast.error('No se pudo ejecutar la evaluación', {
        description: 'Se requiere el permiso SLA_MANAGE.',
      }),
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Select
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          className="w-auto min-w-[180px]"
          aria-label="Filtrar por estado de SLA"
        >
          <option value="">Todos los relojes</option>
          <option value="ON_TRACK">En tiempo</option>
          <option value="AT_RISK">En riesgo</option>
          <option value="OVERDUE">Vencidos</option>
          <option value="COMPLETED">Cumplidos</option>
        </Select>

        <Button
          variant="outline"
          size="sm"
          loading={evaluate.isPending}
          onClick={() => evaluate.mutate()}
          title="El worker lo hace cada pocos minutos; esto lo fuerza para la demostración"
        >
          <RefreshCw /> Evaluar ahora
        </Button>
      </div>

      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle>Relojes de SLA</CardTitle>
          <p className="text-xs text-muted-foreground">
            Un reloj por etapa y caso; se cierra al transitar y se abre el de la etapa siguiente
          </p>
        </CardHeader>
        <CardContent className="p-0">
          {instances.isLoading ? (
            <div className="space-y-2 p-5">
              {Array.from({ length: 5 }).map((_, index) => (
                <Skeleton key={index} className="h-11" />
              ))}
            </div>
          ) : instances.data && instances.data.data.length > 0 ? (
            <Table>
              <THead>
                <TR className="hover:bg-transparent">
                  <TH>Caso</TH>
                  <TH>Etapa</TH>
                  <TH>Regla aplicada</TH>
                  <TH>Consumo</TH>
                  <TH>Estado</TH>
                  <TH className="text-right">Vence</TH>
                </TR>
              </THead>
              <TBody>
                {instances.data.data.map((instance) => (
                  <TR key={instance.id}>
                    <TD>
                      <Link href={`/cases/${instance.case.id}`} className="group block max-w-[240px]">
                        <span className="block truncate text-sm group-hover:underline">
                          {instance.case.title}
                        </span>
                        <span className="font-mono text-2xs text-muted-foreground">
                          {instance.case.code}
                        </span>
                      </Link>
                    </TD>
                    <TD className="text-xs">
                      {CASE_STATUS_LABEL[instance.stage as CaseStatusCode] ?? instance.stage}
                    </TD>
                    <TD className="max-w-[200px]">
                      <span className="block truncate text-xs">{instance.rule.name}</span>
                      <span className="font-mono text-2xs text-muted-foreground">
                        {instance.rule.durationHours} h
                      </span>
                    </TD>
                    <TD className="w-32">
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                        <div
                          className={cn(
                            'h-full rounded-full',
                            instance.status === 'OVERDUE'
                              ? 'bg-destructive'
                              : instance.status === 'AT_RISK'
                                ? 'bg-warning'
                                : 'bg-success',
                          )}
                          style={{ width: `${Math.min(100, instance.percentConsumed)}%` }}
                        />
                      </div>
                      <span className="mt-0.5 block font-mono text-2xs text-muted-foreground">
                        {Math.round(instance.percentConsumed)}%
                      </span>
                    </TD>
                    <TD>
                      <SlaBadge status={instance.status} />
                      {instance.escalated && (
                        <Badge tone="rose" className="ml-1">
                          escalado
                        </Badge>
                      )}
                      {instance.alerts.length > 0 && (
                        <span className="mt-0.5 block text-2xs text-muted-foreground">
                          {instance.alerts.length} alerta{instance.alerts.length === 1 ? '' : 's'}
                        </span>
                      )}
                    </TD>
                    <TD className="whitespace-nowrap text-right">
                      <span className="block text-xs">{formatDateTime(instance.deadline)}</span>
                      <span className="text-2xs text-muted-foreground">
                        {formatRelative(instance.deadline)}
                      </span>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          ) : (
            <EmptyState icon={<Timer className="size-9" />} title="No hay relojes que mostrar" />
          )}
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle>Reglas parametrizadas</CardTitle>
          <p className="text-xs text-muted-foreground">
            Gana la regla más específica: a igual etapa, la que más dimensiones coincidentes tenga
          </p>
        </CardHeader>
        <CardContent className="p-0">
          {rules.data && rules.data.length > 0 ? (
            <Table>
              <THead>
                <TR className="hover:bg-transparent">
                  <TH>Regla</TH>
                  <TH>Etapa</TH>
                  <TH>Dimensiones</TH>
                  <TH className="text-right">Duración</TH>
                  <TH className="text-right">Aviso</TH>
                  <TH className="text-right">Escalamiento</TH>
                </TR>
              </THead>
              <TBody>
                {rules.data.map((rule) => (
                  <TR key={rule.id}>
                    <TD>
                      <span className="block text-sm">{rule.name}</span>
                      <span className="font-mono text-2xs text-muted-foreground">{rule.code}</span>
                    </TD>
                    <TD className="text-xs">
                      {CASE_STATUS_LABEL[rule.stage as CaseStatusCode] ?? rule.stage}
                    </TD>
                    <TD>
                      <div className="flex flex-wrap gap-1">
                        {rule.complexityCode && (
                          <Badge tone="violet">{rule.complexityCode.toLowerCase()}</Badge>
                        )}
                        {rule.priorityCode && (
                          <Badge tone="amber">urgencia {rule.priorityCode.toLowerCase()}</Badge>
                        )}
                        {!rule.complexityCode && !rule.priorityCode && (
                          <span className="text-2xs text-muted-foreground">general</span>
                        )}
                      </div>
                    </TD>
                    <TD className="text-right font-mono text-xs">{rule.durationHours} h</TD>
                    <TD className="text-right font-mono text-xs text-muted-foreground">
                      {rule.warningThresholdPercent}%
                    </TD>
                    <TD className="text-right font-mono text-xs text-muted-foreground">
                      {rule.escalationAfterHours !== null ? `+${rule.escalationAfterHours} h` : '—'}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          ) : (
            <EmptyState title="Sin reglas configuradas" />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
