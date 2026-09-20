'use client';

import * as React from 'react';
import Link from 'next/link';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Bot, ChevronDown, Lock, ScrollText } from 'lucide-react';
import { api } from '@/lib/api';
import { cn, formatDateTime } from '@/lib/utils';
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
import { UserAvatar } from '@/components/ui/avatar';
import type { Paginated } from '@/features/cases/types';

interface AuditRow {
  id: string;
  createdAt: string;
  action: string;
  entity: string;
  entityId: string | null;
  origin: 'USER' | 'SYSTEM';
  previousValue: unknown;
  newValue: unknown;
  metadata: Record<string, unknown> | null;
  ip: string | null;
  requestId: string | null;
  actorRole: string | null;
  actor: { id: string; fullName: string; email: string } | null;
  case: { id: string; code: string; title: string } | null;
  company: { id: string; code: string; name: string } | null;
}

type OriginFilter = '' | 'USER' | 'SYSTEM';

export function AuditView() {
  const [action, setAction] = React.useState('');
  const [origin, setOrigin] = React.useState<OriginFilter>('');
  const [search, setSearch] = React.useState('');
  const [page, setPage] = React.useState(1);
  const [expanded, setExpanded] = React.useState<string | null>(null);

  const actions = useQuery({
    queryKey: ['audit', 'actions'],
    queryFn: () => api.get<Array<{ action: string; count: number }>>('/audit/actions'),
    staleTime: 60_000,
  });

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['audit', { action, origin, page }],
    queryFn: () =>
      api.get<Paginated<AuditRow>>('/audit', {
        action: action || undefined,
        origin: origin || undefined,
        page,
        pageSize: 25,
      }),
    placeholderData: keepPreviousData,
  });

  const rows = (data?.data ?? []).filter((row) =>
    search
      ? `${row.action} ${row.entity} ${row.actor?.fullName ?? ''} ${row.case?.code ?? ''}`
          .toLowerCase()
          .includes(search.toLowerCase())
      : true,
  );

  return (
    <div className="space-y-4">
      <FilterBar>
        <SearchInput
          value={search}
          onValueChange={setSearch}
          placeholder="Filtrar en esta página…"
          aria-label="Filtrar registros"
          containerClassName="max-w-xs"
        />

        <Select
          value={action}
          onChange={(event) => {
            setAction(event.target.value);
            setPage(1);
          }}
          className="w-auto min-w-[260px]"
          aria-label="Filtrar por acción"
        >
          <option value="">Todas las acciones</option>
          <option value="CASE_TRANSITION_">— Sólo transiciones de estado —</option>
          {(actions.data ?? []).map((item) => (
            <option key={item.action} value={item.action}>
              {item.action} ({item.count})
            </option>
          ))}
        </Select>

        <SegmentedControl<OriginFilter>
          options={[
            { value: '', label: 'Todo origen' },
            { value: 'USER', label: 'Usuario' },
            { value: 'SYSTEM', label: 'Sistema' },
          ]}
          value={origin}
          onValueChange={(value) => {
            setOrigin(value);
            setPage(1);
          }}
          layoutId="audit-origin"
          ariaLabel="Filtrar por origen"
        />
      </FilterBar>

      <Card className="overflow-hidden">
        <div className="flex items-center gap-2.5 border-b border-border px-6 py-3">
          <Lock className="size-3.5 text-muted-foreground" aria-hidden />
          <p className="text-xs text-muted-foreground">
            Registro inmutable ·{' '}
            <span className="tabular font-medium text-foreground">{data?.meta.total ?? 0}</span>{' '}
            eventos registrados
          </p>
        </div>

        {isLoading ? (
          <div className="space-y-3 p-6">
            {Array.from({ length: 8 }).map((_, index) => (
              <Skeleton key={index} className="h-10" />
            ))}
          </div>
        ) : rows.length > 0 ? (
          <>
            <Table>
              <THead>
                <tr>
                  <TH>Fecha</TH>
                  <TH>Acción</TH>
                  <TH>Entidad</TH>
                  <TH>Actor</TH>
                  <TH>Caso</TH>
                  <TH className="w-12">
                    <span className="sr-only">Detalle</span>
                  </TH>
                </tr>
              </THead>
              <TBody>
                {rows.map((row) => {
                  const open = expanded === row.id;
                  return (
                    <React.Fragment key={row.id}>
                      <TR
                        className={cn('cursor-pointer', open && 'bg-muted/45')}
                        onClick={() => setExpanded(open ? null : row.id)}
                      >
                        <TD className="tabular whitespace-nowrap text-xs text-muted-foreground">
                          {formatDateTime(row.createdAt)}
                        </TD>
                        <TD>
                          <span className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[11px] text-ink-2">
                            {row.action}
                          </span>
                        </TD>
                        <TD className="text-sm text-ink-2">{row.entity}</TD>
                        <TD>
                          {row.origin === 'SYSTEM' ? (
                            <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                              <span className="flex size-6 items-center justify-center rounded-full border border-border bg-card">
                                <Bot className="size-3.5" aria-hidden />
                              </span>
                              Sistema
                            </span>
                          ) : (
                            <span className="flex items-center gap-2">
                              <UserAvatar name={row.actor?.fullName ?? '—'} size="sm" />
                              <span className="min-w-0">
                                <span className="block truncate text-sm">
                                  {row.actor?.fullName ?? '—'}
                                </span>
                                {row.actorRole && (
                                  <span className="block text-2xs text-muted-foreground">
                                    {row.actorRole.replace(/_/g, ' ').toLowerCase()}
                                  </span>
                                )}
                              </span>
                            </span>
                          )}
                        </TD>
                        <TD>
                          {row.case ? (
                            <Link
                              href={`/cases/${row.case.id}`}
                              className="code hover:text-brand-strong"
                              onClick={(event) => event.stopPropagation()}
                            >
                              {row.case.code}
                            </Link>
                          ) : (
                            <span className="text-xs text-subtle-foreground">—</span>
                          )}
                        </TD>
                        <TD className="text-right">
                          <button
                            type="button"
                            className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                            aria-expanded={open}
                            aria-label={open ? 'Ocultar detalle' : 'Ver detalle'}
                            onClick={(event) => {
                              event.stopPropagation();
                              setExpanded(open ? null : row.id);
                            }}
                          >
                            <ChevronDown
                              className={cn('size-4 transition-transform', open && 'rotate-180')}
                              aria-hidden
                            />
                          </button>
                        </TD>
                      </TR>

                      {open && (
                        <tr>
                          <td
                            colSpan={6}
                            className="border-t border-border bg-background px-6 py-5"
                          >
                            <div className="grid gap-4 md:grid-cols-2">
                              <AuditJson label="Valor anterior" value={row.previousValue} />
                              <AuditJson label="Valor nuevo" value={row.newValue} />
                              {row.metadata && <AuditJson label="Metadatos" value={row.metadata} />}
                              <div className="space-y-1.5">
                                <p className="label-caps">Trazabilidad técnica</p>
                                <dl className="space-y-1 font-mono text-[11px] text-muted-foreground">
                                  <div>id: {row.id}</div>
                                  {row.requestId && <div>request: {row.requestId}</div>}
                                  {row.ip && <div>ip: {row.ip}</div>}
                                </dl>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </TBody>
            </Table>

            {data && (
              <Pagination
                meta={data.meta}
                noun={['evento', 'eventos']}
                isFetching={isFetching}
                onPageChange={setPage}
              />
            )}
          </>
        ) : (
          <EmptyState icon={<ScrollText />} title="Sin registros que coincidan" />
        )}
      </Card>
    </div>
  );
}

function AuditJson({ label, value }: { label: string; value: unknown }) {
  if (value === null || value === undefined) return null;

  return (
    <div className="min-w-0 space-y-1.5">
      <p className="label-caps">{label}</p>
      <pre className="scroll-x max-h-48 rounded-md border border-border bg-card p-3 font-mono text-[11px] leading-relaxed text-ink-2">
        {JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}
