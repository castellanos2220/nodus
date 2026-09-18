import {
  ChecklistItemStatus,
  ConsultantStatus,
  DeliverableStatus,
  EligibilityResult,
  ImpactLevel,
  IncidentStatus,
  MilestoneStatus,
  ProposalVersionStatus,
  ReviewOutcome,
  ReviewType,
} from '@prisma/client';
import { COMPLEXITY_RANK } from '@nodus/types';
import { WorkflowGuardError } from '../../../core/common/errors/domain.errors';
import type { GuardContext } from '../workflow.types';

/**
 * Guards del motor de workflow.
 *
 * Cada uno comprueba **una** precondición y, si no se cumple, lanza
 * `WorkflowGuardError` con un código estable y un mensaje que dice exactamente
 * qué falta. Son funciones y no clases porque no tienen estado ni dependencias
 * propias: reciben el cliente de transacción en el contexto.
 *
 * Los mismos guards se ejecutan en modo "dry run" desde `GET /cases/:id` para
 * poder responder "esta transición está bloqueada porque faltan 2 ítems del
 * checklist" sin duplicar la regla en el frontend.
 */
export type GuardFn = (context: GuardContext) => Promise<void>;

const str = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

// ---------------------------------------------------------------- Genéricos --

const noteRequired: GuardFn = async ({ note, payload }) => {
  const text = str(note) || str(payload.note);
  if (text.length < 10) {
    throw new WorkflowGuardError(
      'GUARD_NOTE_REQUIRED',
      'Debe registrar una observación de al menos 10 caracteres.',
    );
  }
};

const reasonRequired: GuardFn = async ({ payload, note }) => {
  const reason = str(payload.reason) || str(note);
  if (reason.length < 10) {
    throw new WorkflowGuardError(
      'GUARD_REASON_REQUIRED',
      'Debe registrar el motivo (mínimo 10 caracteres).',
    );
  }
};

// -------------------------------------------- Punto 2: clasificación (T2) ----

const classificationComplete: GuardFn = async ({ tx, case: kase }) => {
  const classification = await tx.caseClassification.findFirst({
    where: { caseId: kase.id, isCurrent: true },
    select: {
      areaCode: true,
      interventionTypeCode: true,
      complexityCode: true,
      impactCode: true,
      urgencyCode: true,
      eligibility: true,
    },
  });

  if (!classification) {
    throw new WorkflowGuardError(
      'GUARD_CLASSIFICATION_COMPLETE',
      'El caso no tiene clasificación registrada. Complete la plantilla T2 antes de continuar.',
    );
  }

  const missing = (
    [
      ['areaCode', 'área'],
      ['interventionTypeCode', 'tipo de intervención'],
      ['complexityCode', 'complejidad'],
      ['impactCode', 'impacto'],
      ['urgencyCode', 'urgencia'],
    ] as const
  )
    .filter(([field]) => !classification[field])
    .map(([, label]) => label);

  if (missing.length > 0) {
    throw new WorkflowGuardError(
      'GUARD_CLASSIFICATION_COMPLETE',
      `La clasificación está incompleta: falta ${missing.join(', ')}.`,
      { missing },
    );
  }

  if (classification.eligibility !== EligibilityResult.ELEGIBLE) {
    throw new WorkflowGuardError(
      'GUARD_CLASSIFICATION_COMPLETE',
      `El caso fue evaluado como ${classification.eligibility.replace(/_/g, ' ').toLowerCase()}. ` +
        'Sólo un caso elegible puede avanzar.',
      { eligibility: classification.eligibility },
    );
  }
};

// ------------------------------------- Punto 3: postulación y asignación ----

const hasApplications: GuardFn = async ({ tx, case: kase }) => {
  const count = await tx.application.count({
    where: { caseId: kase.id, status: { not: 'RETIRADA' } },
  });
  if (count === 0) {
    throw new WorkflowGuardError(
      'GUARD_HAS_APPLICATIONS',
      'No hay postulaciones para este caso; no se puede asignar un consultor.',
    );
  }
};

