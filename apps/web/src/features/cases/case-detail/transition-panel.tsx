'use client';

import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ROLE_LABEL, type CaseStatusCode, type Role } from '@nodus/types';
import { ArrowRight, Clock, Lock, TriangleAlert } from 'lucide-react';
import { ApiError, api } from '@/lib/api';
import { formatDateTime, formatRelative } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Field, FormError, Select, Textarea } from '@/components/ui/primitives';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { StatusBadge } from '@/components/ui/status';
import { useLookupValues } from '@/features/lookups/use-lookups';
import type { AvailableTransition, CaseDetail } from '../types';

/** Transición tal como la publica el catálogo `GET /workflow/transitions`. */
interface CatalogTransition {
  code: string;
  label: string;
  from: CaseStatusCode;
  to: CaseStatusCode;
  roles: Role[];
  scope: 'ANY' | 'LEAD_CONSULTANT' | 'CLIENT_OWNER' | 'SYSTEM';
}

interface ExecutionBlockers {
  closureBlockers: string[];
}

/**
 * Siguiente paso del caso.
 *
 * Responde siempre a «¿qué sigue?», también cuando el usuario no puede actuar:
 *
 *   - Las acciones propias salen de `availableTransitions`, que el backend
 *     calcula para este usuario ejecutando los mismos guards que aplicaría de
 *     verdad. Las bloqueadas muestran la razón que devuelve el backend.
 *   - Si el paso lo tiene otra persona, se dice quién a partir del catálogo de
 *     transiciones del backend (roles y alcance de cada una) y del responsable o
 *     contacto del caso. La UI no replica reglas: sólo lee el catálogo.
 */
