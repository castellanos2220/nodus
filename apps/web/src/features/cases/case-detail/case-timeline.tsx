'use client';

import { CASE_STATUS_LABEL } from '@nodus/types';
import { ArrowRight, Bot, Hourglass } from 'lucide-react';
import { statusShape } from '@/lib/case-stages';
import { cn, formatDateTime, formatRelative } from '@/lib/utils';
import { UserAvatar } from '@/components/ui/avatar';
import { EmptyState } from '@/components/ui/primitives';
import { StatusBadge } from '@/components/ui/status';
import type { StatusHistoryEntry } from '../types';

/**
 * Recorrido del caso por los estados, del más reciente al más antiguo.
 *
 * Cada paso muestra la transición ejecutada, quién la ejecutó (o si fue el
 * sistema), la nota registrada y cuánto tiempo pasó el caso en el estado
 * anterior — la base de los indicadores de ciclo.
 */
export function CaseTimeline({ entries }: { entries: StatusHistoryEntry[] }) {
  if (entries.length === 0) {
    return <EmptyState title="Sin transiciones registradas todavía" />;
  }

  const ordered = [...entries].reverse();

  return (
    <ol className="relative">
      {ordered.map((entry, index) => {
        const latest = index === 0;
        const last = index === ordered.length - 1;
        const shape = statusShape(entry.newStatus);

        return (
          <li key={entry.id} className="relative flex gap-4 pb-7 last:pb-0">
            {/* Rail vertical */}
            {!last && (
              <span
                className="absolute left-[11px] top-7 h-[calc(100%-1.75rem)] w-px bg-border"
                aria-hidden
              />
            )}

            <span
              className={cn(
                'relative mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border bg-card',
                latest ? 'border-brand' : 'border-border-strong',
              )}
              aria-hidden
            >
              <span
                className={cn(
                  'size-2 rounded-full',
                  latest
                    ? shape === 'void'
                      ? 'bg-subtle-foreground'
                      : 'bg-brand'
                    : entry.origin === 'SYSTEM'
                      ? 'bg-subtle-foreground'
                      : 'bg-ink-2',
                )}
              />
            </span>

            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  {entry.previousStatus && (
                    <>
                      <span className="text-xs text-muted-foreground">
                        {CASE_STATUS_LABEL[entry.previousStatus]}
                      </span>
                      <ArrowRight className="size-3 text-subtle-foreground" aria-hidden />
                    </>
                  )}
                  <StatusBadge status={entry.newStatus} variant={latest ? 'pill' : 'plain'} />
                </div>
                <time
                  className="shrink-0 text-xs text-muted-foreground"
                  dateTime={entry.createdAt}
                  title={formatDateTime(entry.createdAt)}
                >
                  {formatRelative(entry.createdAt)}
                </time>
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
                {entry.origin === 'SYSTEM' ? (
                  <span className="inline-flex items-center gap-1.5">
                    <Bot className="size-3.5" aria-hidden /> Sistema
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-ink-2">
                    <UserAvatar name={entry.actor?.fullName ?? 'Usuario'} size="xs" />
                    {entry.actor?.fullName ?? '—'}
                  </span>
                )}
                <span className="code">{entry.transitionCode}</span>
                {entry.hoursInPreviousStatus && (
                  <span className="inline-flex items-center gap-1">
                    <Hourglass className="size-3" aria-hidden />
                    {formatDuration(Number(entry.hoursInPreviousStatus))} en el estado anterior
                  </span>
                )}
              </div>

              {entry.note && (
                <p className="max-w-prose rounded-md border border-border bg-background px-3.5 py-2.5 text-sm leading-relaxed text-ink-2">
                  {entry.note}
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function formatDuration(hours: number): string {
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))} min`;
  if (hours < 48) return `${hours.toFixed(1)} h`;
  return `${(hours / 24).toFixed(1)} días`;
}
