'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Role } from '@nodus/types';
import { CheckCircle2, CircleDashed, FileText, Lock, TriangleAlert } from 'lucide-react';
import { api } from '@/lib/api';
import { cn, formatDate, formatDateTime, formatRelative, humanizeCode } from '@/lib/utils';
import {
  Badge,
  DefItem,
  EmptyState,
  ErrorState,
  Panel,
  Section,
  Skeleton,
  TBody,
  TD,
  TH,
  THead,
  TR,
  Table,
  TableSkeleton,
} from '@/components/ui/primitives';
import { Tabs, type TabItem } from '@/components/ui/tabs';
import { SegmentedControl } from '@/components/ui/segmented';
import { PersonCell, SystemAvatar, UserAvatar } from '@/components/ui/avatar';
import { Tooltip } from '@/components/ui/tooltip';
import { useLookupLabel } from '@/features/lookups/use-lookups';
import type { CaseDetail, StatusHistoryEntry, TimelineEntry } from '../types';
import { WorkflowStepper } from '../workflow-stepper';
import { CaseTimeline } from './case-timeline';

export type CaseTabId =
  | 'overview'
  | 'workflow'
  | 'applications'
  | 'proposal'
  | 'contract'
  | 'execution'
  | 'documents'
  | 'communications'
  | 'audit';

/**
 * Pestañas del Case Workspace y la columna lateral.
 *
 * Nueve pestañas, en el orden en que avanza un caso. La Auditoría es una
 * pestaña propia —trazabilidad formal e inmodificable—, no una vista de
 * actividad: la actividad reciente vive en el Resumen.
 */
export function CaseTabs({
  kase,
  role,
  history,
  tab,
  onTabChange,
  aside,
}: {
  kase: CaseDetail;
  role: Role;
  history: StatusHistoryEntry[] | undefined;
  tab: CaseTabId;
  onTabChange: (tab: CaseTabId) => void;
  /** Columna lateral (siguiente paso, contacto): comparte fila con el panel activo. */
  aside: React.ReactNode;
}) {
  const tabs: TabItem<CaseTabId>[] = [
    { id: 'overview', label: 'Resumen' },
    { id: 'workflow', label: 'Workflow', count: history?.length },
    { id: 'applications', label: 'Postulaciones', count: kase.counts.applications },
    { id: 'proposal', label: 'Propuesta', count: kase.counts.proposalVersions },
    { id: 'contract', label: 'Contratación' },
    {
      id: 'execution',
      label: 'Ejecución',
      count:
        kase.counts.activities +
        kase.counts.milestones +
        kase.counts.deliverables +
        kase.counts.incidents,
    },
    { id: 'documents', label: 'Documentos', count: kase.counts.documents },
    {
      id: 'communications',
      label: 'Comunicaciones',
      count: kase.counts.communications + kase.counts.meetings,
    },
    { id: 'audit', label: 'Auditoría' },
  ];

  return (
    <div className="space-y-6">
      <Tabs items={tabs} value={tab} onValueChange={onTabChange} layoutId="case-tabs" />

      <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_300px] xl:grid-cols-[minmax(0,1fr)_320px]">
        <div role="tabpanel" className="min-w-0">
          {tab === 'overview' && <OverviewTab kase={kase} onTabChange={onTabChange} />}
          {tab === 'workflow' && <WorkflowTab kase={kase} history={history} />}
          {tab === 'applications' && <ApplicationsTab caseId={kase.id} role={role} />}
          {tab === 'proposal' && <ProposalTab caseId={kase.id} />}
          {tab === 'contract' && <ContractTab caseId={kase.id} />}
          {tab === 'execution' && <ExecutionTab caseId={kase.id} />}
          {tab === 'documents' && <DocumentsTab caseId={kase.id} />}
          {tab === 'communications' && <CommunicationsTab caseId={kase.id} />}
          {tab === 'audit' && <AuditTab caseId={kase.id} />}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">{aside}</aside>
      </div>
    </div>
  );
}

/** Estado vacío dentro de un panel: el patrón de todas las pestañas. */
function EmptyPanel(props: React.ComponentProps<typeof EmptyState>) {
  return (
    <Panel>
      <EmptyState {...props} />
    </Panel>
  );
}

function LoadError({ what, onRetry }: { what: string; onRetry: () => void }) {
  return (
    <Panel>
      <ErrorState
        title={`No se pudo cargar ${what}`}
        message="La conexión con el servidor falló o la respuesta no fue válida."
        onRetry={onRetry}
      />
    </Panel>
  );
}

// ============================================================================
//  Resumen
// ============================================================================

function OverviewTab({
  kase,
  onTabChange,
}: {
  kase: CaseDetail;
  onTabChange: (tab: CaseTabId) => void;
}) {
  const label = useLookupLabel();

  return (
    <div className="space-y-8">
      <Section
        title="Necesidad registrada"
        description="Relato original del cliente (T1). No se modifica."
      >
        <p className="max-w-prose whitespace-pre-line text-prose text-ink-2">{kase.description}</p>
      </Section>

      <Section
        title="Clasificación"
        description={
          kase.classification
            ? `T2 · ${kase.classification.classifiedBy?.fullName ?? 'Advisory'} · ${formatDate(kase.classification.createdAt)}${kase.classification.confirmedAt ? ' · confirmada' : ''}`
            : undefined
        }
        actions={
          kase.classification && (
            <Badge
              tone={kase.classification.eligibility === 'ELEGIBLE' ? 'success' : 'neutral'}
              dot
            >
              {humanizeCode(kase.classification.eligibility)}
            </Badge>
          )
        }
      >
        {kase.classification ? (
          <div className="space-y-4">
            <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-3">
              <DefItem label="Área">
                {label('AREA_PROBLEMA', kase.classification.areaCode)}
                {kase.subAreaCode && (
                  <span className="block text-caption text-muted-foreground">
                    {label('SUBAREA', kase.subAreaCode)}
                  </span>
                )}
              </DefItem>
              <DefItem label="Tipo de intervención">
                {label('TIPO_INTERVENCION', kase.classification.interventionTypeCode)}
              </DefItem>
              <DefItem label="Complejidad">
                {label('COMPLEJIDAD', kase.classification.complexityCode)}
              </DefItem>
              <DefItem label="Impacto">{label('IMPACTO', kase.classification.impactCode)}</DefItem>
              <DefItem label="Urgencia">
                {label('URGENCIA', kase.classification.urgencyCode)}
              </DefItem>
              <DefItem label="Avance del ciclo">{kase.progressPercent}%</DefItem>
            </dl>
            <div className="max-w-prose rounded-sm bg-muted px-4 py-3">
              <p className="text-caption text-muted-foreground">Observaciones de la revisión</p>
              <p className="mt-1 whitespace-pre-line text-body-sm leading-relaxed text-ink-2">
                {kase.classification.reviewNotes}
              </p>
            </div>
          </div>
        ) : (
          <p className="text-body-sm text-muted-foreground">
            Aún sin clasificar. Advisory registra la clasificación T2 durante la debida diligencia;
            hasta entonces el caso no puede publicarse en la bolsa.
          </p>
        )}
      </Section>

      {kase.closedAt && (
        <Section title="Cierre">
          <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-[200px_minmax(0,1fr)]">
            <DefItem label="Fecha de cierre">{formatDateTime(kase.closedAt)}</DefItem>
            <DefItem label="Motivo">{kase.closureReason ?? '—'}</DefItem>
          </dl>
        </Section>
      )}

      <RecentActivity caseId={kase.id} onOpenAudit={() => onTabChange('audit')} />
      <RecentDocuments caseId={kase.id} onOpenDocuments={() => onTabChange('documents')} />
    </div>
  );
}

