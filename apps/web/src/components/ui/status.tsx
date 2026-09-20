'use client';

import {
  CASE_STATUS_LABEL,
  SLA_STATUS_LABEL,
  type CaseStatusCode,
  type SlaStatus,
} from '@nodus/types';
import { AlertTriangle, Check, CircleSlash, Clock } from 'lucide-react';
import { statusShape, type StatusShape } from '@/lib/case-stages';
import { cn } from '@/lib/utils';

// ============================================================================
//  Estado del caso — neutral
// ============================================================================
//
// Los 17 estados no tienen color. El texto dice el estado; la forma del glifo
// dice la etapa (`lib/case-stages.ts`). Turquesa sólo en ejecución, porque ahí
// hay progreso real — y estático: nada palpita.

export function StatusGlyph({ shape, className }: { shape: StatusShape; className?: string }) {
  const base = cn('flex size-3.5 shrink-0 items-center justify-center', className);
  switch (shape) {
    case 'pending':
      return (
        <span className={base} aria-hidden>
          <span className="size-2 rounded-full border-[1.5px] border-subtle-foreground" />
        </span>
      );
    case 'active':
      return (
        <span className={base} aria-hidden>
          <span className="size-2 rounded-full bg-subtle-foreground" />
        </span>
      );
    case 'working':
      return (
        <span className={base} aria-hidden>
          <span className="size-2 rounded-full bg-ink-2" />
        </span>
      );
    case 'live':
      return (
        <span className={base} aria-hidden>
          <span className="size-2 rounded-full bg-brand ring-2 ring-brand/20" />
        </span>
      );
    case 'done':
      return (
        <span className={base} aria-hidden>
          <span className="flex size-3.5 items-center justify-center rounded-full bg-foreground text-card">
            <Check className="size-2.5" strokeWidth={3} />
          </span>
        </span>
      );
    case 'void':
      return (
        <span className={base} aria-hidden>
          <CircleSlash className="size-3.5 text-subtle-foreground" strokeWidth={2} />
        </span>
      );
  }
}

export function StatusBadge({
  status,
  variant = 'plain',
  className,
}: {
  status: CaseStatusCode;
  /** `plain`: glifo + texto (tablas, listas). `pill`: con borde (cabecera del caso, diálogos). */
  variant?: 'pill' | 'plain';
  className?: string;
}) {
  const shape = statusShape(status);

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap',
        shape === 'void' ? 'text-muted-foreground' : 'text-ink-2',
        variant === 'pill'
          ? 'h-6 rounded-xs border border-border bg-card pl-1.5 pr-2 text-body-sm font-medium'
          : 'text-body-sm',
        className,
      )}
    >
      <StatusGlyph shape={shape} />
      {CASE_STATUS_LABEL[status] ?? status}
    </span>
  );
}

/** Alias histórico. */
export const CaseStatusBadge = StatusBadge;

// ============================================================================
//  SLA — semántico, nunca color solo
// ============================================================================

const SLA_TEXT: Record<SlaStatus, string> = {
  ON_TRACK: 'text-ink-2',
  AT_RISK: 'text-warning',
  OVERDUE: 'text-danger',
  COMPLETED: 'text-muted-foreground',
  CANCELLED: 'text-muted-foreground',
};

function SlaGlyph({ status }: { status: SlaStatus }) {
  switch (status) {
    case 'ON_TRACK':
      return <span className="size-1.5 rounded-full bg-success" />;
    case 'AT_RISK':
      return <Clock className="size-3.5" strokeWidth={2} />;
    case 'OVERDUE':
      return <AlertTriangle className="size-3.5" strokeWidth={2} />;
    default:
      return <Check className="size-3.5" strokeWidth={2} />;
  }
}

export function SlaIndicator({
  status,
  percent,
  deadline,
  showBar = false,
  className,
}: {
  status: SlaStatus | null | undefined;
  percent?: number | null;
  deadline?: string | null;
  showBar?: boolean;
  className?: string;
}) {
  if (!status) {
    return <span className={cn('text-body-sm text-muted-foreground', className)}>Sin reloj</span>;
  }

  const open = status === 'ON_TRACK' || status === 'AT_RISK' || status === 'OVERDUE';
  const pct = typeof percent === 'number' ? Math.round(percent) : null;

  return (
    <span className={cn('inline-flex min-w-0 flex-col gap-1', className)}>
      <span
        className={cn(
          'inline-flex items-center gap-1.5 whitespace-nowrap text-body-sm font-medium',
          SLA_TEXT[status],
        )}
      >
        <span className="flex size-3.5 items-center justify-center" aria-hidden>
          <SlaGlyph status={status} />
        </span>
        {SLA_STATUS_LABEL[status]}
        {open && pct !== null && (
          <span className="tabular font-normal text-muted-foreground">{pct}%</span>
        )}
      </span>

      {showBar && open && pct !== null && <SlaBar status={status} percent={pct} />}

      {deadline && (
        <span className="whitespace-nowrap pl-5 text-caption text-muted-foreground">
          {deadline}
        </span>
      )}
    </span>
  );
}

/** Consumo del SLA: pista gris, relleno según urgencia. */
export function SlaBar({ status, percent }: { status: SlaStatus; percent: number }) {
  return (
    <span className="block h-1 w-full min-w-16 overflow-hidden rounded-full bg-muted">
      <span
        className={cn(
          'block h-full rounded-full',
          status === 'OVERDUE' ? 'bg-danger' : status === 'AT_RISK' ? 'bg-warning' : 'bg-success',
        )}
        style={{ width: `${Math.max(3, Math.min(100, percent))}%` }}
      />
    </span>
  );
}

/** Alias histórico. */
export const SlaBadge = SlaIndicator;
