'use client';

import * as React from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import type { Role } from '@nodus/types';
import { ArrowLeft, EyeOff, Mail, Phone } from 'lucide-react';
import { ApiError, api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { EmptyState, InlineNotice, Panel, Skeleton } from '@/components/ui/primitives';
import { UserAvatar } from '@/components/ui/avatar';
import type { CaseDetail, StatusHistoryEntry } from '../types';
import { CaseHeader } from './case-header';
import { CaseTabs, type CaseTabId } from './case-tabs';
import { NextStepPanel } from './transition-panel';

/**
 * Case Workspace: el centro operativo de NODUS.
 *
 *   cabecera   qué caso es, de quién, estado, responsable, SLA, recorrido
 *   pestañas   el trabajo del caso, en el orden en que avanza
 *   lateral    siguiente paso (acción, espera o bloqueo) y contacto
 *
 * El usuario debe entender el caso sin salir de esta pantalla.
 */
export function CaseDetailView({ caseId, role }: { caseId: string; role: Role }) {
  const [tab, setTab] = React.useState<CaseTabId>('overview');

  const {
    data: kase,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['case', caseId],
    queryFn: () => api.get<CaseDetail>(`/cases/${caseId}`),
  });

  // Misma clave que la pestaña Workflow: una sola petición para cabecera y pestaña.
  const { data: history } = useQuery({
    queryKey: ['case', caseId, 'status-history'],
    queryFn: () => api.get<StatusHistoryEntry[]>(`/cases/${caseId}/status-history`),
    enabled: Boolean(kase),
  });

  if (isLoading) {
    return (
      <div className="space-y-6" aria-busy="true" aria-label="Cargando el caso">
        <div className="space-y-3 border-b border-border pb-5">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-4 w-64" />
          <div className="grid grid-cols-4 gap-6 pt-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-10" />
            ))}
          </div>
          <Skeleton className="h-5 w-full" />
        </div>
        <Skeleton className="h-10 w-full" />
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <Skeleton className="h-96" />
          <Skeleton className="h-56" />
        </div>
      </div>
    );
  }

  if (error || !kase) {
    const notFound = error instanceof ApiError && error.status === 404;
    return (
      <Panel>
        <EmptyState
          title={
            notFound ? 'Este caso no existe o no tiene acceso a él' : 'No se pudo cargar el caso'
          }
          description={
            notFound
              ? 'Puede que el enlace sea incorrecto o que su rol no tenga visibilidad sobre este caso.'
              : error instanceof ApiError
                ? error.message
                : 'La conexión con el servidor falló.'
          }
          action={
            <div className="flex gap-2">
              {!notFound && (
                <Button variant="secondary" size="sm" onClick={() => void refetch()}>
                  Reintentar
                </Button>
              )}
              <Button variant="secondary" size="sm" asChild>
                <Link href="/cases">
                  <ArrowLeft /> Volver a casos
                </Link>
              </Button>
            </div>
          }
        />
      </Panel>
    );
  }

  const redacted = kase.accessLevel === 'REDACTED';
  const enteredCurrent = history?.[history.length - 1]?.createdAt ?? kase.createdAt;

  return (
    <div className="space-y-6">
      <CaseHeader kase={kase} history={history} onOpenWorkflow={() => setTab('workflow')} />

      {redacted && (
        <InlineNotice tone="info" title="Versión controlada del caso">
          La bolsa interna no expone la identidad ni la información sensible del cliente hasta que
          exista una asignación formal.
        </InlineNotice>
      )}

      <CaseTabs
        kase={kase}
        role={role}
        history={history}
        tab={tab}
        onTabChange={setTab}
        aside={
          <>
            <NextStepPanel kase={kase} enteredCurrentAt={enteredCurrent} />

            {!redacted && kase.contact && (
              <section className="surface space-y-3 px-5 py-4" aria-labelledby="contact-title">
                <h2 id="contact-title" className="text-h3">
                  Contacto del cliente
                </h2>
                <div className="flex items-center gap-2.5">
                  <UserAvatar name={kase.contact.fullName} />
                  <div className="min-w-0">
                    <p className="truncate text-body-sm font-medium">{kase.contact.fullName}</p>
                    <p className="truncate text-caption text-muted-foreground">
                      {kase.contact.jobTitle}
                    </p>
                  </div>
                </div>
                <div className="space-y-1 text-body-sm">
                  <a
                    href={`mailto:${kase.contact.email}`}
                    className="flex items-center gap-2 text-ink-2 hover:text-brand-strong"
                  >
                    <Mail className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                    <span className="truncate">{kase.contact.email}</span>
                  </a>
                  {kase.contact.phone && (
                    <p className="flex items-center gap-2 text-ink-2">
                      <Phone className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                      {kase.contact.phone}
                    </p>
                  )}
                </div>
              </section>
            )}

            {redacted && (
              <p className="flex items-start gap-2 px-1 text-caption text-muted-foreground">
                <EyeOff className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                Los datos de contacto se muestran tras la asignación formal.
              </p>
            )}
          </>
        }
      />
    </div>
  );
}