const applicationBelongsToCase: GuardFn = async ({ tx, case: kase, payload }) => {
  const applicationId = str(payload.applicationId);
  if (!applicationId) {
    throw new WorkflowGuardError(
      'GUARD_APPLICATION_BELONGS_TO_CASE',
      'Debe indicar la postulación seleccionada (applicationId).',
    );
  }

  const application = await tx.application.findUnique({
    where: { id: applicationId },
    select: { caseId: true, status: true },
  });

  if (!application || application.caseId !== kase.id) {
    throw new WorkflowGuardError(
      'GUARD_APPLICATION_BELONGS_TO_CASE',
      'La postulación seleccionada no pertenece a este caso.',
    );
  }
  if (application.status === 'RETIRADA') {
    throw new WorkflowGuardError(
      'GUARD_APPLICATION_BELONGS_TO_CASE',
      'La postulación seleccionada fue retirada por el consultor.',
    );
  }
};

const consultantEnabled: GuardFn = async ({ tx, payload }) => {
  const applicationId = str(payload.applicationId);
  const application = await tx.application.findUnique({
    where: { id: applicationId },
    select: {
      consultant: {
        select: { id: true, status: true, code: true, scope: { select: { canBeLeadConsultant: true } } },
      },
    },
  });

  const consultant = application?.consultant;
  if (!consultant) {
    throw new WorkflowGuardError(
      'GUARD_CONSULTANT_ENABLED',
      'No se encontró el consultor de la postulación seleccionada.',
    );
  }

  if (consultant.status !== ConsultantStatus.HABILITADO) {
    throw new WorkflowGuardError(
      'GUARD_CONSULTANT_ENABLED',
      `El consultor ${consultant.code} está en estado ${consultant.status} y sólo un consultor HABILITADO puede ser asignado.`,
      { consultantStatus: consultant.status },
    );
  }

  if (consultant.scope && !consultant.scope.canBeLeadConsultant) {
    throw new WorkflowGuardError(
      'GUARD_CONSULTANT_ENABLED',
      `El alcance del consultor ${consultant.code} no le permite actuar como responsable principal.`,
    );
  }
};

const consultantComplexityAllowed: GuardFn = async ({ tx, case: kase, payload }) => {
  if (!kase.complexityCode) return;

  const application = await tx.application.findUnique({
    where: { id: str(payload.applicationId) },
    select: { consultant: { select: { code: true, maxComplexityCode: true } } },
  });

  const consultant = application?.consultant;
  if (!consultant?.maxComplexityCode) return;

  const caseRank = COMPLEXITY_RANK[kase.complexityCode] ?? 0;
  const consultantRank = COMPLEXITY_RANK[consultant.maxComplexityCode] ?? 0;

  if (consultantRank < caseRank) {
    throw new WorkflowGuardError(
      'GUARD_CONSULTANT_COMPLEXITY_ALLOWED',
      `El consultor ${consultant.code} está habilitado hasta complejidad ${consultant.maxComplexityCode}, ` +
        `y este caso es de complejidad ${kase.complexityCode}.`,
      { caseComplexity: kase.complexityCode, consultantMax: consultant.maxComplexityCode },
    );
  }
};

/**
 * Además del índice único parcial de la migración 002 (que es la garantía dura),
 * este guard produce un mensaje comprensible en lugar de un error de constraint.
 */
const noActivePrimaryAssignment: GuardFn = async ({ tx, case: kase }) => {
  const existing = await tx.caseAssignment.findFirst({
    where: { caseId: kase.id, isPrimary: true, isActive: true },
    select: { consultant: { select: { code: true } } },
  });

  if (existing) {
    throw new WorkflowGuardError(
      'GUARD_NO_ACTIVE_PRIMARY_ASSIGNMENT',
      `El caso ya tiene un consultor responsable principal activo (${existing.consultant.code}).`,
    );
  }
};

const hasPrimaryAssignment: GuardFn = async ({ tx, case: kase }) => {
  const assignment = await tx.caseAssignment.findFirst({
    where: { caseId: kase.id, isPrimary: true, isActive: true },
    select: { id: true },
  });
  if (!assignment) {
    throw new WorkflowGuardError(
      'GUARD_HAS_PRIMARY_ASSIGNMENT',
      'El caso no tiene un consultor responsable principal activo.',
    );
  }
};

// ---------------------------------------------- Puntos 4 y 5: propuesta ----

