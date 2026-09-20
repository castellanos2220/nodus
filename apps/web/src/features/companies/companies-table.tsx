'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Building2, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import {
  Card,
  EmptyState,
  Skeleton,
  TBody,
  TD,
  TH,
  THead,
  TR,
  Table,
} from '@/components/ui/primitives';
import { FilterBar, SearchInput } from '@/components/ui/filter-bar';
import { EntityMark } from '@/components/ui/avatar';
import { useLookupLabel } from '@/features/lookups/use-lookups';
import type { Paginated } from '@/features/cases/types';

interface CompanyRow {
  id: string;
  code: string;
  name: string;
  taxId: string | null;
  emailDomain: string | null;
  country: string;
  city: string;
  sectorCode: string | null;
  createdAt: string;
  casesCount: number;
  contactsCount: number;
}

export function CompaniesTable() {
  const router = useRouter();
  const label = useLookupLabel();
  const [search, setSearch] = React.useState('');
  const [debounced, setDebounced] = React.useState('');

  // Debounce: evita una consulta por cada tecla pulsada.
  React.useEffect(() => {
    const timer = setTimeout(() => setDebounced(search.trim()), 350);
    return () => clearTimeout(timer);
  }, [search]);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['companies', debounced],
    queryFn: () =>
      api.get<Paginated<CompanyRow>>('/companies', {
        search: debounced || undefined,
        pageSize: 50,
      }),
    placeholderData: keepPreviousData,
  });

  return (
    <div className="space-y-4">
      <FilterBar
        trailing={
          data && (
            <span className="tabular flex items-center gap-2 text-xs text-muted-foreground">
              {isFetching && <Loader2 className="size-3 animate-spin" aria-hidden />}
              {data.meta.total} empresa{data.meta.total === 1 ? '' : 's'}
            </span>
          )
        }
      >
        <SearchInput
          value={search}
          onValueChange={setSearch}
          placeholder="Buscar por nombre, código o NIT…"
          aria-label="Buscar empresas"
          containerClassName="max-w-md"
        />
      </FilterBar>

      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="space-y-3 p-6">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-12" />
            ))}
          </div>
        ) : data && data.data.length > 0 ? (
          <Table>
            <THead>
              <tr>
                <TH>Empresa</TH>
                <TH>Identificación</TH>
                <TH>Sector</TH>
                <TH>Ubicación</TH>
                <TH className="text-right">Casos</TH>
                <TH className="text-right">Registrada</TH>
              </tr>
            </THead>
            <TBody>
              {data.data.map((company) => (
                <TR
                  key={company.id}
                  className="cursor-pointer"
                  onClick={(event) => {
                    if ((event.target as HTMLElement).closest('a')) return;
                    router.push(`/companies/${company.id}`);
                  }}
                >
                  <TD>
                    <Link
                      href={`/companies/${company.id}`}
                      className="group flex items-center gap-3"
                    >
                      <EntityMark name={company.name} />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium group-hover:text-brand-strong">
                          {company.name}
                        </span>
                        <span className="code">{company.code}</span>
                      </span>
                    </Link>
                  </TD>
                  <TD>
                    <span className="block font-mono text-xs text-ink-2">
                      {company.taxId ?? '—'}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {company.emailDomain ? `@${company.emailDomain}` : 'Sin dominio'}
                    </span>
                  </TD>
                  <TD className="text-sm text-ink-2">{label('SECTOR', company.sectorCode)}</TD>
                  <TD className="text-sm text-muted-foreground">
                    {company.city}, {company.country}
                  </TD>
                  <TD className="tabular text-right text-sm font-semibold">{company.casesCount}</TD>
                  <TD className="whitespace-nowrap text-right text-xs text-muted-foreground">
                    {formatDate(company.createdAt)}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        ) : (
          <EmptyState
            icon={<Building2 />}
            title="No hay empresas que coincidan"
            description="Las empresas se crean automáticamente al registrarse el primer caso."
          />
        )}
      </Card>
    </div>
  );
}
