'use client';

import * as React from 'react';
import Link from 'next/link';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Building2, Search } from 'lucide-react';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { Card, EmptyState, Input, Skeleton, TBody, TD, TH, THead, TR, Table } from '@/components/ui/primitives';
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
  const label = useLookupLabel();
  const [search, setSearch] = React.useState('');
  const [debounced, setDebounced] = React.useState('');

  // Debounce: evita una consulta por cada tecla pulsada.
  React.useEffect(() => {
    const timer = setTimeout(() => setDebounced(search.trim()), 350);
    return () => clearTimeout(timer);
  }, [search]);

  const { data, isLoading } = useQuery({
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
      <div className="relative max-w-md">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar por nombre, código o NIT…"
          className="pl-9"
          aria-label="Buscar empresas"
        />
      </div>

      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="space-y-2 p-5">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-11" />
            ))}
          </div>
        ) : data && data.data.length > 0 ? (
          <Table>
            <THead>
              <TR className="hover:bg-transparent">
                <TH>Empresa</TH>
                <TH>Identificación</TH>
                <TH>Dominio</TH>
                <TH>Sector</TH>
                <TH>Ubicación</TH>
                <TH className="text-right">Casos</TH>
                <TH className="text-right">Registrada</TH>
              </TR>
            </THead>
            <TBody>
              {data.data.map((company) => (
                <TR key={company.id}>
                  <TD>
                    <Link href={`/companies/${company.id}`} className="group block">
                      <span className="block text-sm font-medium group-hover:underline">
                        {company.name}
                      </span>
                      <span className="font-mono text-2xs text-muted-foreground">
                        {company.code}
                      </span>
                    </Link>
                  </TD>
                  <TD className="font-mono text-xs">{company.taxId ?? '—'}</TD>
                  <TD className="text-xs text-muted-foreground">
                    {company.emailDomain ? `@${company.emailDomain}` : '—'}
                  </TD>
                  <TD className="text-xs">{label('SECTOR', company.sectorCode)}</TD>
                  <TD className="text-xs text-muted-foreground">
                    {company.city}, {company.country}
                  </TD>
                  <TD className="text-right font-mono text-sm font-semibold">
                    {company.casesCount}
                  </TD>
                  <TD className="whitespace-nowrap text-right text-2xs text-muted-foreground">
                    {formatDate(company.createdAt)}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        ) : (
          <EmptyState
            icon={<Building2 className="size-9" />}
            title="No hay empresas que coincidan"
            description="Las empresas se crean automáticamente al registrarse el primer caso."
          />
        )}
      </Card>
    </div>
  );
}
