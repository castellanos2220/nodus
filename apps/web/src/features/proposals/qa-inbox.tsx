'use client';

import * as React from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ClipboardCheck, FileStack } from 'lucide-react';
import { ApiError, api } from '@/lib/api';
import { formatRelative } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge, Card, CardContent, CardHeader, CardTitle, EmptyState, Field, Select, Skeleton, Textarea } from '@/components/ui/primitives';
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
import type { CaseStatusCode } from '@nodus/types';

interface PendingVersion {
  id: string;
  versionNumber: number;
  frozenAt: string | null;
  proposal: {
    caseId: string;
    case: {
      code: string;
      title: string;
      status: CaseStatusCode;
      complexityCode: string | null;
      company: { name: string };
    };
  };
  reviews: Array<{ id: string; type: string; outcome: string; createdAt: string }>;
}

const CHECKLIST_ITEMS: Array<[string, string]> = [
  ['completeness', 'La propuesta está completa'],
  ['templateUsage', 'Usa correctamente las plantillas oficiales'],
  ['traceability', 'Tiene trazabilidad documental'],
  ['problemScopeCoherence', 'Hay coherencia entre problema, alcance y entregables'],
  ['clientReadability', 'Es comprensible para una Mipyme'],
  ['scheduleAndValuation', 'Incluye cronograma y valoración mínimos'],
  ['exclusionsAndAssumptions', 'No omite exclusiones, supuestos ni restricciones clave'],
];

