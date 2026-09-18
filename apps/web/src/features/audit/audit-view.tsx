'use client';

import * as React from 'react';
import Link from 'next/link';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Bot, ChevronLeft, ChevronRight, Lock, ShieldCheck } from 'lucide-react';
import { api } from '@/lib/api';
import { formatDateTime } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, EmptyState, Input, Select, Skeleton, TBody, TD, TH, THead, TR, Table } from '@/components/ui/primitives';
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

export function AuditView() {
  const [action, setAction] = React.useState('');
  const [origin, setOrigin] = React.useState('');
  const [search, setSearch] = React.useState('');
  const [page, setPage] = React.useState(1);
  const [expanded, setExpanded] = React.useState<string | null>(null);

  const actions = useQuery({
    queryKey: ['audit', 'actions'],
    queryFn: () => api.get<Array<{ action: string; count: number }>>('/audit/actions'),
    staleTime: 60_000,
  });

  const { data, isLoading } = useQuery({
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
      <div className="flex flex-wrap gap-2">
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Filtrar en esta página…"
          className="max-w-[240px]"
          aria-label="Filtrar registros"
        />

        <Select
          value={action}
          onChange={(event) => {
            setAction(event.target.value);
            setPage(1);
          }}
          className="w-auto min-w-[240px]"
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

        <Select
          value={origin}
          onChange={(event) => {
            setOrigin(event.target.value);
            setPage(1);
          }}
          className="w-auto min-w-[150px]"
          aria-label="Filtrar por origen"
        >
          <option value="">Cualquier origen</option>
          <option value="USER">Usuario</option>
          <option value="SYSTEM">Sistema</option>
        </Select>
      </div>

      <Card className="overflow-hidden">
        <div className="flex items-center gap-2 border-b border-border bg-secondary/40 px-5 py-2.5">
          <Lock className="size-3.5 text-muted-foreground" aria-hidden />
          <p className="text-2xs text-muted-foreground">
            Registro inmutable · {data?.meta.total ?? 0} eventos registrados
          </p>
        </div>

        {isLoading ? (
          <div className="space-y-2 p-5">
            {Array.from({ length: 8 }).map((_, index) => (
              <Skeleton key={index} className="h-10" />
            ))}
          </div>
        ) : rows.length > 0 ? (
          <>
            <Table>
              <THead>
                <TR className="hover:bg-transparent">
                  <TH>Fecha</TH>
                  <TH>Acción</TH>
                  <TH>Entidad</TH>
                  <TH>Actor</TH>
                  <TH>Caso</TH>
                  <TH className="text-right">Detalle</TH>
                </TR>
              </THead>
              <TBody>
                {rows.map((row) => (
                  <React.Fragment key={row.id}>
                    <TR>
                      <TD className="whitespace-nowrap text-2xs text-muted-foreground">
                        {formatDateTime(row.createdAt)}
                      </TD>
                      <TD>
                        <span className="font-mono text-2xs">{row.action}</span>
                      </TD>
                      <TD className="text-xs">{row.entity}</TD>
                      <TD>
                        {row.origin === 'SYSTEM' ? (
                          <span className="inline-flex items-center gap-1 text-2xs text-muted-foreground">
                            <Bot className="size-3" aria-hidden /> Sistema
                          </span>
                        ) : (
                          <>
                            <span className="block text-xs">{row.actor?.fullName ?? '—'}</span>
                            {row.actorRole && (
                              <span className="text-2xs text-muted-foreground">
                                {row.actorRole.replace(/_/g, ' ').toLowerCase()}
                              </span>
                            )}
                          </>
                        )}
                      </TD>
                      <TD>
                        {row.case ? (
                          <Link
                            href={`/cases/${row.case.id}`}
                            className="font-mono text-2xs hover:underline"
                          >
                            {row.case.code}
                          </Link>
                        ) : (
                          <span className="text-2xs text-muted-foreground">—</span>
                        )}
                      </TD>
                      <TD className="text-right">
                        <button
                          type="button"
                          className="text-2xs text-muted-foreground underline-offset-2 hover:underline"
                          onClick={() => setExpanded(expanded === row.id ? null : row.id)}
                        >
                          {expanded === row.id ? 'Ocultar' : 'Ver'}
                        </button>
                      </TD>
                    </TR>

                    {expanded === row.id && (
                      <TR className="hover:bg-transparent">
                        <TD colSpan={6} className="bg-secondary/30">
                          <div className="grid gap-3 py-1 md:grid-cols-2">
                            <AuditJson label="Valor anterior" value={row.previousValue} />
                            <AuditJson label="Valor nuevo" value={row.newValue} />
                            {row.metadata && <AuditJson label="Metadatos" value={row.metadata} />}
                            <div className="space-y-1">
                              <p className="label-caps">Trazabilidad técnica</p>
                              <p className="font-mono text-2xs text-muted-foreground">
                                id: {row.id}
                              </p>
                              {row.requestId && (
                                <p className="font-mono text-2xs text-muted-foreground">
                                  request: {row.requestId}
                                </p>
                              )}
                              {row.ip && (
                                <p className="font-mono text-2xs text-muted-foreground">
                                  ip: {row.ip}
                                </p>
                              )}
                            </div>
                          </div>
                        </TD>
                      </TR>
                    )}
                  </React.Fragment>
                ))}
              </TBody>
            </Table>

            <div className="flex items-center justify-between border-t border-border px-5 py-3">
              <p className="text-xs text-muted-foreground">
                Página {data?.meta.page} de {data?.meta.totalPages}
              </p>
              <div className="flex gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!data?.meta.hasPrev}
                  onClick={() => setPage((current) => current - 1)}
                >
                  <ChevronLeft /> Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!data?.meta.hasNext}
                  onClick={() => setPage((current) => current + 1)}
                >
                  Siguiente <ChevronRight />
                </Button>
              </div>
            </div>
          </>
        ) : (
          <CardContent>
            <EmptyState
              icon={<ShieldCheck className="size-9" />}
              title="Sin registros que coincidan"
            />
          </CardContent>
        )}
      </Card>
    </div>
  );
}

function AuditJson({ label, value }: { label: string; value: unknown }) {
  if (value === null || value === undefined) return null;

  return (
    <div className="space-y-1">
      <p className="label-caps">{label}</p>
      <pre className="scroll-x max-h-40 rounded-md border border-border bg-card p-2 font-mono text-2xs leading-relaxed">
        {JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}
