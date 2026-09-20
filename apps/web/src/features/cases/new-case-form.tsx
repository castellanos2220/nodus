'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { Role } from '@nodus/types';

import { ApiError, api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Field,
  FormError,
  Input,
  Select,
  Textarea,
} from '@/components/ui/primitives';
import { useLookupValues } from '@/features/lookups/use-lookups';
import type { Paginated } from './types';

interface CompanyOption {
  id: string;
  code: string;
  name: string;
}

export function NewCaseForm({ role }: { role: Role }) {
  const router = useRouter();
  const isClient = role === 'CLIENTE_MIPYME';

  const areas = useLookupValues('AREA_PROBLEMA');
  const urgencies = useLookupValues('URGENCIA');
  const impacts = useLookupValues('IMPACTO');

  const companies = useQuery({
    queryKey: ['companies', 'options'],
    queryFn: () => api.get<Paginated<CompanyOption>>('/companies', { pageSize: 100 }),
    enabled: !isClient,
  });

  const [form, setForm] = React.useState({
    companyId: '',
    title: '',
    description: '',
    areaCode: '',
    urgencyCode: '',
    impactCode: '',
  });
  const [serverError, setServerError] = React.useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      api.post<{ id: string; code: string }>('/cases', {
        companyId: isClient ? undefined : form.companyId,
        title: form.title,
        description: form.description,
        areaCode: form.areaCode,
        urgencyCode: form.urgencyCode,
        impactCode: form.impactCode,
      }),
    onSuccess: (created) => {
      toast.success('Caso registrado', { description: `Identificador ${created.code}` });
      router.push(`/cases/${created.id}`);
    },
    onError: (error) => {
      setServerError(error instanceof ApiError ? error.message : 'No se pudo registrar el caso.');
    },
  });

  const valid =
    (isClient || form.companyId) &&
    form.title.trim().length >= 10 &&
    form.description.trim().length >= 40 &&
    form.areaCode &&
    form.urgencyCode &&
    form.impactCode;

  const set =
    (key: keyof typeof form) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm((current) => ({ ...current, [key]: event.target.value }));

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
      <Card>
        <CardHeader>
          <CardTitle>Plantilla T1 · Registro de caso</CardTitle>
          <CardDescription>
            El caso nace en estado Creado y es editable por el cliente hasta que Advisory inicie la
            revisión.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-5">
          {!isClient && (
            <Field label="Empresa" htmlFor="companyId" required>
              <Select id="companyId" value={form.companyId} onChange={set('companyId')}>
                <option value="">Seleccione la empresa…</option>
                {(companies.data?.data ?? []).map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name} ({company.code})
                  </option>
                ))}
              </Select>
            </Field>
          )}

          <Field
            label="Título del caso"
            htmlFor="title"
            required
            hint="Mínimo 10 caracteres."
            error={
              form.title.length > 0 && form.title.trim().length < 10
                ? `Faltan ${10 - form.title.trim().length} caracteres`
                : undefined
            }
          >
            <Input
              id="title"
              value={form.title}
              onChange={set('title')}
              placeholder="Pérdida de trazabilidad de inventario en planta"
            />
          </Field>

          <Field
            label="Descripción del problema"
            htmlFor="description"
            required
            hint="Mínimo 40 caracteres. Qué ocurre, desde cuándo, a qué afecta."
            error={
              form.description.length > 0 && form.description.trim().length < 40
                ? `Faltan ${40 - form.description.trim().length} caracteres`
                : undefined
            }
          >
            <Textarea
              id="description"
              rows={7}
              value={form.description}
              onChange={set('description')}
              placeholder="Describa la situación con el detalle necesario…"
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Área del negocio" htmlFor="areaCode" required>
              <Select id="areaCode" value={form.areaCode} onChange={set('areaCode')}>
                <option value="">Seleccione…</option>
                {areas.values.map((value) => (
                  <option key={value.code} value={value.code}>
                    {value.label}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Urgencia" htmlFor="urgencyCode" required>
              <Select id="urgencyCode" value={form.urgencyCode} onChange={set('urgencyCode')}>
                <option value="">Seleccione…</option>
                {urgencies.values.map((value) => (
                  <option key={value.code} value={value.code}>
                    {value.label}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Impacto estimado" htmlFor="impactCode" required>
              <Select id="impactCode" value={form.impactCode} onChange={set('impactCode')}>
                <option value="">Seleccione…</option>
                {impacts.values.map((value) => (
                  <option key={value.code} value={value.code}>
                    {value.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          {serverError && <FormError>{serverError}</FormError>}

          <div className="flex justify-end gap-2 border-t border-border pt-5">
            <Button variant="secondary" onClick={() => router.back()} disabled={mutation.isPending}>
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
              Registrar caso
            </Button>
          </div>
        </CardContent>
      </Card>

      <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
        <Card>
          <CardHeader>
            <CardTitle>Qué ocurre después</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-3.5">
              {NEXT_STEPS.map((step, index) => (
                <li key={step} className="flex gap-3 text-sm text-ink-2">
                  <span className="tabular flex size-5 shrink-0 items-center justify-center rounded-full border border-border-strong text-2xs font-semibold text-muted-foreground">
                    {index + 1}
                  </span>
                  <span className="leading-snug">{step}</span>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      </aside>
    </div>
  );
}

const NEXT_STEPS = [
  'Advisory revisa la información y hace la debida diligencia.',
  'El caso se clasifica con taxonomías gobernadas.',
  'Se publica en la bolsa interna de consultores elegibles.',
  'Advisory designa un consultor responsable.',
  'El cliente recibe una propuesta estructurada para decidir.',
];
