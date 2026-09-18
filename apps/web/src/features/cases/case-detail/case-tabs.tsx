'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Role } from '@nodus/types';
import { CASE_STATUS_LABEL } from '@nodus/types';
import {
  Activity as ActivityIcon,
  ArrowRight,
  Bot,
  CheckCircle2,
  CircleDashed,
  ClipboardCheck,
  FileStack,
  FileText,
  Flag,
  MessageSquare,
  Package,
  ScrollText,
  Users,
} from 'lucide-react';
import { api } from '@/lib/api';
import { cn, formatDate, formatDateTime, formatRelative } from '@/lib/utils';
import { Badge, Card, CardContent, CardHeader, CardTitle, DefItem, EmptyState, Skeleton, TBody, TD, TH, THead, TR, Table } from '@/components/ui/primitives';
import { CaseStatusBadge } from '@/components/ui/status';
import { useLookupLabel } from '@/features/lookups/use-lookups';
import type { CaseDetail, StatusHistoryEntry, TimelineEntry } from '../types';

type TabId =
  | 'overview'
  | 'timeline'
  | 'applications'
  | 'proposal'
  | 'contract'
  | 'execution'
  | 'documents'
  | 'communications';

interface TabDefinition {
  id: TabId;
  label: string;
  icon: typeof FileText;
  /** `null` = siempre visible; si no, se muestra cuando el contador es > 0. */
  count?: number | null;
}

