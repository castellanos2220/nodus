'use client';

import * as React from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowUpRight, ClipboardCheck, FileStack } from 'lucide-react';
import { ApiError, api } from '@/lib/api';
import { formatRelative, humanizeCode } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Badge,
  Card,
  Checkbox,
  EmptyState,
  Field,
  FormError,
  Select,
  Skeleton,
  Textarea,
} from '@/components/ui/primitives';
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

  if (isLoading) return <Skeleton className="h-64 rounded-md" />;

  if (!data || data.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={<ClipboardCheck />}
          title="No hay propuestas pendientes de revisión"
          description="Cuando un consultor consolide una versión y la envíe a QA aparecerá aquí."
        />
      </Card>
    );
  }

  return (
    <>
      <p className="mb-4 text-xs text-muted-foreground">
        <span className="tabular font-medium text-foreground">{data.length}</span> versión
        {data.length === 1 ? '' : 'es'} esperando revisión
      </p>
      <Card className="overflow-hidden">
        <ul className="divide-y divide-border">
          {data.map((version) => (
            <li
              key={version.id}
              className="flex flex-col gap-4 px-6 py-5 transition-colors hover:bg-muted/30 lg:flex-row lg:items-center"
            >
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="code">{version.proposal.case.code}</span>
                  <StatusBadge status={version.proposal.case.status} variant="plain" />
                </div>
                <p className="truncate text-base font-medium">{version.proposal.case.title}</p>
                <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                  <span>{version.proposal.case.company.name}</span>
                  <span className="text-subtle-foreground">·</span>
                  <span className="tabular font-medium text-ink-2">v{version.versionNumber}</span>
                  {version.frozenAt && (
                    <>
                      <span className="text-subtle-foreground">·</span>
                      <span>congelada {formatRelative(version.frozenAt)}</span>
                    </>
                  )}
                </p>
              </div>

              <div className="flex flex-wrap gap-1.5 lg:w-64 lg:justify-end">
                {version.reviews.length === 0 ? (
                  <Badge tone="outline">Sin revisiones todavía</Badge>
                ) : (
                  version.reviews.map((review) => (
                    <Badge
                      key={review.id}
                      tone={review.outcome === 'APROBADA' ? 'success' : 'warning'}
                      dot
                    >
                      {review.type === 'METODOLOGICA' ? 'Metodológica' : 'Peer'}:{' '}
                      {humanizeCode(review.outcome).toLowerCase()}
                    </Badge>
                  ))
                )}
              </div>

              <div className="flex shrink-0 gap-2">
                <Button variant="secondary" size="sm" asChild>
                  <Link href={`/cases/${version.proposal.caseId}`}>
                    Ver propuesta <ArrowUpRight />
                  </Link>
                </Button>
                <Button size="sm" onClick={() => setReviewing(version)}>
                  Registrar revisión
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </Card>

      {reviewing && <ReviewDialog version={reviewing} onClose={() => setReviewing(null)} />}
    </>
  );
}

function ReviewDialog({ version, onClose }: { version: PendingVersion; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [type, setType] = React.useState<'METODOLOGICA' | 'PEER'>('METODOLOGICA');
  const [outcome, setOutcome] = React.useState<
    'APROBADA' | 'AJUSTES_SOLICITADOS' | 'OBSERVACIONES'
  >('APROBADA');
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

        <DialogBody className="space-y-5">
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
            <ul className="divide-y divide-border rounded-md border border-border">
              {CHECKLIST_ITEMS.map(([key, text]) => (
                <li key={key}>
                  <label className="flex cursor-pointer items-start gap-3 px-3.5 py-2.5 text-sm transition-colors hover:bg-muted/40">
                    <Checkbox
                      className="mt-0.5"
                      checked={checklist[key] ?? false}
                      onChange={(event) =>
                        setChecklist((current) => ({ ...current, [key]: event.target.checked }))
                      }
                    />
                    <span className={checklist[key] ? 'text-foreground' : 'text-muted-foreground'}>
                      {text}
                    </span>
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

          {serverError && <FormError>{serverError}</FormError>}
        </DialogBody>

        <DialogFooter>
          <Button variant="secondary" onClick={onClose} disabled={mutation.isPending}>
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