/** Los cinco eventos más recientes de la bitácora, para entender qué pasó sin salir del resumen. */
function RecentActivity({ caseId, onOpenAudit }: { caseId: string; onOpenAudit: () => void }) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['case', caseId, 'timeline'],
    queryFn: () => api.get<TimelineEntry[]>(`/cases/${caseId}/timeline`),
  });

  const recent = (data ?? []).slice(0, 5);

  return (
    <Section
      title="Actividad reciente"
      actions={
        <button type="button" onClick={onOpenAudit} className="link text-body-sm">
          Ver auditoría completa
        </button>
      }
    >
      <Panel>
        {isLoading ? (
          <TableSkeleton rows={4} columns={3} />
        ) : error ? (
          <ErrorState title="No se pudo cargar la actividad" onRetry={() => void refetch()} />
        ) : recent.length === 0 ? (
          <EmptyState title="Sin actividad registrada todavía" />
        ) : (
          <ul className="divide-y divide-border-subtle">
            {recent.map((entry) => (
              <li key={entry.id} className="flex items-center gap-3 px-5 py-2.5">
                {entry.origin === 'SYSTEM' ? (
                  <SystemAvatar size="sm" />
                ) : (
                  <UserAvatar name={entry.actor?.fullName ?? 'Usuario'} size="sm" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-body-sm text-foreground">{entry.actionLabel}</p>
                  <p className="truncate text-caption text-muted-foreground">
                    {entry.origin === 'SYSTEM' ? 'Sistema' : (entry.actor?.fullName ?? 'Usuario')}
                  </p>
                </div>
                <Tooltip content={formatDateTime(entry.createdAt)}>
                  <time
                    dateTime={entry.createdAt}
                    className="shrink-0 text-caption text-muted-foreground"
                  >
                    {formatRelative(entry.createdAt)}
                  </time>
                </Tooltip>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </Section>
  );
}

function RecentDocuments({
  caseId,
  onOpenDocuments,
}: {
  caseId: string;
  onOpenDocuments: () => void;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ['case', caseId, 'documents'],
    queryFn: () => api.get<DocumentRow[]>(`/cases/${caseId}/documents`),
  });

  const docs = (data ?? [])
    .filter((doc) => doc.versions.length > 0)
    .map((doc) => ({ doc, latest: latestVersion(doc) }))
    .sort((a, b) => b.latest.createdAt.localeCompare(a.latest.createdAt))
    .slice(0, 3);

  if (isLoading) return null;

  return (
    <Section
      title="Documentos"
      actions={
        docs.length > 0 && (
          <button type="button" onClick={onOpenDocuments} className="link text-body-sm">
            Ver todos
          </button>
        )
      }
    >
      {docs.length === 0 ? (
        <p className="text-body-sm text-muted-foreground">
          Aún no hay documentos cargados. La estructura documental del caso está creada.
        </p>
      ) : (
        <Panel>
          <ul className="divide-y divide-border-subtle">
            {docs.map(({ doc, latest }) => (
              <li key={doc.id} className="flex items-center gap-3 px-5 py-2.5">
                <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-body-sm text-foreground" title={latest.fileName}>
                    {latest.fileName}
                  </p>
                  <p className="truncate text-caption text-muted-foreground">
                    {humanizeCode(doc.stage)} · v{latest.versionNumber}
                  </p>
                </div>
                <span className="shrink-0 text-caption text-muted-foreground">
                  {formatDate(latest.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </Section>
  );
}

// ============================================================================
//  Workflow
// ============================================================================

function WorkflowTab({
  kase,
  history,
}: {
  kase: CaseDetail;
  history: StatusHistoryEntry[] | undefined;
}) {
  const dates: Array<[string, string | null]> = [
    ['Registro', kase.createdAt],
    ['Publicación en bolsa', kase.publishedAt],
    ['Apertura de decisión del cliente', kase.decisionOpenedAt],
    ['Autorización de ejecución', kase.authorizedAt],
    ['Inicio de ejecución', kase.executionStartedAt],
    ['Cierre', kase.closedAt],
  ];

  return (
    <div className="space-y-8">
      <Section title="Recorrido" description="Etapas del ciclo y estados por los que pasó el caso">
        <Panel className="px-5 py-5">
          <WorkflowStepper status={kase.status} history={history} />
        </Panel>
      </Section>

      <Section title="Fechas del expediente">
        <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2 xl:grid-cols-3">
          {dates.map(([text, value]) => (
            <div key={text} className="flex items-center gap-2.5">
              <span
                className={cn(
                  'size-2 shrink-0 rounded-full',
                  value ? 'bg-foreground' : 'border-[1.5px] border-border-strong',
                )}
                aria-hidden
              />
              <dt
                className={cn(
                  'min-w-0 flex-1 truncate text-body-sm',
                  value ? 'text-ink-2' : 'text-muted-foreground',
                )}
              >
                {text}
              </dt>
              <dd
                className={cn(
                  'tabular shrink-0 text-body-sm',
                  value ? 'text-foreground' : 'text-muted-foreground',
                )}
              >
                {value ? formatDate(value) : 'Pendiente'}
              </dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section
        title="Historial de estados"
        description="Cada transición con su actor, su nota y el tiempo en la etapa anterior"
      >
        {!history ? (
          <Skeleton className="h-48" />
        ) : (
          <Panel className="px-5 py-5">
            <CaseTimeline entries={history} />
          </Panel>
        )}
      </Section>
    </div>
  );
}

// ============================================================================
//  Auditoría (bitácora formal)
// ============================================================================

function AuditTab({ caseId }: { caseId: string }) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['case', caseId, 'timeline'],
    queryFn: () => api.get<TimelineEntry[]>(`/cases/${caseId}/timeline`),
  });

  if (error) return <LoadError what="la bitácora" onRetry={() => void refetch()} />;

  return (
    <Section
      title="Bitácora del caso"
      description="Registro append-only: no puede modificarse ni eliminarse desde la aplicación"
      actions={
        <span className="inline-flex items-center gap-1.5 text-caption text-muted-foreground">
          <Lock className="size-3.5" aria-hidden /> {data?.length ?? 0} eventos
        </span>
      }
    >
      <Panel>
        {isLoading ? (
          <TableSkeleton rows={8} columns={4} />
        ) : data && data.length > 0 ? (
          <Table density="compact">
            <THead>
              <tr>
                <TH>Fecha</TH>
                <TH>Acción</TH>
                <TH>Actor</TH>
                <TH>Detalle</TH>
              </tr>
            </THead>
            <TBody>
              {data.map((entry) => (
                <TR key={entry.id}>
                  <TD className="tabular whitespace-nowrap text-caption text-muted-foreground">
                    {formatDateTime(entry.createdAt)}
                  </TD>
                  <TD className="max-w-72">
                    <span className="block truncate text-body-sm text-foreground">
                      {entry.actionLabel}
                    </span>
                    <span className="block truncate font-mono text-caption text-muted-foreground">
                      {entry.entity}
                    </span>
                  </TD>
                  <TD className="whitespace-nowrap text-body-sm text-ink-2">
                    {entry.origin === 'SYSTEM' ? 'Sistema' : (entry.actor?.fullName ?? '—')}
                  </TD>
                  <TD className="max-w-80">{renderAuditDelta(entry)}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        ) : (
          <EmptyState title="Sin eventos registrados todavía" />
        )}
      </Panel>
    </Section>
  );
}

/** El delta auditado, legible y breve: nunca el JSON completo. */
function renderAuditDelta(entry: TimelineEntry): React.ReactNode {
  const relevant = (entry.newValue ?? entry.metadata) as Record<string, unknown> | null;
  if (!relevant || typeof relevant !== 'object') {
    return <span className="text-caption text-muted-foreground">—</span>;
  }

  const pairs = Object.entries(relevant)
    .filter(([, value]) => value !== null && value !== undefined && typeof value !== 'object')
    .slice(0, 3);

  if (pairs.length === 0) return <span className="text-caption text-muted-foreground">—</span>;

  return (
    <span
      className="block truncate text-caption text-muted-foreground"
      title={pairs.map(([key, value]) => `${humanizeKey(key)}: ${String(value)}`).join(' · ')}
    >
      {pairs.map(([key, value], index) => (
        <React.Fragment key={key}>
          {index > 0 && ' · '}
          {humanizeKey(key)}: <span className="text-ink-2">{String(value)}</span>
        </React.Fragment>
      ))}
    </span>
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
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['case', caseId, 'applications'],
    queryFn: () => api.get<ApplicationView[]>(`/cases/${caseId}/applications`),
  });

  if (isLoading) return <Skeleton className="h-64" />;
  if (error) return <LoadError what="las postulaciones" onRetry={() => void refetch()} />;

  if (!data || data.length === 0) {
    return (
      <EmptyPanel
        title="Sin postulaciones"
        description={
          role === 'CONSULTOR'
            ? 'Aún no ha presentado una postulación para este caso.'
            : 'Cuando el caso se publique en la bolsa interna, las postulaciones de los consultores elegibles aparecerán aquí para su evaluación (T3D).'
        }
      />
    );
  }

  return (
    <Section
      title="Postulaciones"
      description={`${data.length} postulación${data.length === 1 ? '' : 'es'} · evaluadas con la plantilla T3D`}
    >
      <div className="space-y-3">
        {data.map((application) => {
          const selected = application.status === 'ACEPTADA';

          return (
            <Panel key={application.id} className={cn(selected && 'border-brand/50')}>
              <div className="flex items-start justify-between gap-4 border-b border-border-subtle px-5 py-3.5">
                <PersonCell
                  name={application.consultant.fullName}
                  size="md"
                  secondary={
                    <span className="text-muted-foreground">
                      <span className="code">{application.consultant.code}</span>
                      {application.consultant.tier &&
                        ` · ${application.consultant.tier.toLowerCase()}`}{' '}
                      · {application.consultant.yearsOfExperience} años ·{' '}
                      {application.consultant.assignedCases} caso
                      {application.consultant.assignedCases === 1 ? '' : 's'} atendido
                      {application.consultant.assignedCases === 1 ? '' : 's'}
                    </span>
                  }
                />
                <div className="flex shrink-0 items-center gap-3">
                  {application.evaluation && (
                    <span className="tabular text-body font-semibold">
                      {application.evaluation.totalScore}
                      <span className="text-caption font-normal text-muted-foreground">/25</span>
                    </span>
                  )}
                  <Badge tone={selected ? 'brand' : 'outline'} dot={selected}>
                    {humanizeCode(application.status)}
                  </Badge>
                </div>
              </div>

              <div className="space-y-4 px-5 py-4">
                <p className="text-caption text-muted-foreground">
                  {application.consultant.specialties
                    .map((specialty) => label('ESPECIALIDAD', specialty.specialtyCode))
                    .join(' · ')}
                </p>

                <dl className="grid gap-x-8 gap-y-3 md:grid-cols-2">
                  <DefItem label="Interés y pertinencia">
                    <span className="text-body-sm leading-relaxed text-ink-2">
                      {application.fitJustification}
                    </span>
                  </DefItem>
                  <DefItem label="Enfoque preliminar">
                    <span className="text-body-sm leading-relaxed text-ink-2">
                      {application.preliminaryApproach}
                    </span>
                  </DefItem>
                  <DefItem label="Experiencia relevante">
                    <span className="text-body-sm leading-relaxed text-ink-2">
                      {application.relevantExperience}
                    </span>
                  </DefItem>
                  <DefItem label="Disponibilidad">
                    <span className="text-body-sm text-ink-2">{application.availability}</span>
                  </DefItem>
                </dl>

                {application.evaluation && (
                  <div className="space-y-2 border-t border-border-subtle pt-3">
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                      {(
                        [
                          ['specialtyFit', 'Especialidad'],
                          ['experienceFit', 'Experiencia'],
                          ['levelFit', 'Nivel'],
                          ['availabilityFit', 'Disponibilidad'],
                          ['trackRecordFit', 'Historial'],
                        ] as const
                      ).map(([key, text]) => (
                        <ScoreCell key={key} label={text} value={application.evaluation![key]} />
                      ))}
                    </div>
                    <p className="text-body-sm leading-relaxed text-ink-2">
                      {application.evaluation.notes}
                    </p>
                    <p className="text-caption text-muted-foreground">
                      Evaluó {application.evaluation.evaluatedBy?.fullName ?? 'Advisory'} ·{' '}
                      {formatDate(application.evaluation.createdAt)}
                    </p>
                  </div>
                )}

                <p className="text-caption text-muted-foreground">
                  Postulada {formatRelative(application.createdAt)}
                </p>
              </div>
            </Panel>
          );
        })}
      </div>
    </Section>
  );
}

/** Puntuación 1–5 con cinco segmentos. */
function ScoreCell({ label, value }: { label: string; value: number }) {
  return (
    <div className="space-y-1">
      <span className="block text-caption text-muted-foreground">{label}</span>
      <span className="flex items-center gap-2">
        <span className="flex gap-0.5" aria-hidden>
          {[1, 2, 3, 4, 5].map((step) => (
            <span
              key={step}
              className={cn(
                'h-1 w-2.5 rounded-full',
                step <= value ? 'bg-foreground' : 'bg-border',
              )}
            />
          ))}
        </span>
        <span className="tabular text-caption font-medium">{value}/5</span>
      </span>
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

const CONTENT_BLOCKS: Array<[string, string, string]> = [
  ['executiveSummary', 'A', 'Resumen ejecutivo'],
  ['objective', 'B', 'Objetivo de la intervención'],
  ['scope', 'C', 'Alcance'],
  ['exclusions', 'D', 'Exclusiones'],
  ['activities', 'E', 'Actividades'],
  ['deliverables', 'F', 'Entregables esperados'],
  ['schedule', 'G', 'Cronograma preliminar'],
  ['valuation', 'H', 'Valoración inicial'],
  ['conditions', 'I', 'Condiciones y supuestos'],
];

function ProposalTab({ caseId }: { caseId: string }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['case', caseId, 'proposal'],
    queryFn: () => api.get<ProposalView>(`/cases/${caseId}/proposal`),
    retry: false,
  });

  const [selected, setSelected] = React.useState<number | null>(null);

  if (isLoading) return <Skeleton className="h-64" />;

  // La API responde 404 mientras el expediente de propuesta no exista.
  if (error || !data) {
    return (
      <EmptyPanel
        title="Todavía no hay propuesta"
        description="El expediente se abre cuando el consultor responsable inicia el diseño (TP4). Desde entonces cada versión queda registrada aquí."
      />
    );
  }

  const version = data.versions.find((item) => item.versionNumber === selected) ?? data.versions[0];

  return (
    <div className="space-y-8">
      <Section
        title="Versiones"
        description="Ninguna versión se sobrescribe: cada ajuste genera una nueva y conserva la anterior"
      >
        <Panel>
          <Table>
            <THead>
              <tr>
                <TH>Versión</TH>
                <TH>Estado</TH>
                <TH>Autor</TH>
                <TH>Nota de cambio</TH>
                <TH className="text-right">Creada</TH>
              </tr>
            </THead>
            <TBody>
              {data.versions.map((item) => {
                const isSelected = version?.versionNumber === item.versionNumber;
                return (
                  <TR
                    key={item.id}
                    className={cn(
                      'cursor-pointer',
                      isSelected && 'bg-brand-soft hover:bg-brand-soft',
                    )}
                    onClick={() => setSelected(item.versionNumber)}
                    aria-selected={isSelected}
                  >
                    <TD className="tabular font-semibold">v{item.versionNumber}</TD>
                    <TD>
                      <span className="flex items-center gap-2">
                        <Badge tone={item.status === 'ACEPTADA' ? 'success' : 'outline'}>
                          {humanizeCode(item.status)}
                        </Badge>
                        {item.frozenAt && (
                          <span className="inline-flex items-center gap-1 text-caption text-muted-foreground">
                            <Lock className="size-3" aria-hidden /> congelada
                          </span>
                        )}
                      </span>
                    </TD>
                    <TD className="text-ink-2">{item.createdBy?.fullName ?? '—'}</TD>
                    <TD className="max-w-64">
                      <span
                        className="block truncate text-muted-foreground"
                        title={item.changeNote ?? undefined}
                      >
                        {item.changeNote ?? '—'}
                      </span>
                    </TD>
                    <TD className="whitespace-nowrap text-right text-muted-foreground">
                      {formatDate(item.createdAt)}
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        </Panel>
      </Section>

      {version && (
        <Section
          title={`Contenido · v${version.versionNumber}`}
          description={`Plantilla TP4C · ${
            version.frozenAt
              ? `congelada el ${formatDate(version.frozenAt)}, sólo lectura`
              : 'borrador editable por el consultor responsable'
          }`}
        >
          <Panel className="space-y-5 px-5 py-5">
            {version.analysis?.problemSynthesis && (
              <div className="rounded-sm bg-muted px-4 py-3">
                <p className="text-caption text-muted-foreground">Análisis estructurado · TP4B</p>
                <p className="mt-1 text-body-sm leading-relaxed text-ink-2">
                  {version.analysis.problemSynthesis}
                </p>
                {version.analysis.risks && (
                  <>
                    <p className="mt-3 text-caption text-muted-foreground">Riesgos identificados</p>
                    <p className="mt-1 text-body-sm leading-relaxed text-ink-2">
                      {version.analysis.risks}
                    </p>
                  </>
                )}
              </div>
            )}

            {version.content ? (
              <dl className="divide-y divide-border-subtle">
                {CONTENT_BLOCKS.map(([key, letter, blockLabel]) =>
                  version.content?.[key] ? (
                    <div
                      key={key}
                      className="grid gap-1 py-3 first:pt-0 last:pb-0 sm:grid-cols-[200px_minmax(0,1fr)] sm:gap-6"
                    >
                      <dt className="flex items-baseline gap-2 text-body-sm font-medium text-foreground">
                        <span className="tabular text-caption font-semibold text-muted-foreground">
                          {letter}
                        </span>
                        {blockLabel}
                      </dt>
                      <dd className="max-w-prose whitespace-pre-line text-body-sm leading-relaxed text-ink-2">
                        {version.content[key]}
                      </dd>
                    </div>
                  ) : null,
                )}
              </dl>
            ) : (
              <p className="text-body-sm text-muted-foreground">
                Esta versión aún no tiene contenido.
              </p>
            )}
          </Panel>
        </Section>
      )}

      {data.reviews.length > 0 && (
        <Section
          title="Revisiones de QA"
          description="Metodológica (TP4H) y revisión experta independiente"
        >
          <Panel>
            <ul className="divide-y divide-border-subtle">
              {data.reviews.map((review) => (
                <li key={review.id} className="space-y-2 px-5 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-body-sm font-medium">
                        {review.type === 'METODOLOGICA' ? 'Revisión metodológica' : 'Peer review'}
                      </span>
                      <Badge tone={reviewTone(review.outcome)} dot>
                        {humanizeCode(review.outcome)}
                      </Badge>
                      <span className="tabular text-caption text-muted-foreground">
                        v{review.versionNumber}
                      </span>
                    </div>
                    <span className="text-caption text-muted-foreground">
                      {review.reviewer?.fullName ?? '—'} · {formatDate(review.createdAt)}
                    </span>
                  </div>
                  <ul className="grid gap-x-4 gap-y-1 sm:grid-cols-2">
                    {Object.entries(review.checklist).map(([key, value]) => (
                      <li key={key} className="flex items-center gap-2 text-caption">
                        {value ? (
                          <CheckCircle2
                            className="size-3.5 shrink-0 text-success"
                            aria-label="Cumple"
                          />
                        ) : (
                          <CircleDashed
                            className="size-3.5 shrink-0 text-muted-foreground"
                            aria-label="No cumple"
                          />
                        )}
                        <span className={value ? 'text-ink-2' : 'text-muted-foreground'}>
                          {checklistLabel(key)}
                        </span>
                      </li>
                    ))}
                  </ul>
                  {review.observations && (
                    <p className="max-w-prose text-body-sm leading-relaxed text-ink-2">
                      {review.observations}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </Panel>
        </Section>
      )}

      {data.adjustments.length > 0 && (
        <Section
          title="Ajustes solicitados por el cliente"
          description="TP6B · respuesta del consultor TP6C"
        >
          <Panel>
            <ul className="divide-y divide-border-subtle">
              {data.adjustments.map((adjustment) => (
                <li key={adjustment.id} className="space-y-2 px-5 py-4">
                  <p className="flex flex-wrap justify-between gap-2 text-caption text-muted-foreground">
                    <span className="tabular font-medium">Sobre v{adjustment.versionNumber}</span>
                    <span>
                      {adjustment.requestedBy?.fullName ?? 'Cliente'} ·{' '}
                      {formatDate(adjustment.createdAt)}
                    </span>
                  </p>
                  <p className="max-w-prose text-body-sm leading-relaxed text-ink-2">
                    {adjustment.details}
                  </p>
                  {adjustment.response && (
                    <div className="border-l-2 border-border-strong pl-3">
                      <p className="text-caption text-muted-foreground">Respuesta del consultor</p>
                      <p className="max-w-prose text-body-sm leading-relaxed text-ink-2">
                        {adjustment.response}
                      </p>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </Panel>
        </Section>
      )}
    </div>
  );
}

function reviewTone(outcome: string): 'success' | 'warning' | 'neutral' {
  if (outcome === 'APROBADA') return 'success';
  if (outcome === 'AJUSTES_SOLICITADOS') return 'warning';
  return 'neutral';
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
  progress: {
    requiredTotal: number;
    requiredSettled: number;
    percent: number;
    isComplete: boolean;
    pending: string[];
  };
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

  // La API responde 404 mientras no exista el checklist T7A.
  if (checklist.error || !checklist.data) {
    return (
      <EmptyPanel
        title="La contratación aún no ha comenzado"
        description="El checklist T7A se crea automáticamente cuando el cliente acepta la propuesta. Sin él completo, la ejecución no puede autorizarse."
      />
    );
  }

  const data = checklist.data;

  return (
    <div className="space-y-8">
      <Section
        title="Checklist de contratación (T7A)"
        description="NODUS verifica el cumplimiento del proceso, no el contenido legal. Sin este checklist completo, la ejecución no se autoriza."
        actions={
          <span className="tabular text-body-sm">
            <span className="font-semibold">{data.progress.requiredSettled}</span>
            <span className="text-muted-foreground">
              {' '}
              de {data.progress.requiredTotal} obligatorios
            </span>
          </span>
        }
      >
        <Panel>
          <div className="h-1 overflow-hidden rounded-t-md bg-muted" aria-hidden>
            <div
              className={cn('h-full', data.progress.isComplete ? 'bg-success' : 'bg-brand')}
              style={{ width: `${data.progress.percent}%` }}
            />
          </div>
          <ul className="divide-y divide-border-subtle">
            {data.items.map((item) => (
              <li key={item.id} className="flex items-start gap-3 px-5 py-3">
                {item.status === 'CUMPLIDO' ? (
                  <CheckCircle2
                    className="mt-0.5 size-4 shrink-0 text-success"
                    aria-label="Cumplido"
                  />
                ) : (
                  <CircleDashed
                    className="mt-0.5 size-4 shrink-0 text-subtle-foreground"
                    aria-hidden
                  />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-body-sm font-medium text-foreground">
                    {item.label}
                    {!item.isRequired && (
                      <span className="ml-1.5 text-caption font-normal text-muted-foreground">
                        opcional
                      </span>
                    )}
                  </p>
                  {item.description && (
                    <p className="text-caption leading-relaxed text-muted-foreground">
                      {item.description}
                    </p>
                  )}
                  {item.notes && (
                    <p className="mt-0.5 text-caption italic text-muted-foreground">{item.notes}</p>
                  )}
                  {item.evidences.length > 0 && (
                    <p className="mt-0.5 text-caption text-muted-foreground">
                      {item.evidences.length} evidencia{item.evidences.length === 1 ? '' : 's'}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-0.5">
                  <span
                    className={cn(
                      'text-body-sm',
                      item.status === 'CUMPLIDO' ? 'text-success' : 'text-ink-2',
                    )}
                  >
                    {humanizeCode(item.status)}
                  </span>
                  {item.responsible && (
                    <span className="text-caption text-muted-foreground">{item.responsible}</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      </Section>

      {framework.data && (
        <Section
          title="Marco operativo del servicio (T7B)"
          description={`${framework.data.uploadedBy?.fullName ?? 'Consultor'} · ${formatDate(framework.data.createdAt)} · base del seguimiento de la ejecución`}
        >
          <dl className="grid max-w-4xl gap-x-8 gap-y-4 md:grid-cols-2">
            <DefItem label="Duración estimada">{framework.data.estimatedDurationDays} días</DefItem>
            <DefItem label="Contacto principal">{framework.data.primaryContact}</DefItem>
            <DefItem label="Condiciones operativas" className="md:col-span-2">
              <span className="text-body-sm leading-relaxed text-ink-2">
                {framework.data.operatingConditions}
              </span>
            </DefItem>
            <DefItem label="Cronograma base" className="md:col-span-2">
              <span className="text-body-sm leading-relaxed text-ink-2">
                {framework.data.baselineSchedule}
              </span>
            </DefItem>
            <DefItem label="Entregables comprometidos" className="md:col-span-2">
              <span className="text-body-sm leading-relaxed text-ink-2">
                {framework.data.committedDeliverables}
              </span>
            </DefItem>
            <DefItem label="Dependencias del cliente">
              <span className="text-body-sm leading-relaxed text-ink-2">
                {framework.data.clientDependencies}
              </span>
            </DefItem>
            <DefItem label="Supuestos">
              <span className="text-body-sm leading-relaxed text-ink-2">
                {framework.data.assumptions}
              </span>
            </DefItem>
          </dl>
        </Section>
      )}
    </div>
  );
}

// ============================================================================
//  Ejecución: resumen operativo, hitos, actividades, entregables, incidencias
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

type ExecutionView = 'summary' | 'milestones' | 'activities' | 'deliverables' | 'incidents';

const sum = (record: Record<string, number> | undefined): number =>
  Object.values(record ?? {}).reduce((total, value) => total + value, 0);

const isOpenIncident = (status: string): boolean => status !== 'CERRADA' && status !== 'RESUELTA';

function ExecutionTab({ caseId }: { caseId: string }) {
  const [view, setView] = React.useState<ExecutionView>('summary');

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
  if (summary.error) {
    return <LoadError what="la ejecución" onRetry={() => void summary.refetch()} />;
  }

  const total =
    (activities.data?.length ?? 0) +
    (milestones.data?.length ?? 0) +
    (deliverables.data?.length ?? 0);

  if (total === 0) {
    return (
      <EmptyPanel
        title="La agenda operativa aún no está activa"
        description="Se habilita cuando el caso queda autorizado para ejecución (T8A). A partir de ahí aquí se siguen hitos, actividades, entregables e incidencias."
      />
    );
  }

  const openIncidents = (incidents.data ?? []).filter((incident) =>
    isOpenIncident(incident.status),
  ).length;

  return (
    <div className="space-y-5">
      <SegmentedControl<ExecutionView>
        value={view}
        onValueChange={setView}
        layoutId="execution-view"
        ariaLabel="Vista de ejecución"
        options={[
          { value: 'summary', label: 'Resumen' },
          { value: 'milestones', label: 'Hitos', count: milestones.data?.length ?? 0 },
          { value: 'activities', label: 'Actividades', count: activities.data?.length ?? 0 },
          { value: 'deliverables', label: 'Entregables', count: deliverables.data?.length ?? 0 },
          { value: 'incidents', label: 'Incidencias', count: incidents.data?.length ?? 0 },
        ]}
      />

      {view === 'summary' && summary.data && (
        <div className="space-y-6">
          <dl className="grid gap-px overflow-hidden rounded-md border border-border bg-border sm:grid-cols-2 xl:grid-cols-4 [&>div]:bg-card">
            <OpsStat
              label="Hitos"
              value={sum(summary.data.milestones)}
              detail={`${summary.data.milestones.CUMPLIDO ?? 0} cumplidos`}
              alert={
                summary.data.milestonesOverdue > 0
                  ? `${summary.data.milestonesOverdue} vencido${summary.data.milestonesOverdue === 1 ? '' : 's'}`
                  : null
              }
            />
            <OpsStat
              label="Actividades"
              value={sum(summary.data.activities)}
              detail={`${summary.data.activities.COMPLETADA ?? 0} completadas`}
              alert={
                summary.data.activities.BLOQUEADA
                  ? `${summary.data.activities.BLOQUEADA} bloqueada${summary.data.activities.BLOQUEADA === 1 ? '' : 's'}`
                  : null
              }
            />
            <OpsStat
              label="Entregables"
              value={sum(summary.data.deliverables)}
              detail={`${summary.data.deliverables.LISTO_PARA_CIERRE ?? 0} listos para cierre`}
            />
            <OpsStat
              label="Incidencias abiertas"
              value={openIncidents}
              detail={`${incidents.data?.length ?? 0} registradas`}
              alert={openIncidents > 0 ? 'Requieren decisión' : null}
            />
          </dl>

          {summary.data.closureBlockers.length > 0 ? (
            <Section title="Pendiente para el cierre técnico">
              <ul className="space-y-1.5">
                {summary.data.closureBlockers.map((blocker) => (
                  <li key={blocker} className="flex gap-2 text-body-sm text-ink-2">
                    <TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-warning" aria-hidden />
                    {blocker}
                  </li>
                ))}
              </ul>
            </Section>
          ) : (
            summary.data.readyForTechnicalClosure && (
              <p className="flex items-center gap-2 text-body-sm text-ink-2">
                <CheckCircle2 className="size-4 text-success" aria-hidden />
                Sin bloqueos: el caso puede pasar a cierre técnico.
              </p>
            )
          )}
        </div>
      )}

      {view === 'milestones' &&
        ((milestones.data?.length ?? 0) > 0 ? (
          <Panel>
            <Table>
              <THead>
                <tr>
                  <TH>Hito</TH>
                  <TH>Responsable</TH>
                  <TH>Criticidad</TH>
                  <TH>Estado</TH>
                  <TH className="text-right">Fecha objetivo</TH>
                </tr>
              </THead>
              <TBody>
                {milestones.data!.map((milestone) => (
                  <TR key={milestone.id}>
                    <TD className="max-w-72">
                      <span className="block truncate font-medium" title={milestone.name}>
                        {milestone.name}
                      </span>
                    </TD>
                    <TD className="text-ink-2">{milestone.responsible}</TD>
                    <TD>
                      <span
                        className={cn(
                          'inline-flex items-center gap-1.5',
                          criticalityText(milestone.criticality),
                        )}
                      >
                        {milestone.criticality === 'CRITICO' && (
                          <TriangleAlert className="size-3.5" aria-hidden />
                        )}
                        {humanizeCode(milestone.criticality)}
                      </span>
                    </TD>
                    <TD>
                      <OutcomeText
                        status={milestone.status}
                        success={['CUMPLIDO']}
                        failure={['INCUMPLIDO']}
                      />
                    </TD>
                    <TD
                      className={cn(
                        'tabular whitespace-nowrap text-right',
                        milestone.isOverdue ? 'font-medium text-danger' : 'text-muted-foreground',
                      )}
                    >
                      {milestone.isOverdue && <span className="sr-only">Vencido: </span>}
                      {formatDate(milestone.targetDate)}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </Panel>
        ) : (
          <EmptyPanel
            title="Sin hitos registrados"
            description="Los hitos comprometidos en el marco operativo (T8C) aparecen aquí."
          />
        ))}

      {view === 'activities' &&
        ((activities.data?.length ?? 0) > 0 ? (
          <Panel>
            <Table>
              <THead>
                <tr>
                  <TH>Actividad</TH>
                  <TH>Responsable</TH>
                  <TH>Estado</TH>
                  <TH className="text-right">Fecha objetivo</TH>
                </tr>
              </THead>
              <TBody>
                {activities.data!.map((activity) => (
                  <TR key={activity.id}>
                    <TD className="max-w-80">
                      <span className="block truncate" title={activity.name}>
                        {activity.name}
                      </span>
                    </TD>
                    <TD className="text-ink-2">{activity.responsible}</TD>
                    <TD>
                      <OutcomeText
                        status={activity.status}
                        success={['COMPLETADA']}
                        failure={['BLOQUEADA']}
                      />
                    </TD>
                    <TD className="tabular whitespace-nowrap text-right text-muted-foreground">
                      {formatDate(activity.targetDate)}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </Panel>
        ) : (
          <EmptyPanel
            title="Sin actividades registradas"
            description="Las actividades de la agenda operativa (T8B) aparecen aquí."
          />
        ))}

      {view === 'deliverables' &&
        ((deliverables.data?.length ?? 0) > 0 ? (
          <Panel>
            <ul className="divide-y divide-border-subtle">
              {deliverables.data!.map((deliverable) => (
                <li key={deliverable.id} className="space-y-2 px-5 py-3.5">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-body-sm font-medium">{deliverable.name}</p>
                      <p className="text-caption text-muted-foreground">
                        {deliverable.responsible} · objetivo {formatDate(deliverable.targetDate)}
                      </p>
                    </div>
                    <OutcomeText
                      status={deliverable.status}
                      success={['LISTO_PARA_CIERRE']}
                      failure={[]}
                    />
                  </div>
                  {deliverable.versions.length > 0 && (
                    <ul className="space-y-1">
                      {deliverable.versions.map((version) => (
                        <li key={version.id} className="flex items-center gap-3 text-caption">
                          <span className="tabular w-6 shrink-0 font-semibold text-ink-2">
                            v{version.versionNumber}
                          </span>
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
                </li>
              ))}
            </ul>
          </Panel>
        ) : (
          <EmptyPanel
            title="Sin entregables registrados"
            description="Cada carga de un entregable (T8G) conserva las versiones anteriores."
          />
        ))}

      {view === 'incidents' &&
        ((incidents.data?.length ?? 0) > 0 ? (
          <Panel>
            <ul className="divide-y divide-border-subtle">
              {incidents.data!.map((incident) => {
                const open = isOpenIncident(incident.status);
                return (
                  <li key={incident.id} className="space-y-1.5 px-5 py-3.5">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <p className="flex items-center gap-2 text-body-sm font-medium">
                        {open && (
                          <TriangleAlert
                            className="size-3.5 shrink-0 text-danger"
                            aria-label="Abierta"
                          />
                        )}
                        {incident.title}
                      </p>
                      <span className="text-caption text-muted-foreground">
                        Impacto {humanizeCode(incident.impact).toLowerCase()} ·{' '}
                        <span className={open ? 'font-medium text-danger' : 'text-success'}>
                          {humanizeCode(incident.status)}
                        </span>
                      </span>
                    </div>
                    <p className="max-w-prose text-body-sm leading-relaxed text-ink-2">
                      {incident.description}
                    </p>
                    <p className="text-caption text-muted-foreground">
                      <span className="font-medium text-ink-2">Acción sugerida:</span>{' '}
                      {incident.suggestedAction}
                    </p>
                    {incident.decision && (
                      <p className="text-caption text-muted-foreground">
                        <span className="font-medium text-ink-2">Decisión:</span>{' '}
                        {incident.decision}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          </Panel>
        ) : (
          <EmptyPanel
            title="Sin incidencias"
            description="No se han reportado incidencias durante la ejecución."
          />
        ))}
    </div>
  );
}

function OpsStat({
  label,
  value,
  detail,
  alert,
}: {
  label: string;
  value: number;
  detail: string;
  alert?: string | null;
}) {
  return (
    <div className="space-y-1 px-5 py-4">
      <dt className="text-label text-muted-foreground">{label}</dt>
      <dd className="text-h1 text-foreground">{value}</dd>
      <dd className="text-caption text-muted-foreground">
        {alert ? (
          <span className="inline-flex items-center gap-1 font-medium text-danger">
            <TriangleAlert className="size-3.5" aria-hidden />
            {alert}
          </span>
        ) : (
          detail
        )}
      </dd>
    </div>
  );
}

/** Estado de ejecución en texto: sólo éxito y fracaso llevan color. */
function OutcomeText({
  status,
  success,
  failure,
}: {
  status: string;
  success: string[];
  failure: string[];
}) {
  const tone = success.includes(status)
    ? 'text-success'
    : failure.includes(status)
      ? 'font-medium text-danger'
      : 'text-ink-2';
  return <span className={cn('whitespace-nowrap text-body-sm', tone)}>{humanizeCode(status)}</span>;
}

function criticalityText(criticality: string): string {
  if (criticality === 'CRITICO') return 'font-medium text-danger';
  if (criticality === 'ALTO') return 'text-warning';
  return 'text-ink-2';
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

const latestVersion = (doc: DocumentRow) =>
  [...doc.versions].sort((a, b) => b.versionNumber - a.versionNumber)[0]!;

function DocumentsTab({ caseId }: { caseId: string }) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['case', caseId, 'documents'],
    queryFn: () => api.get<DocumentRow[]>(`/cases/${caseId}/documents`),
  });

  if (isLoading) return <Skeleton className="h-48" />;
  if (error) return <LoadError what="los documentos" onRetry={() => void refetch()} />;

  const withFiles = (data ?? []).filter((doc) => doc.versions.length > 0);

  if (withFiles.length === 0) {
    return (
      <EmptyPanel
        title="Sin documentos cargados"
        description="La estructura documental del caso (Empresa → Caso → Etapa → Versión) está creada y lista para recibir archivos."
      />
    );
  }

  return (
    <Section
      title="Repositorio documental"
      description="Empresa → Caso → Etapa → Versión · ninguna versión se sobrescribe"
    >
      <Panel>
        <ul className="divide-y divide-border-subtle">
          {withFiles.map((doc) => (
            <DocumentItem key={doc.id} doc={doc} />
          ))}
        </ul>
      </Panel>
    </Section>
  );
}

/** Documento con su historial de versiones: la vigente arriba, las anteriores debajo. */
function DocumentItem({ doc }: { doc: DocumentRow }) {
  const versions = [...doc.versions].sort((a, b) => b.versionNumber - a.versionNumber);
  const latest = versions[0]!;

  return (
    <li className="px-5 py-3.5">
      <div className="flex items-start gap-3">
        <FileText className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="truncate text-body-sm font-medium" title={latest.fileName}>
            {latest.fileName}
          </p>
          <p className="text-caption text-muted-foreground">
            {doc.type} · {humanizeCode(doc.stage)} · {formatBytes(latest.sizeBytes)}
          </p>
        </div>
        <span className="tabular shrink-0 rounded-xs border border-border px-1.5 text-caption font-semibold">
          v{latest.versionNumber}
        </span>
      </div>
      <ul className="mt-2 space-y-1 pl-7">
        {versions.map((version) => (
          <li
            key={version.id}
            className="flex items-center gap-3 text-caption text-muted-foreground"
          >
            <span className="tabular w-6 shrink-0 font-medium text-ink-2">
              v{version.versionNumber}
            </span>
            <span className="min-w-0 flex-1 truncate">{version.uploadedBy?.fullName ?? '—'}</span>
            <span className="shrink-0">{formatDate(version.createdAt)}</span>
          </li>
        ))}
      </ul>
    </li>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
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
  if (communications.error) {
    return <LoadError what="las comunicaciones" onRetry={() => void communications.refetch()} />;
  }

  const hasData = (communications.data?.length ?? 0) > 0 || (meetings.data?.length ?? 0) > 0;

  if (!hasData) {
    return (
      <EmptyPanel
        title="Sin comunicaciones registradas"
        description="Toda interacción relevante del caso se registra aquí: no hay canal directo entre las partes fuera de la plataforma."
      />
    );
  }

  return (
    <div className="space-y-8">
      {(communications.data?.length ?? 0) > 0 && (
        <Section
          title="Comunicaciones estructuradas"
          description="Interacción controlada por la plataforma (T3A · T3B · TP4A · T8F)"
        >
          <Panel>
            <ul className="divide-y divide-border-subtle">
              {communications.data!.map((item) => (
                <li key={item.id} className="space-y-1 px-5 py-3.5">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-caption text-muted-foreground">
                    <span>
                      {humanizeCode(item.type)} · para {humanizeCode(item.audience).toLowerCase()}
                      {item.answeredAt && (
                        <span className="ml-2 inline-flex items-center gap-1 text-success">
                          <CheckCircle2 className="size-3" aria-hidden /> Respondida
                        </span>
                      )}
                    </span>
                    <span>
                      {item.createdBy?.fullName ?? 'Sistema'} · {formatDate(item.createdAt)}
                    </span>
                  </div>
                  <p className="text-body-sm font-medium">{item.subject}</p>
                  <p className="max-w-prose whitespace-pre-line text-body-sm leading-relaxed text-ink-2">
                    {item.body}
                  </p>
                </li>
              ))}
            </ul>
          </Panel>
        </Section>
      )}

      {(meetings.data?.length ?? 0) > 0 && (
        <Section title="Reuniones" description="T8E · reunión de cierre T9E">
          <Panel>
            <ul className="divide-y divide-border-subtle">
              {meetings.data!.map((meeting) => (
                <li key={meeting.id} className="space-y-1 px-5 py-3.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-body-sm font-medium">{meeting.title}</p>
                    <span className="tabular text-caption text-muted-foreground">
                      {formatDateTime(meeting.heldAt)} · {meeting.durationMinutes} min
                    </span>
                  </div>
                  <p className="text-caption text-muted-foreground">
                    Participantes: {meeting.participants}
                  </p>
                  <p className="max-w-prose text-body-sm leading-relaxed text-ink-2">
                    {meeting.conclusions}
                  </p>
                </li>
              ))}
            </ul>
          </Panel>
        </Section>
      )}
    </div>
  );
}
