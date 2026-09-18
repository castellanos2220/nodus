'use client';

import * as React from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import type { Role } from '@nodus/types';
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  CalendarClock,
  FileText,
  ShieldAlert,
  UserRound,
} from 'lucide-react';
import { ApiError, api } from '@/lib/api';
import { cn, formatDate, formatDateTime, formatRelative } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  DefItem,
  Skeleton,
} from '@/components/ui/primitives';
import { CaseProgress, CaseStatusBadge, SlaBadge } from '@/components/ui/status';
import { useLookupLabel } from '@/features/lookups/use-lookups';
import type { CaseDetail } from '../types';
import { TransitionPanel } from './transition-panel';
import { CaseTabs } from './case-tabs';

export function CaseDetailView({ caseId, role }: { caseId: string; role: Role }) {
  const label = useLookupLabel();

  const { data: kase, isLoading, error } = useQuery({
    queryKey: ['case', caseId],
    queryFn: () => api.get<CaseDetail>(`/cases/${caseId}`),
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-28" />
        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <Skeleton className="h-96" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  if (error || !kase) {
    const message =
      error instanceof ApiError
        ? error.status === 404
          ? 'Este caso no existe o no tiene acceso a él.'
          : error.message
        : 'No se pudo cargar el caso.';

    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
          <ShieldAlert className="size-9 text-muted-foreground/60" aria-hidden />
          <p className="text-sm font-medium">{message}</p>
          <Button variant="outline" size="sm" asChild>
            <Link href="/cases">
              <ArrowLeft /> Volver a casos
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const redacted = kase.accessLevel === 'REDACTED';

  return (
    <div className="space-y-5">
      {/* ------------------------------------------------------- Encabezado -- */}
      <div className="space-y-3">
        <Link
          href="/cases"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" aria-hidden /> Casos
        </Link>

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs text-muted-foreground">{kase.code}</span>
              <CaseStatusBadge status={kase.status} />
              {kase.counts.incidents > 0 && (
                <span className="inline-flex items-center gap-1 text-2xs font-medium text-destructive">
                  <AlertTriangle className="size-3" aria-hidden />
                  {kase.counts.incidents} incidencia{kase.counts.incidents === 1 ? '' : 's'}
                </span>
              )}
            </div>
            <h1 className="max-w-3xl text-xl font-semibold leading-tight">{kase.title}</h1>
            <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Building2 className="size-3.5" aria-hidden />
              {redacted ? (
                <span className="italic">Identidad de la empresa reservada</span>
              ) : (
                <Link href={`/companies/${kase.company.id}`} className="hover:underline">
                  {kase.company.name}
                </Link>
              )}
              <span className="text-muted-foreground/50">·</span>
              {kase.company.city}, {kase.company.country}
            </p>
          </div>

          <div className="w-full max-w-[220px] shrink-0 space-y-1.5">
            <p className="label-caps">Avance del ciclo</p>
            <CaseProgress percent={kase.progressPercent} />
            <p className="text-2xs text-muted-foreground">
              Registrado {formatRelative(kase.createdAt)}
            </p>
          </div>
        </div>
      </div>

      {redacted && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5">
          <FileText className="mt-px size-4 shrink-0 text-amber-700" aria-hidden />
          <p className="text-xs leading-relaxed text-amber-900">
            Está viendo la <strong>versión controlada</strong> del caso. La bolsa interna no expone
            la identidad ni la información sensible del cliente hasta que exista una asignación
            formal.
          </p>
        </div>
      )}

      {/* ------------------------------------------- Cuerpo: contenido + panel -- */}
      <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-5">
          <CaseTabs kase={kase} role={role} />
        </div>

        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <TransitionPanel kase={kase} />

          <Card>
            <CardHeader>
              <CardTitle>Ficha del caso</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="space-y-3.5">
                <DefItem label="Área">{label('AREA_PROBLEMA', kase.areaCode)}</DefItem>
                {kase.subAreaCode && (
                  <DefItem label="Subárea">{label('SUBAREA', kase.subAreaCode)}</DefItem>
                )}
                <DefItem label="Tipo de intervención">
                  {label('TIPO_INTERVENCION', kase.interventionTypeCode)}
                </DefItem>
                <DefItem label="Complejidad">{label('COMPLEJIDAD', kase.complexityCode)}</DefItem>
                <DefItem label="Urgencia">{label('URGENCIA', kase.urgencyCode)}</DefItem>
                <DefItem label="Impacto">{label('IMPACTO', kase.impactCode)}</DefItem>

                <div className="border-t border-border pt-3.5">
                  <DefItem label="Consultor responsable">
                    {kase.leadConsultant ? (
                      <span className="flex items-center gap-1.5">
                        <UserRound className="size-3.5 text-muted-foreground" aria-hidden />
                        {kase.leadConsultant.user.fullName}
                        <span className="font-mono text-2xs text-muted-foreground">
                          {kase.leadConsultant.code}
                        </span>
                      </span>
                    ) : (
                      <span className="text-muted-foreground">Sin asignar</span>
                    )}
                  </DefItem>
                </div>

                {!redacted && kase.contact && (
                  <DefItem label="Contacto del cliente">
                    <span className="block">{kase.contact.fullName}</span>
                    <span className="block text-xs text-muted-foreground">
                      {kase.contact.jobTitle}
                    </span>
                    <a
                      href={`mailto:${kase.contact.email}`}
                      className="block text-xs text-muted-foreground hover:underline"
                    >
                      {kase.contact.email}
                    </a>
                  </DefItem>
                )}
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarClock className="size-4 text-muted-foreground" aria-hidden />
                SLA de la etapa
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {kase.sla ? (
                <>
                  <SlaBadge status={kase.sla.status} percent={kase.sla.percentConsumed} />
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all',
                        kase.sla.status === 'OVERDUE'
                          ? 'bg-destructive'
                          : kase.sla.status === 'AT_RISK'
                            ? 'bg-warning'
                            : 'bg-success',
                      )}
                      style={{ width: `${Math.min(100, kase.sla.percentConsumed)}%` }}
                    />
                  </div>
                  <dl className="space-y-2">
                    <DefItem label="Regla aplicada">
                      <span className="text-xs">{kase.sla.rule.name}</span>
                    </DefItem>
                    <DefItem label="Vence">
                      <span className="text-xs">{formatDateTime(kase.sla.deadline)}</span>
                      <span className="block text-2xs text-muted-foreground">
                        {formatRelative(kase.sla.deadline)}
                      </span>
                    </DefItem>
                  </dl>
                </>
              ) : (
                <p className="text-xs text-muted-foreground">
                  No hay un reloj de SLA abierto para el estado actual.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Hitos del expediente</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="space-y-2.5 text-xs">
                <Milestone label="Registro" value={formatDate(kase.createdAt)} done />
                <Milestone
                  label="Publicación en bolsa"
                  value={kase.publishedAt ? formatDate(kase.publishedAt) : 'Pendiente'}
                  done={Boolean(kase.publishedAt)}
                />
                <Milestone
                  label="Decisión del cliente"
                  value={kase.decisionOpenedAt ? formatDate(kase.decisionOpenedAt) : 'Pendiente'}
                  done={Boolean(kase.decisionOpenedAt)}
                />
                <Milestone
                  label="Autorización de ejecución"
                  value={kase.authorizedAt ? formatDate(kase.authorizedAt) : 'Pendiente'}
                  done={Boolean(kase.authorizedAt)}
                />
                <Milestone
                  label="Inicio de ejecución"
                  value={
                    kase.executionStartedAt ? formatDate(kase.executionStartedAt) : 'Pendiente'
                  }
                  done={Boolean(kase.executionStartedAt)}
                />
                <Milestone
                  label="Cierre"
                  value={kase.closedAt ? formatDate(kase.closedAt) : 'Pendiente'}
                  done={Boolean(kase.closedAt)}
                />
              </dl>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}

function Milestone({ label, value, done }: { label: string; value: string; done: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span
        className={cn(
          'size-1.5 shrink-0 rounded-full',
          done ? 'bg-success' : 'bg-border',
        )}
        aria-hidden
      />
      <span className="min-w-0 flex-1 truncate text-muted-foreground">{label}</span>
      <span className={cn('shrink-0 tabular-nums', done ? 'font-medium' : 'text-muted-foreground')}>
        {value}
      </span>
    </div>
  );
}
