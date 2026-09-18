'use client';

import * as React from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Search, Users } from 'lucide-react';
import { CONSULTANT_STATUS_LABEL, type ConsultantStatus } from '@nodus/types';
import { api } from '@/lib/api';
import { Badge, Card, EmptyState, Input, Select, Skeleton, TBody, TD, TH, THead, TR, Table } from '@/components/ui/primitives';
import { useLookupLabel } from '@/features/lookups/use-lookups';
import type { Paginated } from '@/features/cases/types';

interface ConsultantRow {
  id: string;
  code: string;
  fullName: string;
  email: string;
  status: ConsultantStatus;
  tier: string | null;
  engagementMode: string;
  experienceLevelCode: string | null;
  maxComplexityCode: string | null;
  yearsOfExperience: number;
  availability: string;
  sponsorName: string | null;
  specialties: { specialtyCode: string; isPrimary: boolean }[];
  assignedCases: number;
  applications: number;
  evaluations: number;
}

const STATUS_TONE: Record<ConsultantStatus, 'emerald' | 'amber' | 'slate' | 'rose' | 'blue'> = {
  HABILITADO: 'emerald',
  EN_VALIDACION: 'amber',
  REGISTRADO: 'blue',
  CONDICIONADO: 'amber',
  SUSPENDIDO: 'rose',
  INACTIVO: 'slate',
};

export function ConsultantsTable() {
  const label = useLookupLabel();
  const [search, setSearch] = React.useState('');
  const [status, setStatus] = React.useState('');
  const [debounced, setDebounced] = React.useState('');

  React.useEffect(() => {
    const timer = setTimeout(() => setDebounced(search.trim()), 350);
    return () => clearTimeout(timer);
  }, [search]);

  const { data, isLoading } = useQuery({
    queryKey: ['consultants', debounced, status],
    queryFn: () =>
      api.get<Paginated<ConsultantRow>>('/consultants', {
        search: debounced || undefined,
        status: status || undefined,
        pageSize: 50,
      }),
    placeholderData: keepPreviousData,
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-[240px] flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por nombre, código o correo…"
            className="pl-9"
            aria-label="Buscar consultores"
          />
        </div>

        <Select
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          className="w-auto min-w-[180px]"
          aria-label="Filtrar por estado"
        >
          <option value="">Todos los estados</option>
          {(Object.keys(CONSULTANT_STATUS_LABEL) as ConsultantStatus[]).map((code) => (
            <option key={code} value={code}>
              {CONSULTANT_STATUS_LABEL[code]}
            </option>
          ))}
        </Select>
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
                <TH>Consultor</TH>
                <TH>Estado</TH>
                <TH>Especialidades</TH>
                <TH>Nivel / complejidad</TH>
                <TH>Vinculación</TH>
                <TH className="text-right">Casos</TH>
              </TR>
            </THead>
            <TBody>
              {data.data.map((consultant) => (
                <TR key={consultant.id}>
                  <TD>
                    <span className="block text-sm font-medium">{consultant.fullName}</span>
                    <span className="font-mono text-2xs text-muted-foreground">
                      {consultant.code} · {consultant.yearsOfExperience} años
                    </span>
                  </TD>
                  <TD>
                    <Badge tone={STATUS_TONE[consultant.status]}>
                      {CONSULTANT_STATUS_LABEL[consultant.status]}
                    </Badge>
                  </TD>
                  <TD>
                    <div className="flex max-w-[220px] flex-wrap gap-1">
                      {consultant.specialties.slice(0, 3).map((specialty) => (
                        <Badge
                          key={specialty.specialtyCode}
                          tone={specialty.isPrimary ? 'indigo' : 'outline'}
                        >
                          {label('ESPECIALIDAD', specialty.specialtyCode)}
                        </Badge>
                      ))}
                    </div>
                  </TD>
                  <TD>
                    <span className="block text-xs">
                      {label('NIVEL_CONSULTOR', consultant.experienceLevelCode)}
                    </span>
                    <span className="text-2xs text-muted-foreground">
                      hasta {label('COMPLEJIDAD', consultant.maxComplexityCode).toLowerCase()}
                    </span>
                  </TD>
                  <TD>
                    <span className="block text-xs">
                      {consultant.engagementMode.toLowerCase()}
                    </span>
                    {consultant.sponsorName && (
                      <span className="text-2xs text-muted-foreground">
                        {consultant.sponsorName}
                      </span>
                    )}
                  </TD>
                  <TD className="text-right">
                    <span className="font-mono text-sm font-semibold">
                      {consultant.assignedCases}
                    </span>
                    <span className="block text-2xs text-muted-foreground">
                      {consultant.applications} postulación
                      {consultant.applications === 1 ? '' : 'es'}
                    </span>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        ) : (
          <EmptyState
            icon={<Users className="size-9" />}
            title="No hay consultores que coincidan"
          />
        )}
      </Card>
    </div>
  );
}