/** Bloques A–J de TP4C que no pueden quedar vacíos (RF-039). */
const REQUIRED_CONTENT_BLOCKS: Array<[string, string]> = [
  ['executiveSummary', 'resumen ejecutivo'],
  ['objective', 'objetivo de la intervención'],
  ['scope', 'alcance'],
  ['exclusions', 'exclusiones'],
  ['activities', 'actividades'],
  ['deliverables', 'entregables esperados'],
  ['schedule', 'cronograma preliminar'],
  ['valuation', 'valoración inicial'],
  ['conditions', 'condiciones y supuestos'],
];

const proposalContentComplete: GuardFn = async ({ tx, case: kase }) => {
  const version = await tx.proposalVersion.findFirst({
    where: { proposal: { caseId: kase.id }, status: ProposalVersionStatus.BORRADOR },
    orderBy: { versionNumber: 'desc' },
    select: { id: true, versionNumber: true, content: true, analysis: true },
  });

  if (!version) {
    throw new WorkflowGuardError(
      'GUARD_PROPOSAL_CONTENT_COMPLETE',
      'No hay una versión de propuesta en borrador para enviar a QA.',
    );
  }

  const content = (version.content ?? {}) as Record<string, unknown>;
  const missing = REQUIRED_CONTENT_BLOCKS.filter(
    ([field]) => str(content[field]).length < 10,
  ).map(([, label]) => label);

  if (missing.length > 0) {
    throw new WorkflowGuardError(
      'GUARD_PROPOSAL_CONTENT_COMPLETE',
      `La propuesta (versión ${version.versionNumber}) está incompleta: falta ${missing.join(', ')}.`,
      { missing, versionNumber: version.versionNumber },
    );
  }

  const analysis = (version.analysis ?? {}) as Record<string, unknown>;
  if (str(analysis.problemSynthesis).length < 20) {
    throw new WorkflowGuardError(
      'GUARD_PROPOSAL_CONTENT_COMPLETE',
      'Falta el análisis estructurado del caso (TP4B): la síntesis del problema es obligatoria.',
      { missing: ['análisis estructurado (TP4B)'] },
    );
  }
};

const reviewApproved: GuardFn = async ({ tx, case: kase }) => {
  const version = await tx.proposalVersion.findFirst({
    where: { proposal: { caseId: kase.id }, status: ProposalVersionStatus.EN_QA },
    orderBy: { versionNumber: 'desc' },
    select: { id: true, versionNumber: true },
  });

  if (!version) {
    throw new WorkflowGuardError(
      'GUARD_REVIEW_APPROVED',
      'No hay una versión de propuesta en QA.',
    );
  }

  const approval = await tx.proposalReview.findFirst({
    where: {
      versionId: version.id,
      type: ReviewType.METODOLOGICA,
      outcome: ReviewOutcome.APROBADA,
    },
    select: { id: true },
  });

  if (!approval) {
    throw new WorkflowGuardError(
      'GUARD_REVIEW_APPROVED',
      `La versión ${version.versionNumber} necesita una revisión metodológica (TP4H) aprobada antes de enviarse al cliente.`,
      { versionNumber: version.versionNumber },
    );
  }
};

const reviewRequestedChanges: GuardFn = async ({ tx, case: kase }) => {
  const version = await tx.proposalVersion.findFirst({
    where: { proposal: { caseId: kase.id }, status: ProposalVersionStatus.EN_QA },
    orderBy: { versionNumber: 'desc' },
    select: { id: true, versionNumber: true },
  });

  if (!version) {
    throw new WorkflowGuardError(
      'GUARD_REVIEW_REQUESTED_CHANGES',
      'No hay una versión de propuesta en QA.',
    );
  }

  const review = await tx.proposalReview.findFirst({
    where: { versionId: version.id, outcome: ReviewOutcome.AJUSTES_SOLICITADOS },
    orderBy: { createdAt: 'desc' },
    select: { id: true, observations: true },
  });

  if (!review) {
    throw new WorkflowGuardError(
      'GUARD_REVIEW_REQUESTED_CHANGES',
      'Registre primero una revisión con resultado "ajustes solicitados" y sus observaciones.',
    );
  }
  if (str(review.observations).length < 20) {
    throw new WorkflowGuardError(
      'GUARD_REVIEW_REQUESTED_CHANGES',
      'La revisión que solicita ajustes debe incluir observaciones concretas.',
    );
  }
};

