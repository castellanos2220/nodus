import type {
  ActivityStatus,
  ApplicationStatus,
  AuditOrigin,
  CaseStatusCode,
  ConsultantStatus,
  DeliverableStatus,
  DocumentStage,
  ImpactLevel,
  IncidentStatus,
  MilestoneStatus,
  NotificationChannel,
  NotificationStatus,
  ProposalVersionStatus,
  ReviewOutcome,
  ReviewType,
  Role,
  SlaStatus,
  TransitionCode,
} from './enums';

/** Envoltorio estándar de todas las respuestas paginadas de la API. */
export interface Paginated<T> {
  data: T[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

/** Forma estable de los errores de la API (`AllExceptionsFilter`). */
export interface ApiError {
  statusCode: number;
  code: string;
  message: string;
  details?: unknown;
  path: string;
  timestamp: string;
  requestId: string;
}

// ----------------------------------------------------------------------- Auth --

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  permissions: string[];
  companyId: string | null;
  consultantId: string | null;
  mustChangePassword: boolean;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface LoginResponse extends AuthTokens {
  user: AuthUser;
}

// ---------------------------------------------------------------------- Caso --

export interface AvailableTransition {
  code: TransitionCode;
  label: string;
  toStatus: CaseStatusCode;
  /** `true` si este usuario puede ejecutarla **ahora**. Lo calcula el backend. */
  allowed: boolean;
  /** Códigos de guard que la bloquean, para poder explicar qué falta. */
  blockedBy: string[];
  /** Mensaje legible del primer bloqueo. */
  blockedReason: string | null;
  requiresPayload: boolean;
}

export interface CaseSummary {
  id: string;
  code: string;
  title: string;
  status: CaseStatusCode;
  statusLabel: string;
  company: { id: string; name: string };
  areaCode: string | null;
  complexityCode: string | null;
  urgencyCode: string | null;
  impactCode: string | null;
  leadConsultant: { id: string; fullName: string } | null;
  slaStatus: SlaStatus | null;
  slaPercentConsumed: number | null;
  slaDeadline: string | null;
  openIncidents: number;
  createdAt: string;
  updatedAt: string;
}

export interface CaseDetail extends CaseSummary {
  description: string;
  contact: { id: string; fullName: string; email: string; jobTitle: string } | null;
  classification: CaseClassificationView | null;
  progressPercent: number;
  availableTransitions: AvailableTransition[];
  counts: {
    documents: number;
    applications: number;
    activities: number;
    milestones: number;
    incidents: number;
    deliverables: number;
    proposalVersions: number;
  };
  publishedAt: string | null;
  applicationDeadline: string | null;
  authorizedAt: string | null;
  executionStartedAt: string | null;
  closedAt: string | null;
  closureReason: string | null;
}

export interface CaseClassificationView {
  id: string;
  areaCode: string;
  subAreaCode: string | null;
  interventionTypeCode: string;
  complexityCode: string;
  impactCode: string;
  urgencyCode: string;
  eligibility: string;
  reviewNotes: string;
  classifiedBy: { id: string; fullName: string } | null;
  createdAt: string;
  isCurrent: boolean;
}

export interface TimelineEntry {
  id: string;
  createdAt: string;
  action: string;
  actionLabel: string;
  entity: string;
  entityId: string | null;
  origin: AuditOrigin;
  actor: { id: string; fullName: string; role: Role } | null;
  previousValue: unknown;
  newValue: unknown;
  metadata: Record<string, unknown> | null;
}

// -------------------------------------------------------------- Consultores --

export interface ConsultantSummary {
  id: string;
  code: string;
  fullName: string;
  email: string;
  status: ConsultantStatus;
  tier: string | null;
  experienceLevelCode: string | null;
  maxComplexityCode: string | null;
  engagementMode: string;
  sponsorName: string | null;
  specialties: { code: string; label: string; isPrimary: boolean }[];
  activeCases: number;
  closedCases: number;
  availability: string;
}

export interface OpportunityView {
  caseId: string;
  code: string;
  title: string;
  /** Descripción recortada: la bolsa no expone información sensible innecesaria. */
  summary: string;
  areaCode: string | null;
  interventionTypeCode: string | null;
  complexityCode: string | null;
  urgencyCode: string | null;
  impactCode: string | null;
  sectorCode: string | null;
  publishedAt: string | null;
  applicationDeadline: string | null;
  applicationsCount: number;
  alreadyApplied: boolean;
}

// -------------------------------------------------------------- Postulaciones --

export interface ApplicationView {
  id: string;
  caseId: string;
  status: ApplicationStatus;
  consultant: {
    id: string;
    fullName: string;
    tier: string | null;
    experienceLevelCode: string | null;
    specialties: string[];
    closedCases: number;
  };
  interestStatement: string;
  availability: string;
  relevantExperience: string;
  fitJustification: string;
  preliminaryApproach: string;
  submittedAt: string;
  evaluation: {
    totalScore: number;
    specialtyFit: number;
    experienceFit: number;
    levelFit: number;
    availabilityFit: number;
    trackRecordFit: number;
    notes: string;
    evaluatedAt: string;
  } | null;
}

// ----------------------------------------------------------------- Propuestas --

export interface ProposalVersionView {
  id: string;
  versionNumber: number;
  status: ProposalVersionStatus;
  analysis: Record<string, string> | null;
  content: Record<string, string> | null;
  changeNote: string | null;
  createdBy: { id: string; fullName: string } | null;
  createdAt: string;
  frozenAt: string | null;
  sentAt: string | null;
  isEditable: boolean;
}

export interface ProposalView {
  id: string;
  caseId: string;
  currentVersionNumber: number;
  versions: ProposalVersionView[];
  reviews: ProposalReviewView[];
  adjustments: ProposalAdjustmentView[];
}

export interface ProposalReviewView {
  id: string;
  versionNumber: number;
  type: ReviewType;
  outcome: ReviewOutcome;
  checklist: Record<string, boolean>;
  observations: string | null;
  reviewer: { id: string; fullName: string; role: Role } | null;
  createdAt: string;
}

export interface ProposalAdjustmentView {
  id: string;
  versionNumber: number;
  requestedBy: { id: string; fullName: string } | null;
  details: string;
  response: string | null;
  respondedAt: string | null;
  createdAt: string;
}

// ------------------------------------------------------------------ Ejecución --

export interface ActivityView {
  id: string;
  name: string;
  description: string | null;
  responsible: string;
  targetDate: string;
  status: ActivityStatus;
  notes: string | null;
  evidenceDocumentId: string | null;
  completedAt: string | null;
}

export interface MilestoneView {
  id: string;
  name: string;
  description: string | null;
  responsible: string;
  targetDate: string;
  criticality: ImpactLevel;
  status: MilestoneStatus;
  expectedResult: string | null;
  completedAt: string | null;
  isOverdue: boolean;
}

export interface IncidentView {
  id: string;
  typeCode: string;
  title: string;
  description: string;
  impact: ImpactLevel;
  suggestedAction: string;
  status: IncidentStatus;
  decision: string | null;
  reportedBy: { id: string; fullName: string } | null;
  reportedAt: string;
  resolvedAt: string | null;
}

export interface DeliverableView {
  id: string;
  name: string;
  description: string | null;
  typeCode: string | null;
  responsible: string;
  targetDate: string;
  status: DeliverableStatus;
  currentVersion: number;
  versions: {
    id: string;
    versionNumber: number;
    documentId: string | null;
    fileName: string | null;
    notes: string | null;
    uploadedBy: { id: string; fullName: string } | null;
    createdAt: string;
  }[];
  notes: string | null;
}

export interface ExecutionSummary {
  agendaActivated: boolean;
  activities: Record<ActivityStatus, number>;
  milestones: Record<MilestoneStatus, number>;
  milestonesOverdue: number;
  incidents: Record<IncidentStatus, number>;
  deliverables: Record<DeliverableStatus, number>;
  slaStatus: SlaStatus | null;
  readyForTechnicalClosure: boolean;
  closureBlockers: string[];
}

// ----------------------------------------------------------------- Documentos --

export interface DocumentView {
  id: string;
  caseId: string | null;
  companyId: string;
  stage: DocumentStage;
  type: string;
  name: string;
  currentVersion: number;
  versions: DocumentVersionView[];
  createdAt: string;
}

export interface DocumentVersionView {
  id: string;
  versionNumber: number;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  checksum: string;
  uploadedBy: { id: string; fullName: string } | null;
  createdAt: string;
}

// ------------------------------------------------------------------------ SLA --

export interface SlaInstanceView {
  id: string;
  caseId: string;
  caseCode: string;
  stage: string;
  ruleCode: string;
  ruleName: string;
  startedAt: string;
  deadline: string;
  completedAt: string | null;
  status: SlaStatus;
  elapsedHours: number;
  percentConsumed: number;
  alerts: { id: string; kind: string; createdAt: string; message: string }[];
  escalated: boolean;
}

// -------------------------------------------------------------- Notificaciones --

export interface NotificationView {
  id: string;
  templateCode: string | null;
  eventName: string;
  channel: NotificationChannel;
  status: NotificationStatus;
  subject: string;
  body: string;
  caseId: string | null;
  caseCode: string | null;
  createdAt: string;
  sentAt: string | null;
  readAt: string | null;
  error: string | null;
}

// ------------------------------------------------------------------ Dashboard --

export interface DashboardKpis {
  activeCases: number;
  criticalCases: number;
  overdueSlas: number;
  atRiskSlas: number;
  closedCases: number;
  closedWithoutContracting: number;
  activeConsultants: number;
  pendingApplications: number;
  pendingProposalReviews: number;
  casesByStatus: { status: CaseStatusCode; label: string; count: number }[];
  avgHoursToClassification: number | null;
  avgHoursToProposal: number | null;
  avgHoursToClosure: number | null;
  slaCompliancePercent: number | null;
  proposalConversionPercent: number | null;
  generatedAt: string;
}