export function QaInbox() {
  const [reviewing, setReviewing] = React.useState<PendingVersion | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['proposals', 'pending-review'],
    queryFn: () => api.get<PendingVersion[]>('/proposals/pending-review'),
  });

  if (isLoading) return <Skeleton className="h-64" />;

  if (!data || data.length === 0) {
    return (
      <Card>
        <CardContent>
          <EmptyState
            icon={<ClipboardCheck className="size-9" />}
            title="No hay propuestas pendientes de revisión"
            description="Cuando un consultor consolide una versión y la envíe a QA aparecerá aquí."
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {data.map((version) => (
          <Card key={version.id}>
            <CardHeader className="flex-row items-start justify-between gap-3">
              <div className="min-w-0">
                <CardTitle className="truncate">{version.proposal.case.title}</CardTitle>
                <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-2xs text-muted-foreground">
                  <span className="font-mono">{version.proposal.case.code}</span>
                  <span>·</span>
                  <span>{version.proposal.case.company.name}</span>
                  <span>·</span>
                  <span className="font-mono">v{version.versionNumber}</span>
                  {version.frozenAt && (
                    <>
                      <span>·</span>
                      <span>congelada {formatRelative(version.frozenAt)}</span>
                    </>
                  )}
                </p>
              </div>
              <CaseStatusBadge status={version.proposal.case.status} />
            </CardHeader>

            <CardContent className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-1.5">
                {version.reviews.length === 0 ? (
                  <Badge tone="amber">Sin revisiones todavía</Badge>
                ) : (
                  version.reviews.map((review) => (
                    <Badge
                      key={review.id}
                      tone={review.outcome === 'APROBADA' ? 'emerald' : 'orange'}
                    >
                      {review.type === 'METODOLOGICA' ? 'Metodológica' : 'Peer'}:{' '}
                      {review.outcome.replace(/_/g, ' ').toLowerCase()}
                    </Badge>
                  ))
                )}
              </div>

              <div className="flex gap-2">
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/cases/${version.proposal.caseId}`}>Ver propuesta</Link>
                </Button>
                <Button size="sm" onClick={() => setReviewing(version)}>
                  Registrar revisión
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {reviewing && <ReviewDialog version={reviewing} onClose={() => setReviewing(null)} />}
    </>
  );
}

function ReviewDialog({
  version,
  onClose,
}: {
  version: PendingVersion;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [type, setType] = React.useState<'METODOLOGICA' | 'PEER'>('METODOLOGICA');
  const [outcome, setOutcome] = React.useState<'APROBADA' | 'AJUSTES_SOLICITADOS' | 'OBSERVACIONES'>(
    'APROBADA',
  );
  const [checklist, setChecklist] = React.useState<Record<string, boolean>>(
    Object.fromEntries(CHECKLIST_ITEMS.map(([key]) => [key, true])),
  );
  const [observations, setObservations] = React.useState('');
  const [serverError, setServerError] = React.useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      api.post(`/cases/${version.proposal.caseId}/proposal/reviews`, {
        type,
        outcome,
        checklist,
        observations: observations.trim() || undefined,
      }),
    onSuccess: () => {
      toast.success('Revisión registrada', {
        description:
          outcome === 'APROBADA'
            ? 'La propuesta puede autorizarse para envío al cliente.'
            : 'Se registraron observaciones para el consultor responsable.',
      });
      void queryClient.invalidateQueries({ queryKey: ['proposals'] });
      void queryClient.invalidateQueries({ queryKey: ['case', version.proposal.caseId] });
      onClose();
    },
    onError: (error) => {
      setServerError(
        error instanceof ApiError ? error.message : 'No se pudo registrar la revisión.',
      );
    },
  });

  const needsObservations = outcome !== 'APROBADA';
  const valid = !needsObservations || observations.trim().length >= 20;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent wide>
        <DialogHeader>
          <DialogTitle>Revisión de propuesta</DialogTitle>
          <DialogDescription>
            {version.proposal.case.code} · versión {version.versionNumber}
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Tipo de revisión"
              htmlFor="review-type"
              hint="La metodológica (TP4H) es la que habilita el envío al cliente."
            >
              <Select
                id="review-type"
                value={type}
                onChange={(event) => setType(event.target.value as typeof type)}
              >
                <option value="METODOLOGICA">Metodológica (TP4H)</option>
                <option value="PEER">Revisión experta (peer review)</option>
              </Select>
            </Field>

            <Field label="Resultado" htmlFor="review-outcome" required>
              <Select
                id="review-outcome"
                value={outcome}
                onChange={(event) => setOutcome(event.target.value as typeof outcome)}
              >
                <option value="APROBADA">Aprobada</option>
                <option value="AJUSTES_SOLICITADOS">Ajustes solicitados</option>
                <option value="OBSERVACIONES">Observaciones (sin bloquear)</option>
              </Select>
            </Field>
          </div>

          <div className="space-y-2">
            <p className="label-caps">Checklist del «Go»</p>
            <ul className="space-y-1.5 rounded-lg border border-border p-3">
              {CHECKLIST_ITEMS.map(([key, text]) => (
                <li key={key}>
                  <label className="flex items-start gap-2.5 text-sm">
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={checklist[key] ?? false}
                      onChange={(event) =>
                        setChecklist((current) => ({ ...current, [key]: event.target.checked }))
                      }
                    />
                    <span className={checklist[key] ? '' : 'text-muted-foreground'}>{text}</span>
                  </label>
                </li>
              ))}
            </ul>
          </div>

          <Field
            label="Observaciones"
            htmlFor="observations"
            required={needsObservations}
            hint={
              needsObservations
                ? 'Obligatorias (mínimo 20 caracteres) cuando se solicitan ajustes.'
                : 'Opcional cuando se aprueba.'
            }
            error={
              needsObservations && observations.length > 0 && observations.trim().length < 20
                ? `Faltan ${20 - observations.trim().length} caracteres`
                : undefined
            }
          >
            <Textarea
              id="observations"
              rows={5}
              value={observations}
              onChange={(event) => setObservations(event.target.value)}
              placeholder="Qué debe corregirse y por qué…"
            />
          </Field>

          {serverError && (
            <p
              className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive"
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
            disabled={!valid}
            loading={mutation.isPending}
            onClick={() => {
              setServerError(null);
              mutation.mutate();
            }}
          >
            Registrar revisión
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export { FileStack };
