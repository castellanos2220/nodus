'use client';

import * as React from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AlertCircle, Briefcase, CalendarClock, CheckCircle2, Users } from 'lucide-react';
import { ApiError, api } from '@/lib/api';
import { formatRelative } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge, Card, CardContent, CardHeader, CardTitle, EmptyState, Field, Skeleton, Textarea } from '@/components/ui/primitives';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useLookupLabel } from '@/features/lookups/use-lookups';
import type { Paginated } from '@/features/cases/types';

interface Opportunity {
  caseId: string;
  code: string;
  title: string;
  summary: string;
  areaCode: string | null;
  interventionTypeCode: string | null;
  complexityCode: string | null;
  urgencyCode: string | null;
  impactCode: string | null;
  sectorCode: string | null;
  country: string;
  city: string;
  publishedAt: string | null;
  applicationDeadline: string | null;
  applicationsCount: number;
  alreadyApplied: boolean;
  myApplicationStatus: string | null;
}

export function OpportunitiesView() {
  const label = useLookupLabel();
  const [applyTo, setApplyTo] = React.useState<Opportunity | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['opportunities'],
    queryFn: () => api.get<Paginated<Opportunity>>('/consultants/opportunities', { pageSize: 50 }),
  });

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-56" />
        ))}
      </div>
    );
  }

  if (error) {
    const message =
      error instanceof ApiError ? error.message : 'No se pudieron cargar las oportunidades.';
    return (
      <Card>
        <CardContent>
          <EmptyState
            icon={<AlertCircle className="size-8" />}
            title="No fue posible acceder a la bolsa"
            description={message}
          />
        </CardContent>
      </Card>
    );
  }

  if (!data || data.data.length === 0) {
    return (
      <Card>
        <CardContent>
          <EmptyState
            icon={<Briefcase className="size-9" />}
            title="No hay oportunidades elegibles ahora mismo"
            description={
              'Aparecerán aquí los casos publicados cuyo área, complejidad y tipo de intervención ' +
              'estén dentro de su alcance habilitado.'
            }
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2">
        {data.data.map((opportunity) => (
          <Card key={opportunity.caseId} className="flex flex-col">
            <CardHeader>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <CardTitle className="truncate">{opportunity.title}</CardTitle>
                  <p className="mt-0.5 font-mono text-2xs text-muted-foreground">
                    {opportunity.code} · {opportunity.city}, {opportunity.country}
                  </p>
                </div>
                {opportunity.alreadyApplied && (
                  <Badge tone="emerald" className="shrink-0">
                    <CheckCircle2 className="size-3" aria-hidden /> Postulado
                  </Badge>
                )}
              </div>
            </CardHeader>

            <CardContent className="flex flex-1 flex-col gap-3">
              <div className="flex flex-wrap gap-1.5">
                {opportunity.areaCode && (
                  <Badge tone="indigo">{label('AREA_PROBLEMA', opportunity.areaCode)}</Badge>
                )}
                {opportunity.interventionTypeCode && (
                  <Badge tone="outline">
                    {label('TIPO_INTERVENCION', opportunity.interventionTypeCode)}
                  </Badge>
                )}
                {opportunity.complexityCode && (
                  <Badge tone="violet">
                    Complejidad {label('COMPLEJIDAD', opportunity.complexityCode).toLowerCase()}
                  </Badge>
                )}
                {opportunity.impactCode && (
                  <Badge tone={opportunity.impactCode === 'CRITICO' ? 'rose' : 'amber'}>
                    Impacto {label('IMPACTO', opportunity.impactCode).toLowerCase()}
                  </Badge>
                )}
              </div>

              <p className="flex-1 text-sm leading-relaxed text-muted-foreground">
                {opportunity.summary}
              </p>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border pt-3 text-2xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <Users className="size-3" aria-hidden /> {opportunity.applicationsCount}{' '}
                  postulación{opportunity.applicationsCount === 1 ? '' : 'es'}
                </span>
                {opportunity.applicationDeadline && (
                  <span className="inline-flex items-center gap-1">
                    <CalendarClock className="size-3" aria-hidden /> cierra{' '}
                    {formatRelative(opportunity.applicationDeadline)}
                  </span>
                )}
              </div>

              <div className="flex gap-2">
                <Button
                  className="flex-1"
                  disabled={opportunity.alreadyApplied}
                  onClick={() => setApplyTo(opportunity)}
                >
                  {opportunity.alreadyApplied ? 'Ya se ha postulado' : 'Postularme'}
                </Button>
                <Button variant="outline" asChild>
                  <Link href={`/cases/${opportunity.caseId}`}>Ver caso</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {applyTo && <ApplyDialog opportunity={applyTo} onClose={() => setApplyTo(null)} />}
    </>
  );
}

/** T3C — postulación estructurada. Los mínimos los impone también el backend. */
function ApplyDialog({
  opportunity,
  onClose,
}: {
  opportunity: Opportunity;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = React.useState({
    interestStatement: '',
    availability: '',
    relevantExperience: '',
    fitJustification: '',
    preliminaryApproach: '',
  });
  const [accepts, setAccepts] = React.useState(false);
  const [serverError, setServerError] = React.useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      api.post(`/cases/${opportunity.caseId}/applications`, {
        ...form,
        acceptsConditions: accepts,
      }),
    onSuccess: () => {
      toast.success('Postulación enviada', {
        description: `Su postulación al caso ${opportunity.code} quedó registrada.`,
      });
      void queryClient.invalidateQueries({ queryKey: ['opportunities'] });
      onClose();
    },
    onError: (error) => {
      const message =
        error instanceof ApiError ? error.message : 'No se pudo enviar la postulación.';
      setServerError(message);
    },
  });

  const set = (key: keyof typeof form) => (event: React.ChangeEvent<HTMLTextAreaElement>) =>
    setForm((current) => ({ ...current, [key]: event.target.value }));

  const minimums: Array<[keyof typeof form, number]> = [
    ['interestStatement', 40],
    ['availability', 10],
    ['relevantExperience', 40],
    ['fitJustification', 40],
    ['preliminaryApproach', 40],
  ];

  const valid =
    accepts && minimums.every(([key, min]) => form[key].trim().length >= min);

  const remaining = (key: keyof typeof form, min: number): string | undefined => {
    const length = form[key].trim().length;
    if (length === 0 || length >= min) return undefined;
    return `Faltan ${min - length} caracteres`;
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent wide>
        <DialogHeader>
          <DialogTitle>Postulación estructurada (T3C)</DialogTitle>
          <DialogDescription>
            {opportunity.code} · {opportunity.title}
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4">
          <Field
            label="Manifestación de interés"
            htmlFor="interest"
            required
            error={remaining('interestStatement', 40)}
          >
            <Textarea
              id="interest"
              rows={3}
              value={form.interestStatement}
              onChange={set('interestStatement')}
              placeholder="Por qué le interesa atender este caso…"
            />
          </Field>

          <Field
            label="Disponibilidad"
            htmlFor="availability"
            required
            error={remaining('availability', 10)}
          >
            <Textarea
              id="availability"
              rows={2}
              value={form.availability}
              onChange={set('availability')}
              placeholder="Desde cuándo y con qué dedicación semanal…"
            />
          </Field>

          <Field
            label="Experiencia relevante"
            htmlFor="experience"
            required
            error={remaining('relevantExperience', 40)}
          >
            <Textarea
              id="experience"
              rows={3}
              value={form.relevantExperience}
              onChange={set('relevantExperience')}
              placeholder="Intervenciones equivalentes, sector y resultados…"
            />
          </Field>

          <Field
            label="Justificación de pertinencia"
            htmlFor="fit"
            required
            error={remaining('fitJustification', 40)}
          >
            <Textarea
              id="fit"
              rows={3}
              value={form.fitJustification}
              onChange={set('fitJustification')}
              placeholder="Por qué su perfil encaja con este caso concreto…"
            />
          </Field>

          <Field
            label="Enfoque preliminar"
            htmlFor="approach"
            required
            error={remaining('preliminaryApproach', 40)}
            hint="Cómo abordaría el caso. No es la propuesta: es la orientación metodológica."
          >
            <Textarea
              id="approach"
              rows={4}
              value={form.preliminaryApproach}
              onChange={set('preliminaryApproach')}
              placeholder="Fases, instrumentos y entregables que anticipa…"
            />
          </Field>

          <label className="flex items-start gap-2.5 rounded-lg border border-border bg-secondary/40 p-3">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={accepts}
              onChange={(event) => setAccepts(event.target.checked)}
            />
            <span className="text-xs leading-relaxed">
              Acepto las condiciones metodológicas de la plataforma: uso de plantillas oficiales,
              registro de la interacción en bitácora y ausencia de canal directo con la Mipyme
              fuera del proceso controlado.
            </span>
          </label>

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
            Enviar postulación
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