const hasSentVersion: GuardFn = async ({ tx, case: kase }) => {
  const version = await tx.proposalVersion.findFirst({
    where: { proposal: { caseId: kase.id }, status: ProposalVersionStatus.ENVIADA },
    select: { id: true },
  });
  if (!version) {
    throw new WorkflowGuardError(
      'GUARD_HAS_SENT_VERSION',
      'No hay ninguna versión de propuesta enviada al cliente.',
    );
  }
};

const adjustmentDetailsRequired: GuardFn = async ({ payload }) => {
  if (str(payload.adjustmentDetails).length < 30) {
    throw new WorkflowGuardError(
      'GUARD_ADJUSTMENT_DETAILS_REQUIRED',
      'Describa los ajustes solicitados (mínimo 30 caracteres) para que el consultor pueda atenderlos.',
    );
  }
};

const declineReasonRequired: GuardFn = async ({ payload }) => {
  if (!str(payload.declineReasonCode)) {
    throw new WorkflowGuardError(
      'GUARD_DECLINE_REASON_REQUIRED',
      'Seleccione el motivo de no continuidad (TP6E).',
    );
  }
};

const adjustedVersionIsNewer: GuardFn = async ({ tx, case: kase }) => {
  const [draft, sent] = await Promise.all([
    tx.proposalVersion.findFirst({
      where: { proposal: { caseId: kase.id }, status: ProposalVersionStatus.BORRADOR },
      orderBy: { versionNumber: 'desc' },
      select: { versionNumber: true },
    }),
    tx.proposalVersion.findFirst({
      where: {
        proposal: { caseId: kase.id },
        status: { in: [ProposalVersionStatus.ENVIADA, ProposalVersionStatus.SUPERADA] },
      },
      orderBy: { versionNumber: 'desc' },
      select: { versionNumber: true },
    }),
  ]);

  if (!draft) {
    throw new WorkflowGuardError(
      'GUARD_ADJUSTED_VERSION_IS_NEWER',
      'No hay una versión ajustada en borrador.',
    );
  }
  if (sent && draft.versionNumber <= sent.versionNumber) {
    throw new WorkflowGuardError(
      'GUARD_ADJUSTED_VERSION_IS_NEWER',
      'La versión ajustada debe ser posterior a la que se envió al cliente.',
      { draft: draft.versionNumber, sent: sent.versionNumber },
    );
  }
};

// ----------------------------------------------- Punto 7: contratación ----

const contractChecklistComplete: GuardFn = async ({ tx, case: kase }) => {
  const checklist = await tx.contractChecklist.findUnique({
    where: { caseId: kase.id },
    select: {
      items: {
        where: { isRequired: true, status: { not: ChecklistItemStatus.CUMPLIDO } },
        select: { label: true, status: true },
        orderBy: { sortOrder: 'asc' },
      },
    },
  });

  if (!checklist) {
    throw new WorkflowGuardError(
      'GUARD_CONTRACT_CHECKLIST_COMPLETE',
      'El caso no tiene checklist de contratación (T7A).',
    );
  }

  // Un ítem marcado NO_APLICA se considera resuelto: el blueprint lo permite
  // siempre que quede documentado, y el estado queda en la bitácora.
  const pending = checklist.items.filter((item) => item.status !== ChecklistItemStatus.NO_APLICA);

  if (pending.length > 0) {
    throw new WorkflowGuardError(
      'GUARD_CONTRACT_CHECKLIST_COMPLETE',
      `El checklist de contratación tiene ${pending.length} ítem(s) obligatorio(s) pendiente(s).`,
      { pending: pending.map((item) => item.label) },
    );
  }
};

const operationalFrameworkUploaded: GuardFn = async ({ tx, case: kase }) => {
  const framework = await tx.operationalFramework.findUnique({
    where: { caseId: kase.id },
    select: { id: true },
  });
  if (!framework) {
    throw new WorkflowGuardError(
      'GUARD_OPERATIONAL_FRAMEWORK_UPLOADED',
      'El consultor aún no ha cargado el marco operativo del servicio (T7B).',
    );
  }
};

// -------------------------------------------------- Punto 8: ejecución ----

const agendaActivated: GuardFn = async ({ tx, case: kase }) => {
  const [milestones, activities] = await Promise.all([
    tx.milestone.count({ where: { caseId: kase.id } }),
    tx.activity.count({ where: { caseId: kase.id } }),
  ]);

  if (milestones === 0 && activities === 0) {
    throw new WorkflowGuardError(
      'GUARD_AGENDA_ACTIVATED',
      'Cargue la agenda operativa (T8A) con al menos un hito o una actividad antes de iniciar la ejecución.',
    );
  }
};