export function NextStepPanel({
  kase,
  enteredCurrentAt,
}: {
  kase: CaseDetail;
  enteredCurrentAt: string;
}) {
  const [active, setActive] = React.useState<AvailableTransition | null>(null);

  const catalog = useQuery({
    queryKey: ['workflow', 'catalog'],
    queryFn: () => api.get<CatalogTransition[]>('/workflow/transitions'),
    staleTime: Infinity,
  });

  // Los bloqueos de cierre técnico viven en el resumen de ejecución.
  const execution = useQuery({
    queryKey: ['case', kase.id, 'execution-summary'],
    queryFn: () => api.get<ExecutionBlockers>(`/cases/${kase.id}/execution-summary`),
    enabled: kase.status === 'EN_EJECUCION',
  });

  const allowed = kase.availableTransitions.filter((transition) => transition.allowed);
  const blocked = kase.availableTransitions.filter((transition) => !transition.allowed);
  const outgoing = (catalog.data ?? []).filter(
    (transition) => transition.from === kase.status && transition.scope !== 'SYSTEM',
  );
  const terminal = catalog.data !== undefined && outgoing.length === 0;
  const waitingOn = allowed.length === 0 ? describeActors(outgoing, kase) : [];
  const closureBlockers = execution.data?.closureBlockers ?? [];

  return (
    <>
      <section className="surface" aria-labelledby="next-step-title">
        <header className="flex items-center justify-between gap-3 border-b border-border px-5 py-3">
          <h2 id="next-step-title" className="text-h3">
            Siguiente paso
          </h2>
          {kase.sla && !terminal && (
            <span
              className="inline-flex items-center gap-1 text-caption text-muted-foreground"
              title={`Plazo de la etapa: ${formatDateTime(kase.sla.deadline)}`}
            >
              <Clock className="size-3.5" aria-hidden />
              {new Date(kase.sla.deadline).getTime() < Date.now() ? 'venció' : 'vence'}{' '}
              {formatRelative(kase.sla.deadline)}
            </span>
          )}
        </header>

        <div className="space-y-4 p-5">
          {allowed.length > 0 && (
            <div className="space-y-2">
              {allowed.map((transition, index) => (
                <Button
                  key={transition.code}
                  // La primera acción disponible es la principal; el resto, secundarias.
                  variant={index === 0 ? 'primary' : 'secondary'}
                  className="w-full justify-between"
                  onClick={() => setActive(transition)}
                  title={transition.description}
                >
                  <span className="truncate">{transition.label}</span>
                  <ArrowRight className="shrink-0" aria-hidden />
                </Button>
              ))}
            </div>
          )}

          {terminal && allowed.length === 0 && (
            <p className="text-body-sm text-ink-2">
              El ciclo del caso terminó
              {kase.closedAt ? ` el ${formatDateTime(kase.closedAt)}` : ''}. No quedan pasos
              pendientes.
            </p>
          )}

          {!terminal && waitingOn.length > 0 && (
            <div className="space-y-2">
              <p className="text-caption text-muted-foreground">Esperando a</p>
              <ul className="space-y-1.5">
                {waitingOn.map((actor) => (
                  <li key={actor.who} className="text-body-sm">
                    <span className="font-medium text-foreground">{actor.who}</span>
                    {actor.name && <span className="text-ink-2"> · {actor.name}</span>}
                    <span className="block text-caption text-muted-foreground">
                      {actor.actions.join(' · ')}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="text-caption text-muted-foreground">
                En este estado desde {formatRelative(enteredCurrentAt)}
              </p>
            </div>
          )}

          {(blocked.length > 0 || closureBlockers.length > 0) && (
            <div className="space-y-2 border-t border-border-subtle pt-4 first:border-t-0 first:pt-0">
              <p className="text-caption text-muted-foreground">Bloqueado</p>
              <ul className="space-y-2.5">
                {blocked.map((transition) => (
                  <li key={transition.code} className="flex gap-2 text-body-sm">
                    <Lock className="mt-0.5 size-3.5 shrink-0 text-subtle-foreground" aria-hidden />
                    <span className="min-w-0">
                      <span className="text-ink-2">{transition.label}</span>
                      {transition.blockedReason && (
                        <span className="block text-caption text-muted-foreground">
                          {transition.blockedReason}
                        </span>
                      )}
                    </span>
                  </li>
                ))}
                {closureBlockers.map((blocker) => (
                  <li key={blocker} className="flex gap-2 text-body-sm text-ink-2">
                    <TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-warning" aria-hidden />
                    {blocker}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </section>

      {active && (
        <TransitionDialog kase={kase} transition={active} onClose={() => setActive(null)} />
      )}
    </>
  );
}

/**
 * Quién puede mover el caso desde su estado actual, agrupado por actor, a
 * partir del catálogo de transiciones del backend.
 */
function describeActors(
  outgoing: CatalogTransition[],
  kase: CaseDetail,
): Array<{ who: string; name: string | null; actions: string[] }> {
  const groups = new Map<string, { who: string; name: string | null; actions: string[] }>();

  for (const transition of outgoing) {
    let who: string;
    let name: string | null = null;

    if (transition.scope === 'CLIENT_OWNER') {
      who = 'Cliente';
      name = kase.contact?.fullName ?? null;
    } else if (transition.scope === 'LEAD_CONSULTANT') {
      who = 'Consultor responsable';
      name = kase.leadConsultant?.user.fullName ?? null;
    } else {
      const roles = transition.roles.filter((role) => role !== 'SUPER_ADMIN');
      who = (roles.length > 0 ? roles : transition.roles)
        .map((role) => (role === 'CONSULTOR' ? 'Consultor responsable' : ROLE_LABEL[role]))
        .join(' o ');
    }

    const group = groups.get(who) ?? { who, name, actions: [] };
    group.actions.push(transition.label);
    groups.set(who, group);
  }

  return [...groups.values()];
}

// ============================================================================
//  Diálogo de ejecución
// ============================================================================

function TransitionDialog({
  kase,
  transition,
  onClose,
}: {
  kase: CaseDetail;
  transition: AvailableTransition;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [note, setNote] = React.useState('');
  const [payload, setPayload] = React.useState<Record<string, unknown>>({});
  const [serverError, setServerError] = React.useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      api.post(`/cases/${kase.id}/transitions`, {
        transition: transition.code,
        note: note.trim() || undefined,
        payload: Object.keys(payload).length > 0 ? payload : undefined,
      }),
    onSuccess: () => {
      toast.success(`${transition.label}: aplicada`, {
        description: `El caso ${kase.code} avanzó a ${transition.toStatus.replace(/_/g, ' ').toLowerCase()}.`,
      });
      // Se invalida todo lo del caso: estado, timeline, SLA, propuesta y KPIs.
      void queryClient.invalidateQueries({ queryKey: ['case', kase.id] });
      void queryClient.invalidateQueries({ queryKey: ['cases'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      onClose();
    },
    onError: (error) => {
      const message =
        error instanceof ApiError ? error.message : 'No se pudo ejecutar la transición.';
      setServerError(message);
      toast.error('La transición fue rechazada', { description: message });
    },
  });

  const form = <TransitionForm kase={kase} transition={transition} onChange={setPayload} />;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent wide={transition.code === 'ASSIGN_CONSULTANT'}>
        <DialogHeader>
          <DialogTitle>{transition.label}</DialogTitle>
          <DialogDescription>{transition.description}</DialogDescription>
          <div className="flex flex-wrap items-center gap-2 pt-2">
            <StatusBadge status={kase.status} variant="pill" />
            <ArrowRight className="size-3.5 text-subtle-foreground" aria-hidden />
            <StatusBadge status={transition.toStatus} variant="pill" />
          </div>
        </DialogHeader>

        <DialogBody className="space-y-5">
          {form}

          <Field
            label="Observación"
            htmlFor="transition-note"
            hint="Queda registrada en el historial del caso y en la bitácora de auditoría."
          >
            <Textarea
              id="transition-note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Contexto de la decisión…"
              rows={3}
            />
          </Field>

          {serverError && <FormError>{serverError}</FormError>}
        </DialogBody>

        <DialogFooter>
          <Button variant="secondary" onClick={onClose} disabled={mutation.isPending}>
            Cancelar
          </Button>
          <Button
            onClick={() => {
              setServerError(null);
              mutation.mutate();
            }}
            loading={mutation.isPending}
          >
            {mutation.isPending ? 'Aplicando…' : transition.label}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
//  Formularios por transición
// ============================================================================

function TransitionForm({
  kase,
  transition,
  onChange,
}: {
  kase: CaseDetail;
  transition: AvailableTransition;
  onChange: (payload: Record<string, unknown>) => void;
}) {
  switch (transition.code) {
    case 'PUBLISH':
      return <PublishForm onChange={onChange} />;
    case 'REJECT_INELIGIBLE':
    case 'REOPEN_EXECUTION':
      return <ReasonForm onChange={onChange} />;
    case 'CLIENT_DECLINE':
      return <DeclineForm onChange={onChange} />;
    case 'CLIENT_REQUEST_ADJUSTMENTS':
      return <AdjustmentsForm onChange={onChange} />;
    case 'TECHNICAL_CLOSURE':
      return <ClosureForm onChange={onChange} />;
    case 'ASSIGN_CONSULTANT':
      return <AssignmentForm caseId={kase.id} onChange={onChange} />;
    default:
      return null;
  }
}

function PublishForm({ onChange }: { onChange: (payload: Record<string, unknown>) => void }) {
  const [days, setDays] = React.useState(7);

  React.useEffect(() => {
    onChange({ applicationWindowDays: days });
  }, [days, onChange]);

  return (
    <Field
      label="Días de ventana de postulación"
      htmlFor="window-days"
      hint="Transcurrido el plazo, el caso deja de aceptar postulaciones nuevas."
      required
    >
      <Select
        id="window-days"
        value={days}
        onChange={(event) => setDays(Number(event.target.value))}
      >
        {[3, 5, 7, 10, 14, 21].map((value) => (
          <option key={value} value={value}>
            {value} días
          </option>
        ))}
      </Select>
    </Field>
  );
}

function ReasonForm({ onChange }: { onChange: (payload: Record<string, unknown>) => void }) {
  const [reason, setReason] = React.useState('');

  React.useEffect(() => {
    onChange({ reason });
  }, [reason, onChange]);

  return (
    <Field
      label="Motivo"
      htmlFor="reason"
      required
      hint="Mínimo 10 caracteres. Queda registrado de forma permanente."
      error={reason.length > 0 && reason.trim().length < 10 ? 'Demasiado breve' : undefined}
    >
      <Textarea
        id="reason"
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        rows={3}
        placeholder="Explique la decisión…"
      />
    </Field>
  );
}

function DeclineForm({ onChange }: { onChange: (payload: Record<string, unknown>) => void }) {
  const { values } = useLookupValues('MOTIVO_CIERRE');
  const [reasonCode, setReasonCode] = React.useState('');
  const [comments, setComments] = React.useState('');
  const [potential, setPotential] = React.useState('MEDIO');

  React.useEffect(() => {
    onChange({ declineReasonCode: reasonCode, comments, reactivationPotential: potential });
  }, [reasonCode, comments, potential, onChange]);

  return (
    <div className="space-y-4">
      <Field label="Motivo de no continuidad" htmlFor="decline-reason" required>
        <Select
          id="decline-reason"
          value={reasonCode}
          onChange={(event) => setReasonCode(event.target.value)}
        >
          <option value="">Seleccione un motivo…</option>
          {values.map((value) => (
            <option key={value.code} value={value.code}>
              {value.label}
            </option>
          ))}
        </Select>
      </Field>

      <Field
        label="Potencial de reactivación"
        htmlFor="potential"
        hint="Alimenta la analítica comercial de la plataforma."
      >
        <Select
          id="potential"
          value={potential}
          onChange={(event) => setPotential(event.target.value)}
        >
          <option value="ALTO">Alto — retomaríamos pronto</option>
          <option value="MEDIO">Medio — posible más adelante</option>
          <option value="BAJO">Bajo — poco probable</option>
          <option value="NINGUNO">Ninguno</option>
        </Select>
      </Field>

      <Field label="Comentarios" htmlFor="decline-comments">
        <Textarea
          id="decline-comments"
          value={comments}
          onChange={(event) => setComments(event.target.value)}
          rows={3}
          placeholder="Contexto adicional para el equipo advisory…"
        />
      </Field>
    </div>
  );
}

function AdjustmentsForm({ onChange }: { onChange: (payload: Record<string, unknown>) => void }) {
  const [details, setDetails] = React.useState('');
  const [comments, setComments] = React.useState('');

  React.useEffect(() => {
    onChange({ adjustmentDetails: details, comments });
  }, [details, comments, onChange]);

  return (
    <div className="space-y-4">
      <Field
        label="Ajustes solicitados"
        htmlFor="adjustments"
        required
        hint="Mínimo 30 caracteres. Se generará una versión nueva de la propuesta; la anterior se conserva íntegra."
        error={
          details.length > 0 && details.trim().length < 30
            ? `Faltan ${30 - details.trim().length} caracteres`
            : undefined
        }
      >
        <Textarea
          id="adjustments"
          value={details}
          onChange={(event) => setDetails(event.target.value)}
          rows={5}
          placeholder="Describa con precisión qué debe ajustarse: alcance, cronograma, entregables, valoración…"
        />
      </Field>

      <Field label="Comentarios adicionales" htmlFor="adjust-comments">
        <Textarea
          id="adjust-comments"
          value={comments}
          onChange={(event) => setComments(event.target.value)}
          rows={2}
        />
      </Field>
    </div>
  );
}

function ClosureForm({ onChange }: { onChange: (payload: Record<string, unknown>) => void }) {
  const [statement, setStatement] = React.useState('');
  const [finalNotes, setFinalNotes] = React.useState('');

  React.useEffect(() => {
    onChange({ statement, finalNotes });
  }, [statement, finalNotes, onChange]);

  return (
    <div className="space-y-4">
      <Field
        label="Declaración de cierre técnico (T9A)"
        htmlFor="statement"
        required
        hint="Mínimo 40 caracteres. Declara concluidas las actividades comprometidas."
        error={
          statement.length > 0 && statement.trim().length < 40
            ? `Faltan ${40 - statement.trim().length} caracteres`
            : undefined
        }
      >
        <Textarea
          id="statement"
          value={statement}
          onChange={(event) => setStatement(event.target.value)}
          rows={5}
          placeholder="Declaro concluidas las actividades comprometidas en el marco operativo del servicio…"
        />
      </Field>

      <Field label="Observaciones finales" htmlFor="final-notes">
        <Textarea
          id="final-notes"
          value={finalNotes}
          onChange={(event) => setFinalNotes(event.target.value)}
          rows={3}
          placeholder="Recomendaciones o pendientes menores para el cliente…"
        />
      </Field>
    </div>
  );
}

/**
 * T3D — evaluación de postulaciones y designación del responsable principal.
 *
 * Se evalúan **todas** las postulaciones, no sólo la ganadora: el blueprint
 * exige que la decisión sea trazable y comparable.
 */
function AssignmentForm({
  caseId,
  onChange,
}: {
  caseId: string;
  onChange: (payload: Record<string, unknown>) => void;
}) {
  const [applications, setApplications] = React.useState<ApplicationRow[] | null>(null);
  const [selected, setSelected] = React.useState('');
  const [rationale, setRationale] = React.useState('');
  const [scores, setScores] = React.useState<Record<string, Scores>>({});

  React.useEffect(() => {
    void api
      .get<ApplicationRow[]>(`/cases/${caseId}/applications`)
      .then((rows) => {
        setApplications(rows);
        setScores(
          Object.fromEntries(
            rows.map((row) => [
              row.id,
              {
                specialtyFit: 3,
                experienceFit: 3,
                levelFit: 3,
                availabilityFit: 3,
                trackRecordFit: 3,
                notes: '',
              },
            ]),
          ),
        );
      })
      .catch(() => setApplications([]));
  }, [caseId]);

  React.useEffect(() => {
    onChange({
      applicationId: selected,
      decisionRationale: rationale,
      evaluations: Object.entries(scores).map(([applicationId, value]) => ({
        applicationId,
        ...value,
      })),
    });
  }, [selected, rationale, scores, onChange]);

  if (!applications) {
    return <p className="text-sm text-muted-foreground">Cargando postulaciones…</p>;
  }

  if (applications.length === 0) {
    return <p className="text-sm text-muted-foreground">No hay postulaciones para este caso.</p>;
  }

  const update = (applicationId: string, patch: Partial<Scores>): void => {
    setScores((current) => ({
      ...current,
      [applicationId]: { ...current[applicationId]!, ...patch },
    }));
  };

  return (
    <div className="space-y-4">
      <p className="text-sm leading-relaxed text-muted-foreground">
        Evalúe cada postulación y seleccione al consultor responsable principal. La evaluación
        completa queda registrada (plantilla T3D).
      </p>

      <div className="space-y-3">
        {applications.map((application) => {
          const score = scores[application.id];
          const total = score
            ? score.specialtyFit +
              score.experienceFit +
              score.levelFit +
              score.availabilityFit +
              score.trackRecordFit
            : 0;

          return (
            <label
              key={application.id}
              className={`block cursor-pointer rounded-md border p-4 transition-colors ${
                selected === application.id
                  ? 'border-brand bg-brand-soft/50 shadow-focus'
                  : 'border-border hover:border-border-strong hover:bg-muted/40'
              }`}
            >
              <div className="flex items-start gap-3">
                <input
                  type="radio"
                  name="application"
                  className="mt-1 size-4 accent-brand"
                  checked={selected === application.id}
                  onChange={() => setSelected(application.id)}
                />
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex items-baseline justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {application.consultant.fullName}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        <span className="code">{application.consultant.code}</span> ·{' '}
                        {application.consultant.tier?.toLowerCase() ?? 'sin nivel'} ·{' '}
                        {application.consultant.yearsOfExperience} años
                      </p>
                    </div>
                    <span className="tabular shrink-0 text-lg font-semibold">
                      {total}
                      <span className="text-xs font-medium text-muted-foreground">/25</span>
                    </span>
                  </div>

                  <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                    {application.fitJustification}
                  </p>

                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                    {(
                      [
                        ['specialtyFit', 'Especialidad'],
                        ['experienceFit', 'Experiencia'],
                        ['levelFit', 'Nivel'],
                        ['availabilityFit', 'Disponibilidad'],
                        ['trackRecordFit', 'Historial'],
                      ] as const
                    ).map(([key, label]) => (
                      <div key={key}>
                        <span className="mb-1 block text-2xs text-muted-foreground">{label}</span>
                        <Select
                          className="h-8 text-xs"
                          value={score?.[key] ?? 3}
                          onClick={(event) => event.stopPropagation()}
                          onChange={(event) =>
                            update(application.id, {
                              [key]: Number(event.target.value),
                            } as Partial<Scores>)
                          }
                        >
                          {[1, 2, 3, 4, 5].map((value) => (
                            <option key={value} value={value}>
                              {value}
                            </option>
                          ))}
                        </Select>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </label>
          );
        })}
      </div>

      <Field
        label="Justificación de la decisión"
        htmlFor="rationale"
        required
        hint="Mínimo 20 caracteres. Explica por qué se elige a este consultor frente a los demás."
      >
        <Textarea
          id="rationale"
          value={rationale}
          onChange={(event) => setRationale(event.target.value)}
          rows={3}
          placeholder="Se asigna por afinidad de especialidad, experiencia en el sector y disponibilidad…"
        />
      </Field>
    </div>
  );
}

interface Scores {
  specialtyFit: number;
  experienceFit: number;
  levelFit: number;
  availabilityFit: number;
  trackRecordFit: number;
  notes: string;
}

interface ApplicationRow {
  id: string;
  fitJustification: string;
  consultant: {
    code: string;
    fullName: string;
    tier: string | null;
    yearsOfExperience: number;
  };
}
