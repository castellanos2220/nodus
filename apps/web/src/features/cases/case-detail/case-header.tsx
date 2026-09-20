'use client';

import Link from 'next/link';
import { AlertTriangle, EyeOff } from 'lucide-react';
import { cn, formatDateTime, formatRelative } from '@/lib/utils';
import { EntityMark, PersonCell } from '@/components/ui/avatar';
import { SlaIndicator, StatusBadge } from '@/components/ui/status';
import { Tooltip } from '@/components/ui/tooltip';
import type { CaseDetail, StatusHistoryEntry } from '../types';
import { WorkflowRail } from './workflow-rail';

/**
 * Cabecera del Case Workspace, sobre el lienzo (no en una tarjeta).
 *
 * Responde en una mirada: qué caso es, de quién, en qué estado, quién lo lleva,
 * si va a tiempo, cuándo se movió por última vez y dónde está en el recorrido.
 */
export function CaseHeader({
  kase,
  history,
  onOpenWorkflow,
}: {
  kase: CaseDetail;
  history: StatusHistoryEntry[] | undefined;
  onOpenWorkflow: () => void;
}) {
  const redacted = kase.accessLevel === 'REDACTED';
  // El historial viene en orden cronológico: la última entrada llevó el caso a su estado actual.
  const enteredCurrent = history?.[history.length - 1]?.createdAt ?? kase.createdAt;

  return (
    <header className="space-y-5 border-b border-border pb-5">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-caption">
          <span className="code">{kase.code}</span>
          {kase.counts.incidents > 0 && (
            <span className="inline-flex items-center gap-1 font-medium text-danger">
              <AlertTriangle className="size-3.5" aria-hidden />
              {kase.counts.incidents} incidencia{kase.counts.incidents === 1 ? '' : 's'}
            </span>
          )}
          {redacted && (
            <span className="inline-flex items-center gap-1 text-muted-foreground">
              <EyeOff className="size-3.5" aria-hidden /> Vista controlada
            </span>
          )}
        </div>

        <h1 className="max-w-4xl text-display text-foreground">{kase.title}</h1>

        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-body text-ink-2">
          {redacted ? (
            <span className="italic text-muted-foreground">Identidad de la empresa reservada</span>
          ) : (
            <>
              <EntityMark name={kase.company.name} size="xs" />
              <Link
                href={`/companies/${kase.company.id}`}
                className="font-medium text-foreground hover:text-brand-strong"
              >
                {kase.company.name}
              </Link>
            </>
          )}
          <span className="text-muted-foreground">
            · {kase.company.city}, {kase.company.country}
          </span>
        </p>
      </div>

      <dl className="grid grid-cols-2 gap-y-4 lg:grid-cols-4 lg:divide-x lg:divide-border-subtle">
        <Fact label="Estado" first>
          <StatusBadge status={kase.status} />
          <span className="block text-caption text-muted-foreground">
            desde {formatRelative(enteredCurrent)}
          </span>
        </Fact>

        <Fact label="Responsable">
          {kase.leadConsultant ? (
            <PersonCell
              name={kase.leadConsultant.user.fullName}
              secondary={<span className="code">{kase.leadConsultant.code}</span>}
            />
          ) : (
            <span className="text-body-sm text-muted-foreground">Sin asignar</span>
          )}
        </Fact>

        <Fact label="SLA de la etapa">
          {kase.sla ? (
            <div className="max-w-56 space-y-1">
              <SlaIndicator status={kase.sla.status} percent={kase.sla.percentConsumed} showBar />
              <Tooltip content={`${kase.sla.rule.name} · ${formatDateTime(kase.sla.deadline)}`}>
                <span className="block w-fit text-caption text-muted-foreground">
                  {new Date(kase.sla.deadline).getTime() < Date.now() ? 'Venció' : 'Vence'}{' '}
                  {formatRelative(kase.sla.deadline)}
                </span>
              </Tooltip>
            </div>
          ) : (
            <span className="text-body-sm text-muted-foreground">Sin reloj abierto</span>
          )}
        </Fact>

        <Fact label="Actualizado">
          <Tooltip content={formatDateTime(kase.updatedAt)}>
            <span className="block w-fit text-body-sm text-foreground">
              {formatRelative(kase.updatedAt)}
            </span>
          </Tooltip>
          <span className="block text-caption text-muted-foreground">
            Registrado {formatRelative(kase.createdAt)}
          </span>
        </Fact>
      </dl>

      <WorkflowRail status={kase.status} history={history} onOpen={onOpenWorkflow} />
    </header>
  );
}

function Fact({
  label,
  first,
  children,
}: {
  label: string;
  first?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={cn('min-w-0 space-y-1 pr-4', !first && 'lg:pl-5')}>
      <dt className="text-caption text-muted-foreground">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  );
}