const deliverablesReady: GuardFn = async ({ tx, case: kase }) => {
  const pending = await tx.deliverable.findMany({
    where: { caseId: kase.id, status: { not: DeliverableStatus.LISTO_PARA_CIERRE } },
    select: { name: true, status: true },
  });

  if (pending.length > 0) {
    throw new WorkflowGuardError(
      'GUARD_DELIVERABLES_READY',
      `Hay ${pending.length} entregable(s) que no están listos para cierre.`,
      { pending: pending.map((d) => `${d.name} (${d.status})`) },
    );
  }
};

const milestonesSettled: GuardFn = async ({ tx, case: kase }) => {
  const open = await tx.milestone.findMany({
    where: {
      caseId: kase.id,
      status: { notIn: [MilestoneStatus.CUMPLIDO, MilestoneStatus.JUSTIFICADO] },
    },
    select: { name: true, status: true },
  });

  if (open.length > 0) {
    throw new WorkflowGuardError(
      'GUARD_MILESTONES_SETTLED',
      `Hay ${open.length} hito(s) sin cumplir ni justificar.`,
      { pending: open.map((m) => `${m.name} (${m.status})`) },
    );
  }
};

const noCriticalOpenIncidents: GuardFn = async ({ tx, case: kase }) => {
  const open = await tx.incident.findMany({
    where: {
      caseId: kase.id,
      impact: { in: [ImpactLevel.ALTO, ImpactLevel.CRITICO] },
      status: {
        in: [IncidentStatus.ABIERTA, IncidentStatus.EN_ATENCION, IncidentStatus.ESCALADA],
      },
    },
    select: { title: true, status: true },
  });

  if (open.length > 0) {
    throw new WorkflowGuardError(
      'GUARD_NO_CRITICAL_OPEN_INCIDENTS',
      `Hay ${open.length} incidencia(s) de alto impacto sin cerrar.`,
      { pending: open.map((i) => `${i.title} (${i.status})`) },
    );
  }
};

const closureStatementRequired: GuardFn = async ({ payload }) => {
  if (str(payload.statement).length < 40) {
    throw new WorkflowGuardError(
      'GUARD_CLOSURE_STATEMENT_REQUIRED',
      'La declaración de cierre técnico (T9A) debe tener al menos 40 caracteres.',
    );
  }
};

// ----------------------------------------------------- Punto 9: cierre ----

const closureChecklistComplete: GuardFn = async ({ tx, case: kase }) => {
  const checklist = await tx.closureChecklist.findUnique({
    where: { caseId: kase.id },
    select: {
      items: {
        where: { isRequired: true, status: { not: ChecklistItemStatus.CUMPLIDO } },
        select: { label: true, status: true },
      },
    },
  });

  if (!checklist) {
    throw new WorkflowGuardError(
      'GUARD_CLOSURE_CHECKLIST_COMPLETE',
      'Falta la revisión final de cumplimiento (T9C).',
    );
  }

  const pending = checklist.items.filter((item) => item.status !== ChecklistItemStatus.NO_APLICA);
  if (pending.length > 0) {
    throw new WorkflowGuardError(
      'GUARD_CLOSURE_CHECKLIST_COMPLETE',
      `La revisión final tiene ${pending.length} ítem(s) pendiente(s).`,
      { pending: pending.map((item) => item.label) },
    );
  }
};

const clientClosureResponse: GuardFn = async ({ tx, case: kase }) => {
  const response = await tx.customerClosureResponse.findUnique({
    where: { caseId: kase.id },
    select: { response: true },
  });

  if (!response) {
    throw new WorkflowGuardError(
      'GUARD_CLIENT_CLOSURE_RESPONSE',
      'El cliente aún no ha registrado su aceptación u observaciones de cierre (T9F).',
    );
  }
  if (response.response === 'SOLICITUD_AJUSTE_FINAL') {
    throw new WorkflowGuardError(
      'GUARD_CLIENT_CLOSURE_RESPONSE',
      'El cliente solicitó un ajuste final: atiéndalo antes de cerrar el caso.',
    );
  }
};

