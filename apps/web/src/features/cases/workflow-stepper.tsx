'use client';

import { CASE_STATUS_LABEL, type CaseStatusCode } from '@nodus/types';
import { Check, CircleSlash } from 'lucide-react';
import { CASE_STAGES, stageIndex } from '@/lib/case-stages';
import { cn } from '@/lib/utils';
import type { StatusHistoryEntry } from './types';

type StageState = 'done' | 'current' | 'upcoming' | 'skipped';

/**
 * Ciclo de vida del caso como stepper horizontal de 7 etapas.
 *
 * Cada etapa lista sus estados; los que el caso ya recorrió llevan check, el
 * actual un punto turquesa. El recorrido sale del historial de estados real
 * (`/cases/:id/status-history`), no de una suposición: un caso que volvió a
 * «Ajustes de propuesta» lo muestra así.
 *
 * Un caso «Cerrado sin contratación» marca como omitidas las etapas que nunca
 * alcanzó, para que se lea de un vistazo dónde se detuvo.
 */
export function WorkflowStepper({
  status,
  history,
}: {
  status: CaseStatusCode;
  history: StatusHistoryEntry[] | undefined;
}) {
  const visited = new Set<CaseStatusCode>([status]);
  for (const entry of history ?? []) {
    visited.add(entry.newStatus);
    if (entry.previousStatus) visited.add(entry.previousStatus);
  }

  const current = stageIndex(status);
  const closedWithout = status === 'CERRADO_SIN_CONTRATACION';
  // Un caso cerrado con éxito no tiene etapa «en curso»: el ciclo terminó.
  const finished = status === 'CERRADO';

  // Última etapa alcanzada antes del cierre sin contratación.
  const reached = closedWithout
    ? Math.max(
        0,
        ...[...visited]
          .filter((code) => code !== 'CERRADO_SIN_CONTRATACION')
          .map((code) => stageIndex(code)),
      )
    : current;

  const stateOf = (index: number): StageState => {
    if (index === current) return finished ? 'done' : 'current';
    if (closedWithout && index > reached) return 'skipped';
    return index < current ? 'done' : 'upcoming';
  };

  return (
    <div className="scroll-x">
      <ol className="grid min-w-[880px] grid-cols-7">
        {CASE_STAGES.map((stage, index) => {
          const state = stateOf(index);
          const last = index === CASE_STAGES.length - 1;
          // El tramo hacia la etapa siguiente está «recorrido» si la siguiente
          // ya se alcanzó (o es la actual).
          const nextState = last ? null : stateOf(index + 1);
          const segmentDone = nextState === 'done' || nextState === 'current';

          return (
            <li
              key={stage.id}
              className="relative pr-4"
              aria-current={index === current ? 'step' : undefined}
            >
              {/* Nodo + conector */}
              <div className="flex items-center">
                <StageNode state={state} void={state === 'current' && closedWithout} />
                {!last && (
                  <span
                    className={cn(
                      'ml-2 flex-1',
                      // Tramo recorrido: 2px turquesa (1px se lee como gris).
                      segmentDone
                        ? 'h-0.5 rounded-full bg-brand'
                        : state === 'skipped' || nextState === 'skipped'
                          ? 'h-px bg-[repeating-linear-gradient(90deg,hsl(var(--border-strong))_0_4px,transparent_4px_8px)]'
                          : 'h-px bg-border',
                    )}
                    aria-hidden
                  />
                )}
              </div>

              <p
                className={cn(
                  'mt-3 text-label',
                  state === 'current' || index === current
                    ? 'text-foreground'
                    : state === 'done'
                      ? 'text-ink-2'
                      : 'text-subtle-foreground',
                )}
              >
                {stage.label}
              </p>

              <ul className="mt-2 space-y-1">
                {stage.statuses.map((code) => {
                  const isCurrent = code === status;
                  const wasVisited = visited.has(code) && !isCurrent;

                  return (
                    <li
                      key={code}
                      className={cn(
                        'flex items-center gap-1.5 text-caption',
                        isCurrent
                          ? 'font-medium text-foreground'
                          : wasVisited
                            ? 'text-muted-foreground'
                            : 'text-subtle-foreground/80',
                      )}
                    >
                      <span
                        className="flex size-3 shrink-0 items-center justify-center"
                        aria-hidden
                      >
                        {isCurrent && finished ? (
                          <Check className="size-3 text-foreground" strokeWidth={3} />
                        ) : isCurrent ? (
                          <span
                            className={cn(
                              'size-1.5 rounded-full',
                              closedWithout ? 'bg-subtle-foreground' : 'bg-brand',
                            )}
                          />
                        ) : wasVisited ? (
                          <Check className="size-3 text-ink-2" strokeWidth={2.5} />
                        ) : (
                          <span className="size-1 rounded-full bg-border-strong" />
                        )}
                      </span>
                      <span className="truncate">{CASE_STATUS_LABEL[code]}</span>
                    </li>
                  );
                })}
              </ul>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function StageNode({ state, void: isVoid }: { state: StageState; void: boolean }) {
  if (state === 'done') {
    return (
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-foreground text-card">
        <Check className="size-3.5" strokeWidth={2.75} aria-hidden />
      </span>
    );
  }

  if (state === 'current') {
    return isVoid ? (
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-border-strong bg-card text-muted-foreground">
        <CircleSlash className="size-3.5" strokeWidth={2} aria-hidden />
      </span>
    ) : (
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full border-2 border-brand bg-card">
        <span className="size-2 rounded-full bg-brand" />
      </span>
    );
  }

  return (
    <span
      className={cn(
        'size-6 shrink-0 rounded-full border bg-card',
        state === 'skipped' ? 'border-dashed border-border-strong' : 'border-border-strong',
      )}
      aria-hidden
    />
  );
}
