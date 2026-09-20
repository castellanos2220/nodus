'use client';

import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { Button } from './button';

export interface PageMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

/** Pie de tabla: rango visible, total y navegación. */
export function Pagination({
  meta,
  onPageChange,
  noun = ['registro', 'registros'],
  isFetching,
}: {
  meta: PageMeta;
  onPageChange: (page: number) => void;
  noun?: [string, string];
  isFetching?: boolean;
}) {
  const from = meta.total === 0 ? 0 : (meta.page - 1) * meta.pageSize + 1;
  const to = Math.min(meta.page * meta.pageSize, meta.total);

  return (
    <div className="flex items-center justify-between gap-3 border-t border-border px-5 py-2.5">
      <p className="tabular flex items-center gap-2 text-body-sm text-muted-foreground">
        <span>
          <span className="font-medium text-foreground">
            {from}–{to}
          </span>{' '}
          de {meta.total} {meta.total === 1 ? noun[0] : noun[1]}
        </span>
        {isFetching && <Loader2 className="size-3.5 animate-spin" aria-label="Actualizando" />}
      </p>

      <div className="flex items-center gap-1">
        <span className="tabular mr-2 hidden text-body-sm text-muted-foreground sm:inline">
          Página {meta.page} de {Math.max(1, meta.totalPages)}
        </span>
        <Button
          variant="secondary"
          size="icon-sm"
          disabled={!meta.hasPrev}
          onClick={() => onPageChange(meta.page - 1)}
          aria-label="Página anterior"
        >
          <ChevronLeft />
        </Button>
        <Button
          variant="secondary"
          size="icon-sm"
          disabled={!meta.hasNext}
          onClick={() => onPageChange(meta.page + 1)}
          aria-label="Página siguiente"
        >
          <ChevronRight />
        </Button>
      </div>
    </div>
  );
}