const customerEvaluationRegistered: GuardFn = async ({ tx, case: kase }) => {
  const evaluation = await tx.customerEvaluation.findUnique({
    where: { caseId: kase.id },
    select: { id: true },
  });
  if (!evaluation) {
    throw new WorkflowGuardError(
      'GUARD_CUSTOMER_EVALUATION',
      'Falta la encuesta de satisfacción del cliente (T9G).',
    );
  }
};

const consultantEvaluationRegistered: GuardFn = async ({ tx, case: kase }) => {
  const evaluation = await tx.consultantEvaluation.findFirst({
    where: { caseId: kase.id },
    select: { id: true },
  });
  if (!evaluation) {
    throw new WorkflowGuardError(
      'GUARD_CONSULTANT_EVALUATION',
      'Falta la evaluación de desempeño del consultor (T9H).',
    );
  }
};

// --------------------------------------------------------------- Registro --

export const GUARDS: Readonly<Record<string, GuardFn>> = {
  GUARD_NOTE_REQUIRED: noteRequired,
  GUARD_REASON_REQUIRED: reasonRequired,
  GUARD_CLASSIFICATION_COMPLETE: classificationComplete,
  GUARD_HAS_APPLICATIONS: hasApplications,
  GUARD_APPLICATION_BELONGS_TO_CASE: applicationBelongsToCase,
  GUARD_CONSULTANT_ENABLED: consultantEnabled,
  GUARD_CONSULTANT_COMPLEXITY_ALLOWED: consultantComplexityAllowed,
  GUARD_NO_ACTIVE_PRIMARY_ASSIGNMENT: noActivePrimaryAssignment,
  GUARD_HAS_PRIMARY_ASSIGNMENT: hasPrimaryAssignment,
  GUARD_PROPOSAL_CONTENT_COMPLETE: proposalContentComplete,
  GUARD_REVIEW_APPROVED: reviewApproved,
  GUARD_REVIEW_REQUESTED_CHANGES: reviewRequestedChanges,
  GUARD_HAS_SENT_VERSION: hasSentVersion,
  GUARD_ADJUSTMENT_DETAILS_REQUIRED: adjustmentDetailsRequired,
  GUARD_DECLINE_REASON_REQUIRED: declineReasonRequired,
  GUARD_ADJUSTED_VERSION_IS_NEWER: adjustedVersionIsNewer,
  GUARD_CONTRACT_CHECKLIST_COMPLETE: contractChecklistComplete,
  GUARD_OPERATIONAL_FRAMEWORK_UPLOADED: operationalFrameworkUploaded,
  GUARD_AGENDA_ACTIVATED: agendaActivated,
  GUARD_DELIVERABLES_READY: deliverablesReady,
  GUARD_MILESTONES_SETTLED: milestonesSettled,
  GUARD_NO_CRITICAL_OPEN_INCIDENTS: noCriticalOpenIncidents,
  GUARD_CLOSURE_STATEMENT_REQUIRED: closureStatementRequired,
  GUARD_CLOSURE_CHECKLIST_COMPLETE: closureChecklistComplete,
  GUARD_CLIENT_CLOSURE_RESPONSE: clientClosureResponse,
  GUARD_CUSTOMER_EVALUATION: customerEvaluationRegistered,
  GUARD_CONSULTANT_EVALUATION: consultantEvaluationRegistered,
};

/**
 * Guards que dependen del `payload` de la petición.
 *
 * En el "dry run" que alimenta `availableTransitions` de `GET /cases/:id` no hay
 * payload todavía, así que estos guards se omiten: la UI recibe
 * `requiresPayload: true` y pinta el formulario. Ejecutarlos en seco daría
 * siempre "bloqueado", que sería informativamente falso.
 */
export const PAYLOAD_DEPENDENT_GUARDS: ReadonlySet<string> = new Set([
  'GUARD_NOTE_REQUIRED',
  'GUARD_REASON_REQUIRED',
  'GUARD_APPLICATION_BELONGS_TO_CASE',
  'GUARD_CONSULTANT_ENABLED',
  'GUARD_CONSULTANT_COMPLEXITY_ALLOWED',
  'GUARD_ADJUSTMENT_DETAILS_REQUIRED',
  'GUARD_DECLINE_REASON_REQUIRED',
  'GUARD_CLOSURE_STATEMENT_REQUIRED',
]);
