'use client';

import type { CaseStatusCode } from '@nodus/types';
import { Check, CircleSlash } from 'lucide-react';
import { CASE_STAGES, stageIndex } from '@/lib/case-stages';
import { cn } from '@/lib/utils';
import type { StatusHistoryEntry } from '../types';

type RailState = 'done' | 'current' | 'upcoming' | 'skipped' | 'void';

/**
 * Recorrido del caso en una sola línea: las 7 etapas, qué ya pasó, dónde está
 * y qué viene. Es un resumen: el detalle por sub-estado, las fechas y el
 * historial viven en la pestaña Workflow, que se abre al pulsarlo.
 */
export function WorkflowRail({
  status,
  history,
  onOpen,
}: {
  status: CaseStatusCode;
  history: StatusHistoryEntry[] | undefined;
  onOpen: () => void;
}) {
  const current = stageIndex(status);
  const finished = status === 'CERRADO';
  const closedWithout = status === 'CERRADO_SIN_CONTRATACION';

  const reached = closedWithout
    ? Math.max(
        0,
        ...(history ?? [])
          .flatMap((entry) => [entry.previousStatus, entry.newStatus])
          .filter(
            (code): code is CaseStatusCode => Boolean(code) && code !== 'CERRADO_SIN_CONTRATACION',
          )
          .map((code) => stageIndex(code)),
      )
    : current;

  const stateOf = (index: number): RailState => {
    if (index === current) return finished ? 'done' : closedWithout ? 'void' : 'current';
    if (closedWithout && index > reached) return 'skipped';
    return index < current ? 'done' : 'upcoming';
  };

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group -mx-2 block w-[calc(100%+1rem)] rounded-sm px-2 py-2 text-left transition-colors duration-fast hover:bg-muted/60"
      aria-label="Ver el detalle del workflow"
    >
      <ol className="flex min-w-0 items-center">
        {CASE_STAGES.map((stage, index) => {
          const state = stateOf(index);
          const last = index === CASE_STAGES.length - 1;
          const next = last ? null : stateOf(index + 1);
          const segmentDone = next === 'done' || next === 'current' || next === 'void';

          return (
            <li
              key={stage.id}
              className={cn('flex min-w-0 items-center', !last && 'flex-1')}
              aria-current={index === current ? 'step' : undefined}
            >
              <span className="flex shrink-0 items-center gap-1.5">
                <RailNode state={state} />
                <span
                  className={cn(
                    'hidden whitespace-nowrap text-body-sm md:inline',
                    state === 'current' || index === current
                      ? 'font-medium text-foreground'
                      : state === 'done'
                        ? 'text-ink-2'
                        : 'text-subtle-foreground',
                  )}
                >
                  {stage.label}
                </span>
              </span>
              {!last && (
                <span
                  className={cn(
                    'mx-2 h-px min-w-3 flex-1',
                    segmentDone ? 'bg-brand' : 'bg-border-strong',
                    (state === 'skipped' || next === 'skipped') &&
                      'bg-transparent bg-[repeating-linear-gradient(90deg,hsl(var(--border-strong))_0_3px,transparent_3px_6px)]',
                  )}
                  aria-hidden
                />
              )}
            </li>
          );
        })}
      </ol>
    </button>
  );
}

function RailNode({ state }: { state: RailState }) {
  switch (state) {
    case 'done':
      return (
        <span className="flex size-4 items-center justify-center rounded-full bg-foreground text-card">
          <Check className="size-2.5" strokeWidth={3} aria-hidden />
        </span>
      );
    case 'current':
      return (
        <span className="flex size-4 items-center justify-center rounded-full border-2 border-brand bg-card">
          <span className="size-1.5 rounded-full bg-brand" />
        </span>
      );
    case 'void':
      return <CircleSlash className="size-4 text-muted-foreground" strokeWidth={2} aria-hidden />;
    case 'skipped':
      return (
        <span className="size-4 rounded-full border border-dashed border-border-strong bg-card" />
      );
    default:
      return <span className="size-4 rounded-full border border-border-strong bg-card" />;
  }
}
