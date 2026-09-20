'use client';

import * as React from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Loader2, UsersRound } from 'lucide-react';
import { CONSULTANT_STATUS_LABEL, type ConsultantStatus } from '@nodus/types';
import { api } from '@/lib/api';
import { humanizeCode } from '@/lib/utils';
import {
  Badge,
  type BadgeProps,
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
import { PersonCell } from '@/components/ui/avatar';
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

/**
 * El estado del consultor sí lleva color, pero sólo donde cambia lo que puede
 * hacer: habilitado (puede operar), condicionado (con reservas), suspendido
 * (bloqueado). Registro, validación e inactividad son neutros.
 */
const STATUS_TONE: Record<ConsultantStatus, NonNullable<BadgeProps['tone']>> = {
  HABILITADO: 'success',
  EN_VALIDACION: 'outline',
  REGISTRADO: 'outline',
  CONDICIONADO: 'warning',
  SUSPENDIDO: 'danger',
  INACTIVO: 'neutral',
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

  const { data, isLoading, isFetching } = useQuery({
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
      <FilterBar
        trailing={
          data && (
            <span className="tabular flex items-center gap-2 text-xs text-muted-foreground">
              {isFetching && <Loader2 className="size-3 animate-spin" aria-hidden />}
              {data.meta.total} consultor{data.meta.total === 1 ? '' : 'es'}
            </span>
          )
        }
      >
        <SearchInput
          value={search}
          onValueChange={setSearch}
          placeholder="Buscar por nombre, código o correo…"
          aria-label="Buscar consultores"
          containerClassName="max-w-md"
        />

        <Select
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          className="w-auto min-w-[190px]"
          aria-label="Filtrar por estado"
        >
          <option value="">Todos los estados</option>
          {(Object.keys(CONSULTANT_STATUS_LABEL) as ConsultantStatus[]).map((code) => (
            <option key={code} value={code}>
              {CONSULTANT_STATUS_LABEL[code]}
            </option>
          ))}
        </Select>
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
                <TH>Consultor</TH>
                <TH>Estado</TH>
                <TH>Especialidades</TH>
                <TH>Nivel / complejidad</TH>
                <TH>Vinculación</TH>
                <TH className="text-right">Casos</TH>
              </tr>
            </THead>
            <TBody>
              {data.data.map((consultant) => (
                <TR key={consultant.id}>
                  <TD className="max-w-[260px]">
                    <PersonCell
                      name={consultant.fullName}
                      size="md"
                      secondary={
                        <span className="text-xs text-muted-foreground">
                          <span className="code">{consultant.code}</span> ·{' '}
                          {consultant.yearsOfExperience} años
                        </span>
                      }
                    />
                  </TD>
                  <TD>
                    <Badge tone={STATUS_TONE[consultant.status]} dot>
                      {CONSULTANT_STATUS_LABEL[consultant.status]}
                    </Badge>
                  </TD>
                  <TD>
                    <div className="flex max-w-[240px] flex-wrap gap-1">
                      {consultant.specialties.slice(0, 3).map((specialty) => (
                        <Badge
                          key={specialty.specialtyCode}
                          tone={specialty.isPrimary ? 'outline' : 'neutral'}
                          className={
                            specialty.isPrimary ? 'font-semibold text-foreground' : undefined
                          }
                        >
                          {label('ESPECIALIDAD', specialty.specialtyCode)}
                        </Badge>
                      ))}
                    </div>
                  </TD>
                  <TD>
                    <span className="block text-sm text-ink-2">
                      {label('NIVEL_CONSULTOR', consultant.experienceLevelCode)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      hasta {label('COMPLEJIDAD', consultant.maxComplexityCode).toLowerCase()}
                    </span>
                  </TD>
                  <TD>
                    <span className="block text-sm text-ink-2">
                      {humanizeCode(consultant.engagementMode)}
                    </span>
                    {consultant.sponsorName && (
                      <span className="text-xs text-muted-foreground">
                        {consultant.sponsorName}
                      </span>
                    )}
                  </TD>
                  <TD className="text-right">
                    <span className="tabular text-sm font-semibold">
                      {consultant.assignedCases}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {consultant.applications} postulación
                      {consultant.applications === 1 ? '' : 'es'}
                    </span>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        ) : (
          <EmptyState icon={<UsersRound />} title="No hay consultores que coincidan" />
        )}
      </Card>
    </div>
  );
}
