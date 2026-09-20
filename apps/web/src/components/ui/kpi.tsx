import { AlertTriangle, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Indicadores: etiqueta, cifra y contexto. El color aparece sólo si hay una
 * razón semántica (`tone`), y lo lleva una señal con icono — nunca la cifra,
 * el fondo ni un icono decorativo.
 */

export type KpiTone = 'default' | 'warning' | 'danger';

export interface KpiProps {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  tone?: KpiTone;
  /** Texto de la señal semántica (sólo si `tone` ≠ default). */
  signal?: string;
  /** Proporción 0–100 (en turquesa). */
  meter?: number | null;
  className?: string;
}

export function Kpi({ label, value, hint, tone = 'default', signal, meter, className }: KpiProps) {
  return (
    <div className={cn('flex min-w-0 flex-col gap-2 p-5', className)}>
      <p className="truncate text-label text-muted-foreground">{label}</p>

      <p className="text-kpi text-foreground">{value}</p>

      {typeof meter === 'number' && (
        <div className="h-1 w-full overflow-hidden rounded-full bg-muted" aria-hidden>
          <div
            className="h-full rounded-full bg-brand"
            style={{ width: `${Math.max(2, Math.min(100, meter))}%` }}
          />
        </div>
      )}

      <div className="flex min-h-4 flex-wrap items-center gap-x-2 gap-y-1 text-caption">
        {tone !== 'default' && signal && (
          <span
            className={cn(
              'inline-flex items-center gap-1 font-medium',
              tone === 'danger' ? 'text-danger' : 'text-warning',
            )}
          >
            {tone === 'danger' ? (
              <AlertTriangle className="size-3.5" strokeWidth={2} aria-hidden />
            ) : (
              <Clock className="size-3.5" strokeWidth={2} aria-hidden />
            )}
            {signal}
          </span>
        )}
        {hint && <span className="text-muted-foreground">{hint}</span>}
      </div>
    </div>
  );
}

/**
 * Tira de indicadores: una superficie dividida por líneas de 1px (`gap-px` deja
 * ver el color del borde). Se lee como un bloque, no como tarjetas sueltas.
 */
export function KpiStrip({
  children,
  columns = 4,
  className,
}: {
  children: React.ReactNode;
  columns?: 2 | 3 | 4;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'grid gap-px overflow-hidden rounded-md border border-border bg-border',
        '[&>*]:bg-card',
        columns === 4 && 'sm:grid-cols-2 xl:grid-cols-4',
        columns === 3 && 'sm:grid-cols-3',
        columns === 2 && 'sm:grid-cols-2',
        className,
      )}
    >
      {children}
    </div>
  );
}
