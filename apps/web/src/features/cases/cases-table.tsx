'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { CASE_STATUS_LABEL, CASE_STATUS_ORDER, type CaseStatusCode } from '@nodus/types';
import { AlertOctagon, FolderKanban, X } from 'lucide-react';
import { api } from '@/lib/api';
import { formatDate, formatRelative } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Card,
  EmptyState,
  Select,
  Skeleton,
  TBody,
  TD,
  TH,
  THead,
  TR,
  Table,
} from '@/components/ui/primitives';
import { FilterBar, SearchInput } from '@/components/ui/filter-bar';
import { SegmentedControl } from '@/components/ui/segmented';
import { Pagination } from '@/components/ui/pagination';
import { PersonCell } from '@/components/ui/avatar';
import { SlaIndicator, StatusBadge } from '@/components/ui/status';
import { useLookupLabel } from '@/features/lookups/use-lookups';
import type { CaseListItem, Paginated } from './types';

const PAGE_SIZE = 20;

type SlaFilter = '' | 'ON_TRACK' | 'AT_RISK' | 'OVERDUE';

const SLA_OPTIONS: Array<{ value: SlaFilter; label: string }> = [
  { value: '', label: 'Todos' },
  { value: 'ON_TRACK', label: 'En tiempo' },
  { value: 'AT_RISK', label: 'En riesgo' },
  { value: 'OVERDUE', label: 'Vencido' },
];

export function CasesTable() {
  const router = useRouter();
  const params = useSearchParams();
  const label = useLookupLabel();

  const status = params.get('status') ?? '';
  const search = params.get('search') ?? '';
  const slaStatus = (params.get('slaStatus') ?? '') as SlaFilter;
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

  const filtered = Boolean(status || search || slaStatus);

  return (
    <div className="space-y-4">
      <FilterBar
        trailing={
          filtered && (
            <Button variant="ghost" size="sm" onClick={() => router.push('/cases')}>
              <X /> Limpiar filtros
            </Button>
          )
        }
      >
        <form
          className="min-w-[240px] flex-1 sm:max-w-sm"
          onSubmit={(event) => {
            event.preventDefault();
            setParam('search', searchDraft.trim());
          }}
        >
          <SearchInput
            value={searchDraft}
            onValueChange={(value) => {
              setSearchDraft(value);
              if (value === '' && search) setParam('search', '');
            }}
            placeholder="Buscar por título o código…"
            aria-label="Buscar casos"
          />
        </form>

        <Select
          value={status}
          onChange={(event) => setParam('status', event.target.value)}
          className="w-auto min-w-[200px]"
          aria-label="Filtrar por estado"
        >
          <option value="">Todos los estados</option>
          {statusOptions.map((code) => (
            <option key={code} value={code}>
              {CASE_STATUS_LABEL[code]}
            </option>
          ))}
        </Select>

        <SegmentedControl
          options={SLA_OPTIONS}
          value={slaStatus}
          onValueChange={(value) => setParam('slaStatus', value)}
          layoutId="cases-sla-filter"
          ariaLabel="Filtrar por SLA"
        />
      </FilterBar>

      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="space-y-3 p-6">
            {Array.from({ length: 7 }).map((_, index) => (
              <Skeleton key={index} className="h-12" />
            ))}
          </div>
        ) : data && data.data.length > 0 ? (
          <>
            <Table>
              <THead>
                <tr>
                  <TH>Caso</TH>
                  <TH className="hidden 2xl:table-cell">Empresa</TH>
                  <TH>Estado</TH>
                  <TH>Clasificación</TH>
                  <TH>Responsable</TH>
                  <TH>SLA</TH>
                  <TH className="text-right">Actualizado</TH>
                </tr>
              </THead>
              <TBody>
                {data.data.map((item) => (
                  <TR
                    key={item.id}
                    className="cursor-pointer"
                    onClick={(event) => {
                      // La fila entera navega; el enlace del título sigue siendo
                      // el elemento accesible por teclado.
                      if ((event.target as HTMLElement).closest('a')) return;
                      router.push(`/cases/${item.id}`);
                    }}
                  >
                    <TD className="max-w-[300px]">
                      <Link href={`/cases/${item.id}`} className="group block">
                        <span className="block truncate text-sm font-medium text-foreground group-hover:text-brand-strong">
                          {item.title}
                        </span>
                        <span className="mt-1 flex min-w-0 items-center gap-2">
                          <span className="code shrink-0">{item.code}</span>
                          <span className="truncate text-xs text-muted-foreground 2xl:hidden">
                            {item.company.name}
                          </span>
                          {item.openIncidents > 0 && (
                            <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-2xs font-medium text-danger">
                              <AlertOctagon className="size-3" aria-hidden />
                              {item.openIncidents} incidencia{item.openIncidents === 1 ? '' : 's'}
                            </span>
                          )}
                        </span>
                      </Link>
                    </TD>
                    <TD className="hidden max-w-[200px] 2xl:table-cell">
                      <span className="block truncate text-sm text-ink-2">{item.company.name}</span>
                    </TD>
                    <TD>
                      <StatusBadge status={item.status} variant="plain" />
                    </TD>
                    <TD className="max-w-[170px]">
                      {item.areaCode ? (
                        <>
                          <span className="block truncate text-sm text-ink-2">
                            {label('AREA_PROBLEMA', item.areaCode)}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {item.complexityCode
                              ? `Complejidad ${label('COMPLEJIDAD', item.complexityCode).toLowerCase()}`
                              : 'Sin clasificar'}
                          </span>
                        </>
                      ) : (
                        <span className="text-xs text-subtle-foreground">Sin clasificar</span>
                      )}
                    </TD>
                    <TD className="max-w-[200px]">
                      {item.leadConsultant ? (
                        <PersonCell
                          name={item.leadConsultant.fullName}
                          secondary={<span className="code">{item.leadConsultant.code}</span>}
                        />
                      ) : (
                        <span className="text-xs text-subtle-foreground">Sin asignar</span>
                      )}
                    </TD>
                    <TD>
                      <SlaIndicator
                        status={item.slaStatus}
                        percent={item.slaPercentConsumed}
                        deadline={
                          item.slaDeadline && item.slaStatus ? formatDate(item.slaDeadline) : null
                        }
                      />
                    </TD>
                    <TD className="whitespace-nowrap text-right text-xs text-muted-foreground">
                      {formatRelative(item.updatedAt)}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>

            <Pagination
              meta={data.meta}
              noun={['caso', 'casos']}
              isFetching={isFetching}
              onPageChange={(next) => setParam('page', String(next))}
            />
          </>
        ) : (
          <EmptyState
            icon={<FolderKanban />}
            title="No hay casos que coincidan"
            description={
              filtered
                ? 'Pruebe a quitar algún filtro para ampliar la búsqueda.'
                : 'Cuando se registre una necesidad empresarial aparecerá aquí.'
            }
            action={
              filtered && (
                <Button variant="secondary" size="sm" onClick={() => router.push('/cases')}>
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