export function CaseTabs({ kase, role }: { kase: CaseDetail; role: Role }) {
  const [tab, setTab] = React.useState<TabId>('overview');

  const tabs: TabDefinition[] = [
    { id: 'overview', label: 'Resumen', icon: FileText },
    { id: 'timeline', label: 'Trazabilidad', icon: ScrollText },
    { id: 'applications', label: 'Postulaciones', icon: Users, count: kase.counts.applications },
    { id: 'proposal', label: 'Propuesta', icon: FileStack, count: kase.counts.proposalVersions },
    { id: 'contract', label: 'Contratación', icon: ClipboardCheck },
    {
      id: 'execution',
      label: 'Ejecución',
      icon: ActivityIcon,
      count: kase.counts.activities + kase.counts.milestones + kase.counts.deliverables,
    },
    { id: 'documents', label: 'Documentos', icon: Package, count: kase.counts.documents },
    {
      id: 'communications',
      label: 'Comunicaciones',
      icon: MessageSquare,
      count: kase.counts.communications + kase.counts.meetings,
    },
  ];

  return (
    <div className="space-y-4">
      {/* Navegación de pestañas: scroll horizontal propio en pantallas estrechas. */}
      <div className="scroll-x border-b border-border">
        <div className="flex min-w-max gap-0.5" role="tablist">
          {tabs.map((definition) => {
            const active = tab === definition.id;
            return (
              <button
                key={definition.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setTab(definition.id)}
                className={cn(
                  'flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm transition-colors',
                  active
                    ? 'border-primary font-medium text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground',
                )}
              >
                <definition.icon className="size-4" aria-hidden />
                {definition.label}
                {typeof definition.count === 'number' && definition.count > 0 && (
                  <span className="rounded bg-secondary px-1.5 py-px font-mono text-2xs">
                    {definition.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div role="tabpanel" className="animate-fade-in">
        {tab === 'overview' && <OverviewTab kase={kase} />}
        {tab === 'timeline' && <TimelineTab caseId={kase.id} />}
        {tab === 'applications' && <ApplicationsTab caseId={kase.id} role={role} />}
        {tab === 'proposal' && <ProposalTab caseId={kase.id} />}
        {tab === 'contract' && <ContractTab caseId={kase.id} />}
        {tab === 'execution' && <ExecutionTab caseId={kase.id} />}
        {tab === 'documents' && <DocumentsTab caseId={kase.id} />}
        {tab === 'communications' && <CommunicationsTab caseId={kase.id} />}
      </div>
    </div>
  );
}

// ============================================================================
//  Resumen
// ============================================================================

function OverviewTab({ kase }: { kase: CaseDetail }) {
  const label = useLookupLabel();

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Necesidad registrada</CardTitle>
          <p className="text-xs text-muted-foreground">
            Plantilla T1 · el relato original del cliente no se modifica
          </p>
        </CardHeader>
        <CardContent>
          <p className="whitespace-pre-line text-sm leading-relaxed">{kase.description}</p>
        </CardContent>
      </Card>

      {kase.classification ? (
        <Card>
          <CardHeader>
            <CardTitle>Clasificación (T2)</CardTitle>
            <p className="text-xs text-muted-foreground">
              Registrada por {kase.classification.classifiedBy?.fullName ?? 'Advisory'} ·{' '}
              {formatDate(kase.classification.createdAt)}
              {kase.classification.confirmedAt && ' · confirmada'}
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <dl className="grid gap-4 sm:grid-cols-3">
              <DefItem label="Área">{label('AREA_PROBLEMA', kase.classification.areaCode)}</DefItem>
              <DefItem label="Tipo de intervención">
                {label('TIPO_INTERVENCION', kase.classification.interventionTypeCode)}
              </DefItem>
              <DefItem label="Complejidad">
                {label('COMPLEJIDAD', kase.classification.complexityCode)}
              </DefItem>
              <DefItem label="Impacto">{label('IMPACTO', kase.classification.impactCode)}</DefItem>
              <DefItem label="Urgencia">{label('URGENCIA', kase.classification.urgencyCode)}</DefItem>
              <DefItem label="Elegibilidad">
                <Badge tone={kase.classification.eligibility === 'ELEGIBLE' ? 'emerald' : 'rose'}>
                  {kase.classification.eligibility.replace(/_/g, ' ').toLowerCase()}
                </Badge>
              </DefItem>
            </dl>

            <div className="border-t border-border pt-4">
              <p className="label-caps mb-1.5">Observaciones de la revisión</p>
              <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                {kase.classification.reviewNotes}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent>
            <EmptyState
              icon={<CircleDashed className="size-8" />}
              title="El caso aún no ha sido clasificado"
              description="Advisory registrará la clasificación T2 durante la debida diligencia."
            />
          </CardContent>
        </Card>
      )}

      <StatusHistoryCard caseId={kase.id} />

      {kase.closedAt && (
        <Card>
          <CardHeader>
            <CardTitle>Cierre del caso</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-4 sm:grid-cols-2">
              <DefItem label="Fecha de cierre">{formatDateTime(kase.closedAt)}</DefItem>
              <DefItem label="Motivo">{kase.closureReason ?? '—'}</DefItem>
            </dl>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StatusHistoryCard({ caseId }: { caseId: string }) {
  const { data } = useQuery({
    queryKey: ['case', caseId, 'status-history'],
    queryFn: () => api.get<StatusHistoryEntry[]>(`/cases/${caseId}/status-history`),
  });

  if (!data || data.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recorrido por los estados</CardTitle>
        <p className="text-xs text-muted-foreground">
          Con el tiempo permanecido en cada etapa, base de los indicadores de ciclo
        </p>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <THead>
            <TR className="hover:bg-transparent">
              <TH>Transición</TH>
              <TH>Desde → Hacia</TH>
              <TH>Actor</TH>
              <TH className="text-right">Permanencia</TH>
              <TH className="text-right">Fecha</TH>
            </TR>
          </THead>
          <TBody>
            {data.map((entry) => (
              <TR key={entry.id}>
                <TD>
                  <span className="font-mono text-2xs">{entry.transitionCode}</span>
                  {entry.note && (
                    <span className="mt-0.5 block max-w-sm truncate text-2xs text-muted-foreground">
                      {entry.note}
                    </span>
                  )}
                </TD>
                <TD>
                  <span className="flex items-center gap-1.5">
                    {entry.previousStatus ? (
                      <span className="text-2xs text-muted-foreground">
                        {CASE_STATUS_LABEL[entry.previousStatus]}
                      </span>
                    ) : (
                      <span className="text-2xs text-muted-foreground">—</span>
                    )}
                    <ArrowRight className="size-3 text-muted-foreground/60" aria-hidden />
                    <CaseStatusBadge status={entry.newStatus} />
                  </span>
                </TD>
                <TD>
                  {entry.origin === 'SYSTEM' ? (
                    <span className="inline-flex items-center gap-1 text-2xs text-muted-foreground">
                      <Bot className="size-3" aria-hidden /> Sistema
                    </span>
                  ) : (
                    <span className="text-xs">{entry.actor?.fullName ?? '—'}</span>
                  )}
                </TD>
                <TD className="text-right font-mono text-2xs tabular-nums text-muted-foreground">
                  {entry.hoursInPreviousStatus
                    ? `${Number(entry.hoursInPreviousStatus).toFixed(1)} h`
                    : '—'}
                </TD>
                <TD className="whitespace-nowrap text-right text-2xs text-muted-foreground">
                  {formatDateTime(entry.createdAt)}
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </CardContent>
    </Card>
  );
}

// ============================================================================
//  Trazabilidad (bitácora)
// ============================================================================

function TimelineTab({ caseId }: { caseId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['case', caseId, 'timeline'],
    queryFn: () => api.get<TimelineEntry[]>(`/cases/${caseId}/timeline`),
  });

  if (isLoading) return <Skeleton className="h-96" />;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Bitácora del caso</CardTitle>
        <p className="text-xs text-muted-foreground">
          Registro inmutable: no puede modificarse ni eliminarse desde la aplicación
        </p>
      </CardHeader>
      <CardContent>
        {data && data.length > 0 ? (
          <ol className="relative space-y-4 border-l border-border pl-5">
            {data.map((entry) => (
              <li key={entry.id} className="relative">
                <span
                  className={cn(
                    'absolute -left-[26px] top-1 size-2.5 rounded-full border-2 border-card',
                    entry.origin === 'SYSTEM' ? 'bg-muted-foreground/50' : 'bg-primary',
                  )}
                  aria-hidden
                />
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-sm font-medium">{entry.actionLabel}</p>
                  <time className="shrink-0 text-2xs text-muted-foreground">
                    {formatDateTime(entry.createdAt)}
                  </time>
                </div>
                <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-2xs text-muted-foreground">
                  {entry.origin === 'SYSTEM' ? (
                    <span className="inline-flex items-center gap-1">
                      <Bot className="size-3" aria-hidden /> Sistema
                    </span>
                  ) : (
                    <span>{entry.actor?.fullName ?? 'Usuario'}</span>
                  )}
                  <span className="text-muted-foreground/50">·</span>
                  <span className="font-mono">{entry.entity}</span>
                </p>
                {renderAuditDelta(entry)}
              </li>
            ))}
          </ol>
        ) : (
          <EmptyState title="Sin eventos registrados todavía" />
        )}
      </CardContent>
    </Card>
  );
}

/** Muestra el delta auditado de forma legible, sin volcar todo el JSON. */
function renderAuditDelta(entry: TimelineEntry): React.ReactNode {
  const relevant = (entry.newValue ?? entry.metadata) as Record<string, unknown> | null;
  if (!relevant || typeof relevant !== 'object') return null;

  const pairs = Object.entries(relevant)
    .filter(([, value]) => value !== null && value !== undefined && typeof value !== 'object')
    .slice(0, 4);

  if (pairs.length === 0) return null;

  return (
    <dl className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
      {pairs.map(([key, value]) => (
        <div key={key} className="flex items-baseline gap-1">
          <dt className="text-2xs text-muted-foreground">{humanizeKey(key)}:</dt>
          <dd className="text-2xs font-medium">{String(value)}</dd>
        </div>
      ))}
    </dl>
  );
}

function humanizeKey(key: string): string {
  const map: Record<string, string> = {
    status: 'estado',
    transition: 'transición',
    label: 'acción',
    note: 'nota',
    versionNumber: 'versión',
    consultantCode: 'consultor',
    consultantName: 'consultor',
    template: 'plantilla',
    outcome: 'resultado',
    code: 'código',
    name: 'nombre',
    reason: 'motivo',
  };
  return map[key] ?? key.replace(/([A-Z])/g, ' $1').toLowerCase();
}

// ============================================================================
//  Postulaciones
// ============================================================================

interface ApplicationView {
  id: string;
  status: string;
  interestStatement: string;
  availability: string;
  relevantExperience: string;
  fitJustification: string;
  preliminaryApproach: string;
  createdAt: string;
  consultant: {
    id: string;
    code: string;
    fullName: string;
    email: string | null;
    tier: string | null;
    experienceLevelCode: string | null;
    maxComplexityCode: string | null;
    yearsOfExperience: number;
    specialties: { specialtyCode: string; isPrimary: boolean }[];
    assignedCases: number;
    evaluatedCases: number;
  };
  evaluation: {
    specialtyFit: number;
    experienceFit: number;
    levelFit: number;
    availabilityFit: number;
    trackRecordFit: number;
    totalScore: number;
    notes: string;
    createdAt: string;
    evaluatedBy: { fullName: string } | null;
  } | null;
}

function ApplicationsTab({ caseId, role }: { caseId: string; role: Role }) {
  const label = useLookupLabel();
  const { data, isLoading } = useQuery({
    queryKey: ['case', caseId, 'applications'],
    queryFn: () => api.get<ApplicationView[]>(`/cases/${caseId}/applications`),
  });

  if (isLoading) return <Skeleton className="h-64" />;

  if (!data || data.length === 0) {
    return (
      <Card>
        <CardContent>
          <EmptyState
            icon={<Users className="size-8" />}
            title="Sin postulaciones"
            description={
              role === 'CONSULTOR'
                ? 'Aún no ha presentado una postulación para este caso.'
                : 'Cuando el caso se publique en la bolsa interna, las postulaciones aparecerán aquí.'
            }
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {data.map((application) => (
        <Card key={application.id}>
          <CardHeader className="flex-row items-start justify-between gap-3">
            <div className="min-w-0">
              <CardTitle>{application.consultant.fullName}</CardTitle>
              <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-2xs text-muted-foreground">
                <span className="font-mono">{application.consultant.code}</span>
                {application.consultant.tier && (
                  <>
                    <span>·</span>
                    <span>{application.consultant.tier.toLowerCase()}</span>
                  </>
                )}
                <span>·</span>
                <span>{application.consultant.yearsOfExperience} años de experiencia</span>
                <span>·</span>
                <span>
                  {application.consultant.assignedCases} caso
                  {application.consultant.assignedCases === 1 ? '' : 's'} atendido
                  {application.consultant.assignedCases === 1 ? '' : 's'}
                </span>
              </p>
            </div>
            <div className="shrink-0 text-right">
              <Badge
                tone={
                  application.status === 'ACEPTADA'
                    ? 'emerald'
                    : application.status === 'NO_SELECCIONADA'
                      ? 'slate'
                      : application.status === 'RETIRADA'
                        ? 'rose'
                        : 'blue'
                }
              >
                {application.status.replace(/_/g, ' ').toLowerCase()}
              </Badge>
              {application.evaluation && (
                <p className="mt-1 font-mono text-xs font-semibold">
                  {application.evaluation.totalScore}/25
                </p>
              )}
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-1.5">
              {application.consultant.specialties.map((specialty) => (
                <Badge key={specialty.specialtyCode} tone={specialty.isPrimary ? 'indigo' : 'outline'}>
                  {label('ESPECIALIDAD', specialty.specialtyCode)}
                </Badge>
              ))}
            </div>

            <dl className="grid gap-4 md:grid-cols-2">
              <DefItem label="Interés y pertinencia">
                <p className="text-sm leading-relaxed">{application.fitJustification}</p>
              </DefItem>
              <DefItem label="Enfoque preliminar">
                <p className="text-sm leading-relaxed">{application.preliminaryApproach}</p>
              </DefItem>
              <DefItem label="Experiencia relevante">
                <p className="text-sm leading-relaxed">{application.relevantExperience}</p>
              </DefItem>
              <DefItem label="Disponibilidad declarada">
                <p className="text-sm">{application.availability}</p>
              </DefItem>
            </dl>

            {application.evaluation && (
              <div className="rounded-lg border border-border bg-secondary/40 p-3">
                <p className="label-caps mb-2">Evaluación T3D</p>
                <div className="mb-2 grid grid-cols-2 gap-2 sm:grid-cols-5">
                  {(
                    [
                      ['specialtyFit', 'Especialidad'],
                      ['experienceFit', 'Experiencia'],
                      ['levelFit', 'Nivel'],
                      ['availabilityFit', 'Disponibilidad'],
                      ['trackRecordFit', 'Historial'],
                    ] as const
                  ).map(([key, text]) => (
                    <div key={key}>
                      <span className="block text-2xs text-muted-foreground">{text}</span>
                      <span className="font-mono text-sm font-semibold">
                        {application.evaluation![key]}/5
                      </span>
                    </div>
                  ))}
                </div>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {application.evaluation.notes}
                </p>
                <p className="mt-1.5 text-2xs text-muted-foreground">
                  {application.evaluation.evaluatedBy?.fullName ?? 'Advisory'} ·{' '}
                  {formatDate(application.evaluation.createdAt)}
                </p>
              </div>
            )}

            <p className="text-2xs text-muted-foreground">
              Postulada {formatRelative(application.createdAt)}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ============================================================================
//  Propuesta
// ============================================================================

interface ProposalView {
  id: string;
  currentVersionNumber: number;
  versions: Array<{
    id: string;
    versionNumber: number;
    status: string;
    analysis: Record<string, string> | null;
    content: Record<string, string> | null;
    changeNote: string | null;
    frozenAt: string | null;
    sentAt: string | null;
    acceptedAt: string | null;
    createdAt: string;
    createdBy: { fullName: string } | null;
    isEditable: boolean;
  }>;
  reviews: Array<{
    id: string;
    versionNumber: number;
    type: string;
    outcome: string;
    checklist: Record<string, boolean>;
    observations: string | null;
    createdAt: string;
    reviewer: { fullName: string; role: string } | null;
  }>;
  adjustments: Array<{
    id: string;
    versionNumber: number;
    details: string;
    response: string | null;
    respondedAt: string | null;
    createdAt: string;
    requestedBy: { fullName: string } | null;
  }>;
}

const CONTENT_BLOCKS: Array<[string, string]> = [
  ['executiveSummary', 'A · Resumen ejecutivo'],
  ['objective', 'B · Objetivo de la intervención'],
  ['scope', 'C · Alcance'],
  ['exclusions', 'D · Exclusiones'],
  ['activities', 'E · Actividades'],
  ['deliverables', 'F · Entregables esperados'],
  ['schedule', 'G · Cronograma preliminar'],
  ['valuation', 'H · Valoración inicial'],
  ['conditions', 'I · Condiciones y supuestos'],
];

function ProposalTab({ caseId }: { caseId: string }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['case', caseId, 'proposal'],
    queryFn: () => api.get<ProposalView>(`/cases/${caseId}/proposal`),
    retry: false,
  });

  const [selected, setSelected] = React.useState<number | null>(null);

  if (isLoading) return <Skeleton className="h-64" />;

  if (error || !data) {
    return (
      <Card>
        <CardContent>
          <EmptyState
            icon={<FileStack className="size-8" />}
            title="Todavía no hay propuesta"
            description="El expediente se abre cuando el consultor responsable inicia el diseño."
          />
        </CardContent>
      </Card>
    );
  }

  const version =
    data.versions.find((item) => item.versionNumber === selected) ?? data.versions[0];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Versiones de la propuesta</CardTitle>
          <p className="text-xs text-muted-foreground">
            Ninguna versión se sobrescribe: cada ajuste genera una nueva y conserva la anterior
          </p>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TR className="hover:bg-transparent">
                <TH>Versión</TH>
                <TH>Estado</TH>
                <TH>Autor</TH>
                <TH>Nota de cambio</TH>
                <TH className="text-right">Creada</TH>
              </TR>
            </THead>
            <TBody>
              {data.versions.map((item) => (
                <TR
                  key={item.id}
                  className={cn(
                    'cursor-pointer',
                    version?.versionNumber === item.versionNumber && 'bg-accent/40',
                  )}
                  onClick={() => setSelected(item.versionNumber)}
                >
                  <TD className="font-mono text-sm font-semibold">v{item.versionNumber}</TD>
                  <TD>
                    <Badge tone={proposalTone(item.status)}>
                      {item.status.replace(/_/g, ' ').toLowerCase()}
                    </Badge>
                    {item.frozenAt && (
                      <span className="ml-1.5 text-2xs text-muted-foreground">congelada</span>
                    )}
                  </TD>
                  <TD className="text-xs">{item.createdBy?.fullName ?? '—'}</TD>
                  <TD className="max-w-[260px]">
                    <span className="block truncate text-xs text-muted-foreground">
                      {item.changeNote ?? '—'}
                    </span>
                  </TD>
                  <TD className="whitespace-nowrap text-right text-2xs text-muted-foreground">
                    {formatDate(item.createdAt)}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </CardContent>
      </Card>

      {version && (
        <Card>
          <CardHeader>
            <CardTitle>Contenido de la versión {version.versionNumber} (TP4C)</CardTitle>
            <p className="text-xs text-muted-foreground">
              {version.frozenAt
                ? `Congelada el ${formatDate(version.frozenAt)} — sólo lectura`
                : 'Borrador editable por el consultor responsable'}
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {version.analysis?.problemSynthesis && (
              <div className="rounded-lg border border-border bg-secondary/40 p-3">
                <p className="label-caps mb-1.5">Análisis estructurado (TP4B)</p>
                <p className="text-sm leading-relaxed">{version.analysis.problemSynthesis}</p>
                {version.analysis.risks && (
                  <>
                    <p className="label-caps mb-1 mt-3">Riesgos identificados</p>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      {version.analysis.risks}
                    </p>
                  </>
                )}
              </div>
            )}

            {version.content ? (
              <dl className="space-y-4">
                {CONTENT_BLOCKS.map(([key, blockLabel]) =>
                  version.content?.[key] ? (
                    <div key={key}>
                      <dt className="label-caps mb-1">{blockLabel}</dt>
                      <dd className="whitespace-pre-line text-sm leading-relaxed">
                        {version.content[key]}
                      </dd>
                    </div>
                  ) : null,
                )}
              </dl>
            ) : (
              <EmptyState title="Esta versión aún no tiene contenido" />
            )}
          </CardContent>
        </Card>
      )}

      {data.reviews.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Revisiones de QA</CardTitle>
            <p className="text-xs text-muted-foreground">
              Metodológica (TP4H) y revisión experta independiente
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.reviews.map((review) => (
              <div key={review.id} className="rounded-lg border border-border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Badge tone={review.type === 'METODOLOGICA' ? 'indigo' : 'violet'}>
                      {review.type === 'METODOLOGICA' ? 'Metodológica' : 'Peer review'}
                    </Badge>
                    <Badge
                      tone={
                        review.outcome === 'APROBADA'
                          ? 'emerald'
                          : review.outcome === 'AJUSTES_SOLICITADOS'
                            ? 'orange'
                            : 'amber'
                      }
                    >
                      {review.outcome.replace(/_/g, ' ').toLowerCase()}
                    </Badge>
                    <span className="font-mono text-2xs text-muted-foreground">
                      v{review.versionNumber}
                    </span>
                  </div>
                  <span className="text-2xs text-muted-foreground">
                    {review.reviewer?.fullName ?? '—'} · {formatDate(review.createdAt)}
                  </span>
                </div>

                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                  {Object.entries(review.checklist).map(([key, value]) => (
                    <span key={key} className="inline-flex items-center gap-1 text-2xs">
                      {value ? (
                        <CheckCircle2 className="size-3 text-success" aria-hidden />
                      ) : (
                        <CircleDashed className="size-3 text-muted-foreground" aria-hidden />
                      )}
                      <span className={value ? '' : 'text-muted-foreground'}>
                        {checklistLabel(key)}
                      </span>
                    </span>
                  ))}
                </div>

                {review.observations && (
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {review.observations}
                  </p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {data.adjustments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Solicitudes de ajuste del cliente</CardTitle>
            <p className="text-xs text-muted-foreground">TP6B · respuesta del consultor TP6C</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.adjustments.map((adjustment) => (
              <div key={adjustment.id} className="rounded-lg border border-border p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-2xs text-muted-foreground">
                    sobre v{adjustment.versionNumber}
                  </span>
                  <span className="text-2xs text-muted-foreground">
                    {adjustment.requestedBy?.fullName ?? 'Cliente'} ·{' '}
                    {formatDate(adjustment.createdAt)}
                  </span>
                </div>
                <p className="mt-1.5 text-sm leading-relaxed">{adjustment.details}</p>
                {adjustment.response && (
                  <div className="mt-2 border-t border-border pt-2">
                    <p className="label-caps mb-1">Respuesta del consultor</p>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      {adjustment.response}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function proposalTone(status: string): 'slate' | 'amber' | 'blue' | 'emerald' | 'rose' {
  switch (status) {
    case 'BORRADOR':
      return 'slate';
    case 'EN_QA':
      return 'amber';
    case 'ENVIADA':
      return 'blue';
    case 'ACEPTADA':
      return 'emerald';
    default:
      return 'slate';
  }
}

function checklistLabel(key: string): string {
  const map: Record<string, string> = {
    completeness: 'Completitud',
    templateUsage: 'Uso de plantillas',
    traceability: 'Trazabilidad',
    problemScopeCoherence: 'Coherencia problema-alcance',
    clientReadability: 'Comprensible para el cliente',
    scheduleAndValuation: 'Cronograma y valoración',
    exclusionsAndAssumptions: 'Exclusiones y supuestos',
  };
  return map[key] ?? key;
}

// ============================================================================
//  Contratación
// ============================================================================

interface ChecklistView {
  templateCode: string;
  completedAt: string | null;
  items: Array<{
    id: string;
    label: string;
    description: string | null;
    responsible: string | null;
    isRequired: boolean;
    requiresEvidence: boolean;
    status: string;
    completedDate: string | null;
    notes: string | null;
    evidences: Array<{ id: string; title: string; createdAt: string }>;
  }>;
  progress: { requiredTotal: number; requiredSettled: number; percent: number; isComplete: boolean; pending: string[] };
}

interface FrameworkView {
  operatingConditions: string;
  estimatedDurationDays: number;
  baselineSchedule: string;
  committedDeliverables: string;
  clientDependencies: string;
  assumptions: string;
  executionConstraints: string | null;
  primaryContact: string;
  uploadedBy: { fullName: string } | null;
  createdAt: string;
}

function ContractTab({ caseId }: { caseId: string }) {
  const checklist = useQuery({
    queryKey: ['case', caseId, 'contract-checklist'],
    queryFn: () => api.get<ChecklistView>(`/cases/${caseId}/contract/checklist`),
    retry: false,
  });

  const framework = useQuery({
    queryKey: ['case', caseId, 'operational-framework'],
    queryFn: () => api.get<FrameworkView>(`/cases/${caseId}/contract/operational-framework`),
    retry: false,
  });

  if (checklist.isLoading) return <Skeleton className="h-64" />;

  if (checklist.error || !checklist.data) {
    return (
      <Card>
        <CardContent>
          <EmptyState
            icon={<ClipboardCheck className="size-8" />}
            title="La contratación aún no ha comenzado"
            description="El checklist T7A se instancia automáticamente cuando el cliente acepta la propuesta."
          />
        </CardContent>
      </Card>
    );
  }

  const data = checklist.data;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Checklist de contratación (T7A)</CardTitle>
          <p className="text-xs leading-relaxed text-muted-foreground">
            NODUS no es parte contractual: verifica el cumplimiento del proceso, no el contenido
            legal de los documentos. Sin este checklist completo, la ejecución no se autoriza.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-secondary">
              <div
                className={cn(
                  'h-full rounded-full transition-all',
                  data.progress.isComplete ? 'bg-success' : 'bg-warning',
                )}
                style={{ width: `${data.progress.percent}%` }}
              />
            </div>
            <span className="shrink-0 font-mono text-xs font-semibold">
              {data.progress.requiredSettled}/{data.progress.requiredTotal}
            </span>
          </div>

          <ul className="divide-y divide-border">
            {data.items.map((item) => (
              <li key={item.id} className="flex items-start gap-3 py-3">
                <span className="mt-0.5 shrink-0">
                  {item.status === 'CUMPLIDO' ? (
                    <CheckCircle2 className="size-4 text-success" aria-hidden />
                  ) : item.status === 'NO_APLICA' ? (
                    <CircleDashed className="size-4 text-muted-foreground" aria-hidden />
                  ) : (
                    <CircleDashed className="size-4 text-warning" aria-hidden />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">
                    {item.label}
                    {!item.isRequired && (
                      <span className="ml-1.5 text-2xs font-normal text-muted-foreground">
                        (opcional)
                      </span>
                    )}
                  </p>
                  {item.description && (
                    <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                      {item.description}
                    </p>
                  )}
                  {item.notes && (
                    <p className="mt-1 text-xs italic text-muted-foreground">{item.notes}</p>
                  )}
                  {item.evidences.length > 0 && (
                    <p className="mt-1 text-2xs text-muted-foreground">
                      {item.evidences.length} evidencia{item.evidences.length === 1 ? '' : 's'}{' '}
                      registrada{item.evidences.length === 1 ? '' : 's'}
                    </p>
                  )}
                </div>
                <div className="shrink-0 text-right">
                  <Badge
                    tone={
                      item.status === 'CUMPLIDO'
                        ? 'emerald'
                        : item.status === 'NO_APLICA'
                          ? 'slate'
                          : item.status === 'EN_PROCESO'
                            ? 'blue'
                            : 'amber'
                    }
                  >
                    {item.status.replace(/_/g, ' ').toLowerCase()}
                  </Badge>
                  {item.responsible && (
                    <p className="mt-1 text-2xs text-muted-foreground">{item.responsible}</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {framework.data && (
        <Card>
          <CardHeader>
            <CardTitle>Marco operativo del servicio (T7B)</CardTitle>
            <p className="text-xs text-muted-foreground">
              Cargado por {framework.data.uploadedBy?.fullName ?? 'el consultor'} ·{' '}
              {formatDate(framework.data.createdAt)} · base del seguimiento de la ejecución
            </p>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-4 md:grid-cols-2">
              <DefItem label="Duración estimada">
                {framework.data.estimatedDurationDays} días
              </DefItem>
              <DefItem label="Contacto principal">{framework.data.primaryContact}</DefItem>
              <DefItem label="Condiciones operativas" className="md:col-span-2">
                <p className="text-sm leading-relaxed">{framework.data.operatingConditions}</p>
              </DefItem>
              <DefItem label="Cronograma base" className="md:col-span-2">
                <p className="text-sm leading-relaxed">{framework.data.baselineSchedule}</p>
              </DefItem>
              <DefItem label="Entregables comprometidos" className="md:col-span-2">
                <p className="text-sm leading-relaxed">{framework.data.committedDeliverables}</p>
              </DefItem>
              <DefItem label="Dependencias del cliente">
                <p className="text-sm leading-relaxed">{framework.data.clientDependencies}</p>
              </DefItem>
              <DefItem label="Supuestos">
                <p className="text-sm leading-relaxed">{framework.data.assumptions}</p>
              </DefItem>
            </dl>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ============================================================================
//  Ejecución
// ============================================================================

interface ExecutionSummary {
  agendaActivated: boolean;
  activities: Record<string, number>;
  milestones: Record<string, number>;
  milestonesOverdue: number;
  incidents: Record<string, number>;
  deliverables: Record<string, number>;
  readyForTechnicalClosure: boolean;
  closureBlockers: string[];
}

function ExecutionTab({ caseId }: { caseId: string }) {
  const summary = useQuery({
    queryKey: ['case', caseId, 'execution-summary'],
    queryFn: () => api.get<ExecutionSummary>(`/cases/${caseId}/execution-summary`),
  });

  const activities = useQuery({
    queryKey: ['case', caseId, 'activities'],
    queryFn: () => api.get<ActivityRow[]>(`/cases/${caseId}/activities`),
  });

  const milestones = useQuery({
    queryKey: ['case', caseId, 'milestones'],
    queryFn: () => api.get<MilestoneRow[]>(`/cases/${caseId}/milestones`),
  });

  const incidents = useQuery({
    queryKey: ['case', caseId, 'incidents'],
    queryFn: () => api.get<IncidentRow[]>(`/cases/${caseId}/incidents`),
  });

  const deliverables = useQuery({
    queryKey: ['case', caseId, 'deliverables'],
    queryFn: () => api.get<DeliverableRow[]>(`/cases/${caseId}/deliverables`),
  });

  if (summary.isLoading) return <Skeleton className="h-64" />;

  const hasAnything =
    (activities.data?.length ?? 0) +
      (milestones.data?.length ?? 0) +
      (deliverables.data?.length ?? 0) >
    0;

  if (!hasAnything) {
    return (
      <Card>
        <CardContent>
          <EmptyState
            icon={<ActivityIcon className="size-8" />}
            title="La agenda operativa aún no está activa"
            description="Se habilita cuando el caso queda autorizado para ejecución (T8A)."
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {summary.data && summary.data.closureBlockers.length > 0 && (
        <Card>
          <CardContent className="space-y-1.5">
            <p className="label-caps">Bloqueos para el cierre técnico</p>
            <ul className="space-y-1">
              {summary.data.closureBlockers.map((blocker) => (
                <li key={blocker} className="flex items-start gap-2 text-sm">
                  <CircleDashed className="mt-0.5 size-3.5 shrink-0 text-warning" aria-hidden />
                  {blocker}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {(milestones.data?.length ?? 0) > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Flag className="size-4 text-muted-foreground" aria-hidden /> Hitos (T8C)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <THead>
                <TR className="hover:bg-transparent">
                  <TH>Hito</TH>
                  <TH>Responsable</TH>
                  <TH>Criticidad</TH>
                  <TH>Estado</TH>
                  <TH className="text-right">Fecha objetivo</TH>
                </TR>
              </THead>
              <TBody>
                {milestones.data!.map((milestone) => (
                  <TR key={milestone.id}>
                    <TD className="max-w-[280px]">
                      <span className="block truncate text-sm font-medium">{milestone.name}</span>
                    </TD>
                    <TD className="text-xs">{milestone.responsible}</TD>
                    <TD>
                      <Badge tone={milestone.criticality === 'CRITICO' ? 'rose' : milestone.criticality === 'ALTO' ? 'orange' : 'slate'}>
                        {milestone.criticality.toLowerCase()}
                      </Badge>
                    </TD>
                    <TD>
                      <Badge tone={milestoneTone(milestone.status)}>
                        {milestone.status.replace(/_/g, ' ').toLowerCase()}
                      </Badge>
                    </TD>
                    <TD
                      className={cn(
                        'whitespace-nowrap text-right text-xs',
                        milestone.isOverdue ? 'font-medium text-destructive' : 'text-muted-foreground',
                      )}
                    >
                      {formatDate(milestone.targetDate)}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {(deliverables.data?.length ?? 0) > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="size-4 text-muted-foreground" aria-hidden /> Entregables (T8G)
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Versionamiento obligatorio: cada carga conserva las versiones anteriores
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            {deliverables.data!.map((deliverable) => (
              <div key={deliverable.id} className="rounded-lg border border-border p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{deliverable.name}</p>
                    <p className="mt-0.5 text-2xs text-muted-foreground">
                      {deliverable.responsible} · objetivo {formatDate(deliverable.targetDate)}
                    </p>
                  </div>
                  <Badge tone={deliverableTone(deliverable.status)}>
                    {deliverable.status.replace(/_/g, ' ').toLowerCase()}
                  </Badge>
                </div>

                {deliverable.versions.length > 0 && (
                  <ul className="mt-2 space-y-1 border-t border-border pt-2">
                    {deliverable.versions.map((version) => (
                      <li
                        key={version.id}
                        className="flex items-center justify-between gap-2 text-2xs"
                      >
                        <span className="font-mono font-semibold">v{version.versionNumber}</span>
                        <span className="min-w-0 flex-1 truncate text-muted-foreground">
                          {version.notes ?? version.documentVersion?.fileName ?? '—'}
                        </span>
                        <span className="shrink-0 text-muted-foreground">
                          {formatDate(version.createdAt)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {(activities.data?.length ?? 0) > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ActivityIcon className="size-4 text-muted-foreground" aria-hidden /> Actividades (T8B)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <THead>
                <TR className="hover:bg-transparent">
                  <TH>Actividad</TH>
                  <TH>Responsable</TH>
                  <TH>Estado</TH>
                  <TH className="text-right">Fecha objetivo</TH>
                </TR>
              </THead>
              <TBody>
                {activities.data!.map((activity) => (
                  <TR key={activity.id}>
                    <TD className="max-w-[320px]">
                      <span className="block truncate text-sm">{activity.name}</span>
                    </TD>
                    <TD className="text-xs">{activity.responsible}</TD>
                    <TD>
                      <Badge tone={activityTone(activity.status)}>
                        {activity.status.replace(/_/g, ' ').toLowerCase()}
                      </Badge>
                    </TD>
                    <TD className="whitespace-nowrap text-right text-xs text-muted-foreground">
                      {formatDate(activity.targetDate)}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {(incidents.data?.length ?? 0) > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Incidencias (T8D)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {incidents.data!.map((incident) => (
              <div key={incident.id} className="rounded-lg border border-border p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="text-sm font-medium">{incident.title}</p>
                  <div className="flex shrink-0 gap-1.5">
                    <Badge tone={incident.impact === 'CRITICO' || incident.impact === 'ALTO' ? 'rose' : 'amber'}>
                      {incident.impact.toLowerCase()}
                    </Badge>
                    <Badge tone={incident.status === 'CERRADA' || incident.status === 'RESUELTA' ? 'emerald' : 'orange'}>
                      {incident.status.replace(/_/g, ' ').toLowerCase()}
                    </Badge>
                  </div>
                </div>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  {incident.description}
                </p>
                <p className="mt-1.5 text-2xs text-muted-foreground">
                  Acción sugerida: {incident.suggestedAction}
                </p>
                {incident.decision && (
                  <p className="mt-1 text-2xs font-medium">Decisión: {incident.decision}</p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

interface ActivityRow {
  id: string;
  name: string;
  responsible: string;
  targetDate: string;
  status: string;
}
interface MilestoneRow {
  id: string;
  name: string;
  responsible: string;
  targetDate: string;
  criticality: string;
  status: string;
  isOverdue: boolean;
}
interface IncidentRow {
  id: string;
  title: string;
  description: string;
  impact: string;
  status: string;
  suggestedAction: string;
  decision: string | null;
}
interface DeliverableRow {
  id: string;
  name: string;
  responsible: string;
  targetDate: string;
  status: string;
  versions: Array<{
    id: string;
    versionNumber: number;
    notes: string | null;
    createdAt: string;
    documentVersion: { fileName: string } | null;
  }>;
}

function activityTone(status: string) {
  return status === 'COMPLETADA'
    ? ('emerald' as const)
    : status === 'EN_CURSO'
      ? ('blue' as const)
      : status === 'BLOQUEADA'
        ? ('rose' as const)
        : ('slate' as const);
}

function milestoneTone(status: string) {
  return status === 'CUMPLIDO'
    ? ('emerald' as const)
    : status === 'JUSTIFICADO'
      ? ('slate' as const)
      : status === 'INCUMPLIDO'
        ? ('rose' as const)
        : status === 'EN_CURSO'
          ? ('blue' as const)
          : ('amber' as const);
}

function deliverableTone(status: string) {
  return status === 'LISTO_PARA_CIERRE'
    ? ('emerald' as const)
    : status === 'CARGADO' || status === 'EN_REVISION'
      ? ('blue' as const)
      : status === 'EN_DESARROLLO'
        ? ('amber' as const)
        : ('slate' as const);
}

// ============================================================================
//  Documentos
// ============================================================================

interface DocumentRow {
  id: string;
  stage: string;
  type: string;
  name: string;
  currentVersion: number;
  createdAt: string;
  versions: Array<{
    id: string;
    versionNumber: number;
    fileName: string;
    mimeType: string;
    sizeBytes: number;
    createdAt: string;
    uploadedBy: { fullName: string } | null;
  }>;
}

function DocumentsTab({ caseId }: { caseId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['case', caseId, 'documents'],
    queryFn: () => api.get<DocumentRow[]>(`/cases/${caseId}/documents`),
  });

  if (isLoading) return <Skeleton className="h-48" />;

  const withFiles = (data ?? []).filter((doc) => doc.versions.length > 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Repositorio documental</CardTitle>
        <p className="text-xs text-muted-foreground">
          Estructura Empresa → Caso → Etapa → Versión · ninguna versión se sobrescribe
        </p>
      </CardHeader>
      <CardContent className={withFiles.length > 0 ? 'p-0' : undefined}>
        {withFiles.length > 0 ? (
          <Table>
            <THead>
              <TR className="hover:bg-transparent">
                <TH>Documento</TH>
                <TH>Etapa</TH>
                <TH>Versión</TH>
                <TH>Cargado por</TH>
                <TH className="text-right">Fecha</TH>
              </TR>
            </THead>
            <TBody>
              {withFiles.flatMap((doc) =>
                doc.versions.map((version) => (
                  <TR key={version.id}>
                    <TD>
                      <span className="block max-w-[280px] truncate text-sm">
                        {version.fileName}
                      </span>
                      <span className="text-2xs text-muted-foreground">{doc.type}</span>
                    </TD>
                    <TD>
                      <Badge tone="outline">{doc.stage.toLowerCase()}</Badge>
                    </TD>
                    <TD className="font-mono text-xs">v{version.versionNumber}</TD>
                    <TD className="text-xs">{version.uploadedBy?.fullName ?? '—'}</TD>
                    <TD className="whitespace-nowrap text-right text-2xs text-muted-foreground">
                      {formatDate(version.createdAt)}
                    </TD>
                  </TR>
                )),
              )}
            </TBody>
          </Table>
        ) : (
          <EmptyState
            icon={<Package className="size-8" />}
            title="Sin documentos cargados"
            description="La estructura documental del caso está creada y lista para recibir archivos."
          />
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================================
//  Comunicaciones
// ============================================================================

interface CommunicationRow {
  id: string;
  type: string;
  stage: string;
  audience: string;
  subject: string;
  body: string;
  answeredAt: string | null;
  createdAt: string;
  createdBy: { fullName: string; role: string } | null;
}

interface MeetingRow {
  id: string;
  title: string;
  type: string;
  heldAt: string;
  durationMinutes: number;
  participants: string;
  topics: string;
  conclusions: string;
}

function CommunicationsTab({ caseId }: { caseId: string }) {
  const communications = useQuery({
    queryKey: ['case', caseId, 'communications'],
    queryFn: () => api.get<CommunicationRow[]>(`/cases/${caseId}/communications`),
  });

  const meetings = useQuery({
    queryKey: ['case', caseId, 'meetings'],
    queryFn: () => api.get<MeetingRow[]>(`/cases/${caseId}/meetings`),
  });

  if (communications.isLoading) return <Skeleton className="h-48" />;

  const hasData =
    (communications.data?.length ?? 0) > 0 || (meetings.data?.length ?? 0) > 0;

  if (!hasData) {
    return (
      <Card>
        <CardContent>
          <EmptyState
            icon={<MessageSquare className="size-8" />}
            title="Sin comunicaciones registradas"
            description="Toda interacción relevante del caso se registra aquí: no hay canal directo fuera de la plataforma."
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {(communications.data?.length ?? 0) > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Comunicaciones estructuradas</CardTitle>
            <p className="text-xs text-muted-foreground">
              Interacción controlada por la plataforma (T3A / T3B / TP4A / T8F)
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            {communications.data!.map((item) => (
              <div key={item.id} className="rounded-lg border border-border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge tone="indigo">{item.type.replace(/_/g, ' ').toLowerCase()}</Badge>
                    <Badge tone="outline">{item.audience.toLowerCase()}</Badge>
                    {item.answeredAt && <Badge tone="emerald">respondida</Badge>}
                  </div>
                  <span className="text-2xs text-muted-foreground">
                    {item.createdBy?.fullName ?? 'Sistema'} · {formatDate(item.createdAt)}
                  </span>
                </div>
                <p className="mt-1.5 text-sm font-medium">{item.subject}</p>
                <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                  {item.body}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {(meetings.data?.length ?? 0) > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Reuniones registradas</CardTitle>
            <p className="text-xs text-muted-foreground">T8E · reunión de cierre T9E</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {meetings.data!.map((meeting) => (
              <div key={meeting.id} className="rounded-lg border border-border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium">{meeting.title}</p>
                  <span className="text-2xs text-muted-foreground">
                    {formatDateTime(meeting.heldAt)} · {meeting.durationMinutes} min
                  </span>
                </div>
                <p className="mt-1 text-2xs text-muted-foreground">
                  Participantes: {meeting.participants}
                </p>
                <p className="mt-1.5 text-sm leading-relaxed">{meeting.conclusions}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
