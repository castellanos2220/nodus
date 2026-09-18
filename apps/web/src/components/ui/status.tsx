'use client';

import { CASE_STATUS_LABEL, SLA_STATUS_LABEL, type CaseStatusCode, type SlaStatus } from '@nodus/types';
import { AlertTriangle, CheckCircle2, CircleDot, Clock } from 'lucide-react';
import { Badge, type BadgeProps } from './primitives';
import { cn } from '@/lib/utils';

/**
 * Color por estado del caso.
 *
 * El color no decora: agrupa las etapas del ciclo (entrada, evaluación, bolsa,
 * propuesta, decisión, contratación, ejecución, cierre) para que el estado se
 * reconozca de un vistazo en una tabla de cien filas.
 */
const CASE_TONE: Record<CaseStatusCode, NonNullable<BadgeProps['tone']>> = {
  CREADO: 'slate',
  EN_REVISION: 'amber',
  CLASIFICADO: 'sky',
  EN_POSTULACION: 'indigo',
  ASIGNADO: 'violet',
  PROPUESTA_EN_DISENO: 'violet',
  PROPUESTA_LISTA_PARA_QA: 'amber',
  PROPUESTA_ENVIADA: 'blue',
  EN_DECISION_CLIENTE: 'blue',
  AJUSTES_DE_PROPUESTA: 'orange',
  PROPUESTA_ACEPTADA: 'emerald',
  PENDIENTE_CONTRATACION: 'amber',
  AUTORIZADO_PARA_EJECUCION: 'teal',
  EN_EJECUCION: 'teal',
  LISTO_PARA_CIERRE: 'lime',
  CERRADO: 'emerald',
  CERRADO_SIN_CONTRATACION: 'rose',
};

export function CaseStatusBadge({
  status,
  className,
}: {
  status: CaseStatusCode;
  className?: string;
}) {
  return (
    <Badge tone={CASE_TONE[status] ?? 'neutral'} className={className}>
      {CASE_STATUS_LABEL[status] ?? status}
    </Badge>
  );
}

const SLA_TONE: Record<SlaStatus, NonNullable<BadgeProps['tone']>> = {
  ON_TRACK: 'emerald',
  AT_RISK: 'amber',
  OVERDUE: 'rose',
  COMPLETED: 'slate',
  CANCELLED: 'slate',
};

const SLA_ICON: Record<SlaStatus, typeof Clock> = {
  ON_TRACK: CircleDot,
  AT_RISK: Clock,
  OVERDUE: AlertTriangle,
  COMPLETED: CheckCircle2,
  CANCELLED: CircleDot,
};

export function SlaBadge({
  status,
  percent,
  className,
}: {
  status: SlaStatus | null | undefined;
  percent?: number | null;
  className?: string;
}) {
  if (!status) {
    return <span className={cn('text-xs text-muted-foreground', className)}>Sin SLA activo</span>;
  }

  const Icon = SLA_ICON[status];

  return (
    <Badge tone={SLA_TONE[status]} className={className}>
      <Icon className="size-3" aria-hidden />
      {SLA_STATUS_LABEL[status]}
      {typeof percent === 'number' && status !== 'COMPLETED' && status !== 'CANCELLED' && (
        <span className="font-mono normal-case">{Math.round(percent)}%</span>
      )}
    </Badge>
  );
}

/** Barra de progreso del ciclo de vida del caso. */
export function CaseProgress({ percent }: { percent: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${Math.max(2, Math.min(100, percent))}%` }}
        />
      </div>
      <span className="w-9 shrink-0 text-right font-mono text-2xs text-muted-foreground">
        {percent}%
      </span>
    </div>
  );
}
