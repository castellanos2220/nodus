'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { CASE_STATUS_LABEL, CASE_STATUS_ORDER, type CaseStatusCode } from '@nodus/types';
import { AlertOctagon, ChevronLeft, ChevronRight, FolderKanban, Search } from 'lucide-react';
import { api } from '@/lib/api';
import { formatDate, formatRelative } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, EmptyState, Input, Select, Skeleton, TBody, TD, TH, THead, TR, Table } from '@/components/ui/primitives';
import { CaseStatusBadge, SlaBadge } from '@/components/ui/status';
import { useLookupLabel } from '@/features/lookups/use-lookups';
import type { CaseListItem, Paginated } from './types';

const PAGE_SIZE = 20;

export function CasesTable() {
  const router = useRouter();
  const params = useSearchParams();
  const label = useLookupLabel();

  const status = params.get('status') ?? '';
  const search = params.get('search') ?? '';
  const slaStatus = params.get('slaStatus') ?? '';
  const page = Number(params.get('page') ?? '1');

  // Estado local del cuadro de búsqueda: la URL se actualiza al enviar, para que
  // el filtro sea compartible y el botón «atrás» del navegador funcione.
  const [searchDraft, setSearchDraft] = React.useState(search);
  React.useEffect(() => setSearchDraft(search), [search]);

  const setParam = (key: string, value: string): void => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== 'page') next.delete('page');
    router.push(`/cases?${next.toString()}`);
  };

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['cases', { status, search, slaStatus, page }],
    queryFn: () =>
      api.get<Paginated<CaseListItem>>('/cases', {
        status: status || undefined,
        search: search || undefined,
        slaStatus: slaStatus || undefined,
        page,
        pageSize: PAGE_SIZE,
      }),
    placeholderData: keepPreviousData,
  });

  const statusOptions = (Object.keys(CASE_STATUS_LABEL) as CaseStatusCode[]).sort(
    (a, b) => CASE_STATUS_ORDER[a] - CASE_STATUS_ORDER[b],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <form
          className="relative min-w-[220px] flex-1"
          onSubmit={(event) => {
            event.preventDefault();
            setParam('search', searchDraft.trim());
          }}
        >
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={searchDraft}
            onChange={(event) => setSearchDraft(event.target.value)}
            placeholder="Buscar por título o código de caso…"
            className="pl-9"
            aria-label="Buscar casos"
          />
        </form>

        <Select
          value={status}
          onChange={(event) => setParam('status', event.target.value)}
          className="w-auto min-w-[190px]"
          aria-label="Filtrar por estado"
        >
          <option value="">Todos los estados</option>
          {statusOptions.map((code) => (
            <option key={code} value={code}>
              {CASE_STATUS_LABEL[code]}
            </option>
          ))}
        </Select>

        <Select
          value={slaStatus}
          onChange={(event) => setParam('slaStatus', event.target.value)}
          className="w-auto min-w-[150px]"
          aria-label="Filtrar por SLA"
        >
          <option value="">Cualquier SLA</option>
          <option value="ON_TRACK">En tiempo</option>
          <option value="AT_RISK">En riesgo</option>
          <option value="OVERDUE">Vencido</option>
        </Select>

        {(status || search || slaStatus) && (
          <Button variant="ghost" size="sm" onClick={() => router.push('/cases')}>
            Limpiar
          </Button>
        )}
      </div>

      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="space-y-2 p-5">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-11" />
            ))}
          </div>
        ) : data && data.data.length > 0 ? (
          <>
            <Table>
              <THead>
                <TR className="hover:bg-transparent">
                  <TH>Caso</TH>
                  <TH>Empresa</TH>
                  <TH>Estado</TH>
                  <TH>Clasificación</TH>
                  <TH>Responsable</TH>
                  <TH>SLA</TH>
                  <TH className="text-right">Actualizado</TH>
                </TR>
              </THead>
              <TBody>
                {data.data.map((item) => (
                  <TR key={item.id}>
                    <TD>
                      <Link href={`/cases/${item.id}`} className="group block max-w-[320px]">
                        <span className="block truncate text-sm font-medium group-hover:underline">
                          {item.title}
                        </span>
                        <span className="mt-0.5 flex items-center gap-2 text-2xs text-muted-foreground">
                          <span className="font-mono">{item.code}</span>
                          {item.openIncidents > 0 && (
                            <span className="inline-flex items-center gap-0.5 text-destructive">
                              <AlertOctagon className="size-3" aria-hidden />
                              {item.openIncidents}
                            </span>
                          )}
                        </span>
                      </Link>
                    </TD>
                    <TD className="max-w-[180px]">
                      <span className="block truncate text-xs">{item.company.name}</span>
                    </TD>
                    <TD>
                      <CaseStatusBadge status={item.status} />
                    </TD>
                    <TD>
                      <span className="block text-xs">{label('AREA_PROBLEMA', item.areaCode)}</span>
                      <span className="text-2xs text-muted-foreground">
                        {item.complexityCode
                          ? `Complejidad ${label('COMPLEJIDAD', item.complexityCode).toLowerCase()}`
                          : 'Sin clasificar'}
                      </span>
                    </TD>
                    <TD className="max-w-[160px]">
                      {item.leadConsultant ? (
                        <>
                          <span className="block truncate text-xs">
                            {item.leadConsultant.fullName}
                          </span>
                          <span className="font-mono text-2xs text-muted-foreground">
                            {item.leadConsultant.code}
                          </span>
                        </>
                      ) : (
                        <span className="text-xs text-muted-foreground">Sin asignar</span>
                      )}
                    </TD>
                    <TD>
                      <SlaBadge status={item.slaStatus} percent={item.slaPercentConsumed} />
                      {item.slaDeadline && item.slaStatus && (
                        <span className="mt-0.5 block text-2xs text-muted-foreground">
                          {formatDate(item.slaDeadline)}
                        </span>
                      )}
                    </TD>
                    <TD className="text-right text-2xs text-muted-foreground">
                      {formatRelative(item.updatedAt)}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>

            <div className="flex items-center justify-between border-t border-border px-5 py-3">
              <p className="text-xs text-muted-foreground">
                {data.meta.total} caso{data.meta.total === 1 ? '' : 's'} · página {data.meta.page} de{' '}
                {data.meta.totalPages}
                {isFetching && <span className="ml-2 opacity-60">actualizando…</span>}
              </p>
              <div className="flex gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!data.meta.hasPrev}
                  onClick={() => setParam('page', String(page - 1))}
                >
                  <ChevronLeft /> Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!data.meta.hasNext}
                  onClick={() => setParam('page', String(page + 1))}
                >
                  Siguiente <ChevronRight />
                </Button>
              </div>
            </div>
          </>
        ) : (
          <EmptyState
            icon={<FolderKanban className="size-9" />}
            title="No hay casos que coincidan"
            description={
              status || search || slaStatus
                ? 'Pruebe a quitar algún filtro para ampliar la búsqueda.'
                : 'Cuando se registre una necesidad empresarial aparecerá aquí.'
            }
            action={
              (status || search || slaStatus) && (
                <Button variant="outline" size="sm" onClick={() => router.push('/cases')}>
                  Limpiar filtros
                </Button>
              )
            }
          />
        )}
      </Card>
    </div>
  );
}
