'use client';

import * as React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowRight, Info, Lock } from 'lucide-react';
import { ApiError, api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, Field, Select, Textarea } from '@/components/ui/primitives';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { CaseStatusBadge } from '@/components/ui/status';
import { useLookupValues } from '@/features/lookups/use-lookups';
import type { AvailableTransition, CaseDetail } from '../types';

/**
 * Panel de acciones del caso.
 *
 * Los botones **no** los decide el frontend: se pintan a partir de
 * `availableTransitions`, que el backend calcula para este usuario y este caso
 * ejecutando los mismos guards que aplicaría de verdad. Cuando una transición
 * está bloqueada, la razón que se muestra viene también del backend.
 *
 * Consecuencia práctica: no existe una regla de negocio duplicada aquí. Si el
 * backend cambia una precondición, esta pantalla lo refleja sin tocarla.
 */
export function TransitionPanel({ kase }: { kase: CaseDetail }) {
  const [active, setActive] = React.useState<AvailableTransition | null>(null);

  if (kase.availableTransitions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Acciones</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs leading-relaxed text-muted-foreground">
            No hay acciones disponibles para su rol en el estado actual del caso.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Acciones disponibles</CardTitle>
          <p className="text-xs text-muted-foreground">
            Calculadas por el backend para su rol y el estado actual
          </p>
        </CardHeader>
        <CardContent className="space-y-2">
          {kase.availableTransitions.map((transition) => (
            <div key={transition.code} className="space-y-1.5">
              <Button
                variant={transition.allowed ? 'default' : 'outline'}
                className="w-full justify-between"
                disabled={!transition.allowed}
                onClick={() => setActive(transition)}
                title={transition.description}
              >
                <span className="truncate">{transition.label}</span>
                {transition.allowed ? (
                  <ArrowRight className="shrink-0" aria-hidden />
                ) : (
                  <Lock className="shrink-0 opacity-60" aria-hidden />
                )}
              </Button>

              {!transition.allowed && transition.blockedReason && (
                <p className="flex items-start gap-1.5 rounded-md bg-secondary/60 px-2.5 py-2 text-2xs leading-relaxed text-muted-foreground">
                  <Info className="mt-px size-3 shrink-0" aria-hidden />
                  <span>{transition.blockedReason}</span>
                </p>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {active && (
        <TransitionDialog
          kase={kase}
          transition={active}
          onClose={() => setActive(null)}
        />
      )}
    </>
  );
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
          <div className="flex items-center gap-2 pt-1">
            <CaseStatusBadge status={kase.status} />
            <ArrowRight className="size-3 text-muted-foreground" aria-hidden />
            <CaseStatusBadge status={transition.toStatus} />
          </div>
        </DialogHeader>

        <DialogBody className="space-y-4">
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

          {serverError && (
            <p
              className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs leading-relaxed text-destructive"
              role="alert"
            >
              {serverError}
            </p>
          )}
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>
            Cancelar
          </Button>
          <Button
            onClick={() => {
              setServerError(null);
              mutation.mutate();
            }}
            loading={mutation.isPending}
          >
            {mutation.isPending ? 'Aplicando…' : `Confirmar: ${transition.label}`}
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
        <Select id="potential" value={potential} onChange={(event) => setPotential(event.target.value)}>
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
    return <p className="text-xs text-muted-foreground">Cargando postulaciones…</p>;
  }

  if (applications.length === 0) {
    return <p className="text-xs text-muted-foreground">No hay postulaciones para este caso.</p>;
  }

  const update = (applicationId: string, patch: Partial<Scores>): void => {
    setScores((current) => ({
      ...current,
      [applicationId]: { ...current[applicationId]!, ...patch },
    }));
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
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
              className={`block cursor-pointer rounded-lg border p-3 transition-colors ${
                selected === application.id
                  ? 'border-primary bg-accent/40'
                  : 'border-border hover:bg-secondary/40'
              }`}
            >
              <div className="flex items-start gap-3">
                <input
                  type="radio"
                  name="application"
                  className="mt-1"
                  checked={selected === application.id}
                  onChange={() => setSelected(application.id)}
                />
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex items-baseline justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {application.consultant.fullName}
                      </p>
                      <p className="font-mono text-2xs text-muted-foreground">
                        {application.consultant.code} · {application.consultant.tier ?? 'sin nivel'}{' '}
                        · {application.consultant.yearsOfExperience} años
                      </p>
                    </div>
                    <span className="shrink-0 font-mono text-xs font-semibold">{total}/25</span>
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
                        <span className="block text-2xs text-muted-foreground">{label}</span>
                        <Select
                          className="h-7 text-xs"
                          value={score?.[key] ?? 3}
                          onClick={(event) => event.stopPropagation()}
                          onChange={(event) =>
                            update(application.id, { [key]: Number(event.target.value) } as Partial<Scores>)
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
