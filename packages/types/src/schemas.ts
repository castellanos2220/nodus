import { z } from 'zod';
import {
  ActivityStatus,
  ClientDecisionType,
  DeliverableStatus,
  DocumentStage,
  ImpactLevel,
  IncidentStatus,
  MilestoneStatus,
  ReviewOutcome,
  ReviewType,
  TransitionCode,
} from './enums';

/**
 * Esquemas Zod compartidos.
 *
 * El frontend los usa con React Hook Form (`zodResolver`). El backend valida con
 * class-validator en los DTOs — la duplicación es deliberada y acotada: Nest necesita
 * clases para generar Swagger, y validar dos veces con reglas escritas a partir del
 * mismo contrato es más seguro que confiar en una sola capa. El test
 * `dto-schema-parity.spec.ts` comprueba que los campos obligatorios coinciden.
 */

const nonEmpty = (min: number, max: number, label: string) =>
  z
    .string({ required_error: `${label} es obligatorio` })
    .trim()
    .min(min, `${label} debe tener al menos ${min} caracteres`)
    .max(max, `${label} no puede superar ${max} caracteres`);

export const emailSchema = z
  .string({ required_error: 'El correo es obligatorio' })
  .trim()
  .toLowerCase()
  .email('Correo electrónico inválido')
  .max(180);

export const passwordSchema = z
  .string({ required_error: 'La contraseña es obligatoria' })
  .min(10, 'La contraseña debe tener al menos 10 caracteres')
  .max(128, 'La contraseña no puede superar 128 caracteres')
  .regex(/[A-Za-z]/, 'La contraseña debe incluir al menos una letra')
  .regex(/[0-9]/, 'La contraseña debe incluir al menos un número');

// ----------------------------------------------------------------------- Auth --

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'La contraseña es obligatoria').max(128),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const refreshSchema = z.object({
  refreshToken: z.string().min(20, 'Refresh token inválido'),
});
export type RefreshInput = z.infer<typeof refreshSchema>;

// -------------------------------------------------------------------- Empresa --

export const companyCreateSchema = z.object({
  name: nonEmpty(3, 180, 'La razón social'),
  taxId: z.string().trim().max(40).optional().or(z.literal('')),
  country: nonEmpty(2, 80, 'El país'),
  city: nonEmpty(2, 80, 'La ciudad'),
  sectorCode: z.string().trim().max(60).optional(),
  website: z.string().trim().url('URL inválida').max(200).optional().or(z.literal('')),
  linkToCompanyId: z.string().uuid().optional(),
  forceCreate: z.boolean().optional(),
});
export type CompanyCreateInput = z.infer<typeof companyCreateSchema>;

export const companyContactSchema = z.object({
  fullName: nonEmpty(3, 140, 'El nombre del contacto'),
  jobTitle: nonEmpty(2, 120, 'El cargo'),
  email: emailSchema,
  phone: nonEmpty(7, 40, 'El teléfono'),
  isPrimary: z.boolean().default(false),
});
export type CompanyContactInput = z.infer<typeof companyContactSchema>;

// ------------------------------------------------------ Onboarding T1 (intake) --

/** Bloque 1 — identificación básica de la empresa. */
export const intakeBlock1Schema = z.object({
  companyName: nonEmpty(3, 180, 'El nombre de la empresa'),
  taxId: z.string().trim().max(40).optional().or(z.literal('')),
  contactFullName: nonEmpty(3, 140, 'El nombre del contacto'),
  contactJobTitle: nonEmpty(2, 120, 'El cargo'),
  contactEmail: emailSchema,
  contactPhone: nonEmpty(7, 40, 'El teléfono / WhatsApp'),
  country: nonEmpty(2, 80, 'El país'),
  city: nonEmpty(2, 80, 'La ciudad'),
  acceptedTerms: z.literal(true, {
    errorMap: () => ({ message: 'Debe aceptar los términos y la política de tratamiento de datos' }),
  }),
});
export type IntakeBlock1Input = z.infer<typeof intakeBlock1Schema>;

/** Bloque 2 — plantilla T1, registro de la necesidad empresarial. */
export const intakeBlock2Schema = z.object({
  title: nonEmpty(10, 180, 'El título del caso'),
  description: nonEmpty(40, 5000, 'La descripción del problema'),
  areaCode: nonEmpty(2, 60, 'El área del negocio'),
  urgencyCode: nonEmpty(2, 60, 'El nivel de urgencia'),
  impactCode: nonEmpty(2, 60, 'El impacto estimado'),
});
export type IntakeBlock2Input = z.infer<typeof intakeBlock2Schema>;

export const intakeSchema = intakeBlock1Schema.merge(intakeBlock2Schema).extend({
  linkToCompanyId: z.string().uuid().optional(),
});
export type IntakeInput = z.infer<typeof intakeSchema>;

// ----------------------------------------------------------------------- Caso --

export const caseUpdateSchema = z.object({
  title: nonEmpty(10, 180, 'El título del caso').optional(),
  description: nonEmpty(40, 5000, 'La descripción').optional(),
  areaCode: z.string().trim().min(2).max(60).optional(),
  urgencyCode: z.string().trim().min(2).max(60).optional(),
  impactCode: z.string().trim().min(2).max(60).optional(),
});
export type CaseUpdateInput = z.infer<typeof caseUpdateSchema>;

/** T2 — evaluación, clasificación y habilitación. */
export const classificationSchema = z.object({
  areaCode: nonEmpty(2, 60, 'El área'),
  subAreaCode: z.string().trim().max(60).optional(),
  interventionTypeCode: nonEmpty(2, 60, 'El tipo de intervención'),
  complexityCode: nonEmpty(2, 60, 'La complejidad'),
  impactCode: nonEmpty(2, 60, 'El impacto'),
  urgencyCode: nonEmpty(2, 60, 'La urgencia'),
  eligibility: z.enum(['ELEGIBLE', 'NO_ELEGIBLE', 'INFORMACION_INSUFICIENTE'], {
    required_error: 'Debe registrar el resultado de elegibilidad',
  }),
  reviewNotes: nonEmpty(20, 4000, 'Las observaciones de revisión'),
  clarityScore: z.coerce.number().int().min(1).max(5).optional(),
  completenessScore: z.coerce.number().int().min(1).max(5).optional(),
});
export type ClassificationInput = z.infer<typeof classificationSchema>;

export const transitionSchema = z.object({
  transition: z.nativeEnum(TransitionCode, { required_error: 'Transición requerida' }),
  note: z.string().trim().max(2000).optional(),
  payload: z.record(z.unknown()).optional(),
});
export type TransitionInput = z.infer<typeof transitionSchema>;

// -------------------------------------------------------- Postulación T3C/T3D --

export const applicationSchema = z.object({
  interestStatement: nonEmpty(40, 2000, 'La manifestación de interés'),
  availability: nonEmpty(10, 500, 'La disponibilidad'),
  relevantExperience: nonEmpty(40, 3000, 'La experiencia relevante'),
  fitJustification: nonEmpty(40, 2000, 'La justificación de pertinencia'),
  preliminaryApproach: nonEmpty(40, 3000, 'El enfoque preliminar'),
  acceptsConditions: z.literal(true, {
    errorMap: () => ({ message: 'Debe aceptar las condiciones metodológicas de la plataforma' }),
  }),
});
export type ApplicationInput = z.infer<typeof applicationSchema>;

export const applicationEvaluationSchema = z.object({
  specialtyFit: z.coerce.number().int().min(1).max(5),
  experienceFit: z.coerce.number().int().min(1).max(5),
  levelFit: z.coerce.number().int().min(1).max(5),
  availabilityFit: z.coerce.number().int().min(1).max(5),
  trackRecordFit: z.coerce.number().int().min(1).max(5),
  notes: nonEmpty(20, 2000, 'La justificación de la evaluación'),
});
export type ApplicationEvaluationInput = z.infer<typeof applicationEvaluationSchema>;

export const assignConsultantSchema = z.object({
  applicationId: z.string().uuid('Postulación inválida'),
  evaluations: z.array(applicationEvaluationSchema.extend({ applicationId: z.string().uuid() })),
  decisionRationale: nonEmpty(20, 2000, 'La justificación de la decisión'),
});
export type AssignConsultantInput = z.infer<typeof assignConsultantSchema>;

// ------------------------------------------------------------ Propuesta TP4B/C --

/** TP4B — análisis estructurado del caso. */
export const proposalAnalysisSchema = z.object({
  problemSynthesis: nonEmpty(40, 4000, 'La síntesis del problema'),
  workingHypothesis: nonEmpty(20, 3000, 'La hipótesis de trabajo'),
  criticalFactors: nonEmpty(20, 3000, 'Los factores críticos'),
  risks: nonEmpty(20, 3000, 'Los riesgos identificados'),
  assumptions: nonEmpty(20, 3000, 'Los supuestos iniciales'),
  constraints: nonEmpty(10, 3000, 'Las restricciones visibles'),
  additionalNeeds: z.string().trim().max(3000).optional(),
});
export type ProposalAnalysisInput = z.infer<typeof proposalAnalysisSchema>;

/** TP4C — bloques A–J de la propuesta estructurada de solución. */
export const proposalContentSchema = z.object({
  executiveSummary: nonEmpty(60, 4000, 'El resumen ejecutivo'),
  objective: nonEmpty(30, 2000, 'El objetivo de la intervención'),
  scope: nonEmpty(40, 4000, 'El alcance'),
  exclusions: nonEmpty(20, 3000, 'Las exclusiones'),
  activities: nonEmpty(40, 6000, 'Las actividades'),
  deliverables: nonEmpty(30, 4000, 'Los entregables esperados'),
  schedule: nonEmpty(20, 4000, 'El cronograma preliminar'),
  valuation: nonEmpty(10, 3000, 'La valoración inicial'),
  conditions: nonEmpty(20, 3000, 'Las condiciones y supuestos'),
  leadConsultantNote: z.string().trim().max(1000).optional(),
});
export type ProposalContentInput = z.infer<typeof proposalContentSchema>;

export const proposalVersionUpdateSchema = z.object({
  analysis: proposalAnalysisSchema.partial().optional(),
  content: proposalContentSchema.partial().optional(),
  changeNote: z.string().trim().max(1000).optional(),
});
export type ProposalVersionUpdateInput = z.infer<typeof proposalVersionUpdateSchema>;

/** TP4H — checklist de revisión metodológica (el "Go"). */
export const proposalReviewSchema = z.object({
  type: z.nativeEnum(ReviewType).default(ReviewType.METODOLOGICA),
  outcome: z.nativeEnum(ReviewOutcome, { required_error: 'Resultado requerido' }),
  checklist: z.object({
    completeness: z.boolean(),
    templateUsage: z.boolean(),
    traceability: z.boolean(),
    problemScopeCoherence: z.boolean(),
    clientReadability: z.boolean(),
    scheduleAndValuation: z.boolean(),
    exclusionsAndAssumptions: z.boolean(),
  }),
  observations: z.string().trim().max(6000).optional(),
});
export type ProposalReviewInput = z.infer<typeof proposalReviewSchema>;

// ------------------------------------------------------------ Decisión cliente --

export const clientDecisionSchema = z
  .object({
    decision: z.nativeEnum(ClientDecisionType, { required_error: 'Decisión requerida' }),
    comments: z.string().trim().max(4000).optional(),
    adjustmentDetails: z.string().trim().max(4000).optional(),
    declineReasonCode: z.string().trim().max(60).optional(),
    reactivationPotential: z.enum(['ALTO', 'MEDIO', 'BAJO', 'NINGUNO']).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.decision === ClientDecisionType.SOLICITAR_AJUSTES) {
      if (!value.adjustmentDetails || value.adjustmentDetails.trim().length < 30) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['adjustmentDetails'],
          message: 'Describa los ajustes solicitados (mínimo 30 caracteres)',
        });
      }
    }
    if (value.decision === ClientDecisionType.NO_CONTINUAR && !value.declineReasonCode) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['declineReasonCode'],
        message: 'Seleccione el motivo de no continuidad',
      });
    }
  });
export type ClientDecisionInput = z.infer<typeof clientDecisionSchema>;

// ------------------------------------------------------------- Contratación T7 --

export const checklistItemUpdateSchema = z.object({
  status: z.enum(['PENDIENTE', 'EN_PROCESO', 'CUMPLIDO', 'NO_APLICA']),
  responsible: z.string().trim().max(140).optional(),
  targetDate: z.coerce.date().optional(),
  completedDate: z.coerce.date().optional(),
  notes: z.string().trim().max(2000).optional(),
});
export type ChecklistItemUpdateInput = z.infer<typeof checklistItemUpdateSchema>;

/** T7B — marco operativo del servicio formalizado. */
export const operationalFrameworkSchema = z.object({
  operatingConditions: nonEmpty(40, 5000, 'Las condiciones operativas'),
  estimatedDurationDays: z.coerce.number().int().min(1).max(3650),
  baselineSchedule: nonEmpty(20, 5000, 'El cronograma base'),
  committedDeliverables: nonEmpty(20, 5000, 'Los entregables comprometidos'),
  clientDependencies: nonEmpty(10, 4000, 'Las dependencias del cliente'),
  assumptions: nonEmpty(10, 4000, 'Los supuestos relevantes'),
  executionConstraints: z.string().trim().max(4000).optional(),
  primaryContact: nonEmpty(3, 140, 'El punto de contacto principal'),
});
export type OperationalFrameworkInput = z.infer<typeof operationalFrameworkSchema>;

// ----------------------------------------------------------------- Ejecución T8 --

export const activitySchema = z.object({
  name: nonEmpty(5, 180, 'El nombre de la actividad'),
  description: z.string().trim().max(3000).optional(),
  responsible: nonEmpty(3, 140, 'El responsable'),
  targetDate: z.coerce.date({ required_error: 'La fecha objetivo es obligatoria' }),
  status: z.nativeEnum(ActivityStatus).default(ActivityStatus.NO_INICIADA),
  notes: z.string().trim().max(2000).optional(),
});
export type ActivityInput = z.infer<typeof activitySchema>;

export const milestoneSchema = z.object({
  name: nonEmpty(5, 180, 'El nombre del hito'),
  description: z.string().trim().max(3000).optional(),
  responsible: nonEmpty(3, 140, 'El responsable'),
  targetDate: z.coerce.date({ required_error: 'La fecha objetivo es obligatoria' }),
  criticality: z.nativeEnum(ImpactLevel).default(ImpactLevel.MEDIO),
  expectedResult: z.string().trim().max(2000).optional(),
  status: z.nativeEnum(MilestoneStatus).default(MilestoneStatus.PENDIENTE),
});
export type MilestoneInput = z.infer<typeof milestoneSchema>;

export const incidentSchema = z.object({
  typeCode: nonEmpty(2, 60, 'El tipo de incidencia'),
  title: nonEmpty(5, 180, 'El título'),
  description: nonEmpty(20, 4000, 'La descripción'),
  impact: z.nativeEnum(ImpactLevel, { required_error: 'El impacto es obligatorio' }),
  suggestedAction: nonEmpty(10, 2000, 'La acción sugerida'),
  status: z.nativeEnum(IncidentStatus).default(IncidentStatus.ABIERTA),
  decision: z.string().trim().max(2000).optional(),
});
export type IncidentInput = z.infer<typeof incidentSchema>;

export const deliverableSchema = z.object({
  name: nonEmpty(5, 180, 'El nombre del entregable'),
  description: z.string().trim().max(3000).optional(),
  typeCode: z.string().trim().max(60).optional(),
  responsible: nonEmpty(3, 140, 'El responsable'),
  targetDate: z.coerce.date({ required_error: 'La fecha objetivo es obligatoria' }),
  status: z.nativeEnum(DeliverableStatus).default(DeliverableStatus.PENDIENTE),
  notes: z.string().trim().max(2000).optional(),
});
export type DeliverableInput = z.infer<typeof deliverableSchema>;

export const meetingSchema = z.object({
  title: nonEmpty(5, 180, 'El título de la reunión'),
  type: z.enum(['PRESENTACION_PROPUESTA', 'SEGUIMIENTO', 'CIERRE', 'OTRA']),
  heldAt: z.coerce.date({ required_error: 'La fecha de la reunión es obligatoria' }),
  durationMinutes: z.coerce.number().int().min(5).max(600),
  participants: nonEmpty(5, 2000, 'Los participantes'),
  topics: nonEmpty(10, 4000, 'Los temas tratados'),
  conclusions: nonEmpty(10, 4000, 'Las conclusiones'),
  commitments: z.string().trim().max(4000).optional(),
});
export type MeetingInput = z.infer<typeof meetingSchema>;

export const communicationSchema = z.object({
  type: z.enum([
    'SOLICITUD_ACLARACION',
    'SOLICITUD_INFORMACION',
    'RESPUESTA',
    'ACUERDO_OPERATIVO',
    'OBSERVACION',
  ]),
  stage: z.nativeEnum(DocumentStage),
  subject: nonEmpty(5, 180, 'El asunto'),
  body: nonEmpty(10, 6000, 'El contenido'),
  audience: z.enum(['CLIENTE', 'CONSULTOR', 'ADVISORY', 'INTERNO']),
});
export type CommunicationInput = z.infer<typeof communicationSchema>;

// -------------------------------------------------------------------- Cierre T9 --

export const closureDeclarationSchema = z.object({
  statement: nonEmpty(40, 4000, 'La declaración de cierre técnico'),
  finalNotes: z.string().trim().max(4000).optional(),
});
export type ClosureDeclarationInput = z.infer<typeof closureDeclarationSchema>;

export const customerClosureResponseSchema = z
  .object({
    response: z.enum(['ACEPTACION', 'CIERRE_CON_OBSERVACIONES', 'SOLICITUD_AJUSTE_FINAL']),
    observations: z.string().trim().max(4000).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.response !== 'ACEPTACION' && (value.observations ?? '').trim().length < 20) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['observations'],
        message: 'Registre las observaciones (mínimo 20 caracteres)',
      });
    }
  });
export type CustomerClosureResponseInput = z.infer<typeof customerClosureResponseSchema>;

/** T9G — encuesta de satisfacción. */
export const customerEvaluationSchema = z.object({
  overallSatisfaction: z.coerce.number().int().min(1).max(5),
  serviceClarity: z.coerce.number().int().min(1).max(5),
  expectationFulfilment: z.coerce.number().int().min(1).max(5),
  perceivedValue: z.coerce.number().int().min(1).max(5),
  wouldReuse: z.boolean(),
  comments: z.string().trim().max(3000).optional(),
});
export type CustomerEvaluationInput = z.infer<typeof customerEvaluationSchema>;

/** T9H — evaluación de desempeño del consultor. */
export const consultantEvaluationSchema = z.object({
  scopeCompliance: z.coerce.number().int().min(1).max(5),
  timeCompliance: z.coerce.number().int().min(1).max(5),
  documentationOrder: z.coerce.number().int().min(1).max(5),
  processConsistency: z.coerce.number().int().min(1).max(5),
  qaOutcome: z.coerce.number().int().min(1).max(5),
  comments: z.string().trim().max(3000).optional(),
});
export type ConsultantEvaluationInput = z.infer<typeof consultantEvaluationSchema>;

// ------------------------------------------------------------------ Consultores --

export const consultantCreateSchema = z.object({
  fullName: nonEmpty(3, 140, 'El nombre completo'),
  email: emailSchema,
  identityDocument: nonEmpty(5, 40, 'El documento de identidad'),
  phone: nonEmpty(7, 40, 'El celular / WhatsApp'),
  country: nonEmpty(2, 80, 'El país'),
  city: nonEmpty(2, 80, 'La ciudad'),
  professionalProfile: nonEmpty(40, 4000, 'El perfil profesional'),
  yearsOfExperience: z.coerce.number().int().min(0).max(70),
  engagementMode: z.enum(['INDEPENDIENTE', 'SPONSOR', 'PROPIO']),
  sponsorId: z.string().uuid().optional(),
  availability: nonEmpty(5, 500, 'La disponibilidad'),
  certifications: z.string().trim().max(3000).optional(),
});
export type ConsultantCreateInput = z.infer<typeof consultantCreateSchema>;

/** TC3 — clasificación y habilitación del consultor. */
export const consultantClassificationSchema = z.object({
  experienceLevelCode: nonEmpty(2, 60, 'El nivel de experiencia'),
  maxComplexityCode: nonEmpty(2, 60, 'La complejidad máxima habilitada'),
  tier: z.enum(['VALIDADO', 'HABILITADO', 'PREMIUM', 'ESTRATEGICO']),
  specialties: z
    .array(
      z.object({
        specialtyCode: z.string().trim().min(2).max(60),
        subSpecialtyCode: z.string().trim().max(60).optional(),
        yearsOfExperience: z.coerce.number().int().min(0).max(70),
        isPrimary: z.boolean().default(false),
      }),
    )
    .min(1, 'Registre al menos una especialidad'),
  interventionTypeCodes: z.array(z.string().trim().min(2).max(60)).min(1),
  sectorCodes: z.array(z.string().trim().min(2).max(60)).default([]),
  canBeLeadConsultant: z.boolean().default(true),
  canBeReviewer: z.boolean().default(false),
  notes: z.string().trim().max(3000).optional(),
});
export type ConsultantClassificationInput = z.infer<typeof consultantClassificationSchema>;

export const consultantStatusChangeSchema = z.object({
  status: z.enum([
    'REGISTRADO',
    'EN_VALIDACION',
    'HABILITADO',
    'CONDICIONADO',
    'SUSPENDIDO',
    'INACTIVO',
  ]),
  reason: nonEmpty(10, 2000, 'El motivo'),
});
export type ConsultantStatusChangeInput = z.infer<typeof consultantStatusChangeSchema>;

// --------------------------------------------------------------------- Lookups --

export const lookupValueSchema = z.object({
  code: z
    .string()
    .trim()
    .min(2)
    .max(60)
    .regex(/^[A-Z0-9_]+$/, 'El código debe ser MAYÚSCULAS_CON_GUION_BAJO'),
  label: nonEmpty(2, 140, 'La etiqueta'),
  description: z.string().trim().max(500).optional(),
  sortOrder: z.coerce.number().int().min(0).max(9999).default(0),
  isActive: z.boolean().default(true),
  metadata: z.record(z.unknown()).optional(),
});
export type LookupValueInput = z.infer<typeof lookupValueSchema>;

// ------------------------------------------------------------------------- SLA --

export const slaRuleSchema = z.object({
  code: z
    .string()
    .trim()
    .min(3)
    .max(80)
    .regex(/^[A-Z0-9_]+$/, 'El código debe ser MAYÚSCULAS_CON_GUION_BAJO'),
  name: nonEmpty(5, 180, 'El nombre'),
  stage: z.string().trim().min(2).max(60),
  durationHours: z.coerce.number().int().min(1).max(8760),
  warningThresholdPercent: z.coerce.number().int().min(1).max(99).default(75),
  escalationAfterHours: z.coerce.number().int().min(0).max(8760).optional(),
  complexityCode: z.string().trim().max(60).optional(),
  interventionTypeCode: z.string().trim().max(60).optional(),
  consultantLevelCode: z.string().trim().max(60).optional(),
  clientSegmentCode: z.string().trim().max(60).optional(),
  priorityCode: z.string().trim().max(60).optional(),
  isActive: z.boolean().default(true),
});
export type SlaRuleInput = z.infer<typeof slaRuleSchema>;

// -------------------------------------------------------------- Query / listado --

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.string().trim().max(60).optional(),
  sortDir: z.enum(['asc', 'desc']).default('desc'),
});
export type PaginationInput = z.infer<typeof paginationSchema>;

export const caseListQuerySchema = paginationSchema.extend({
  search: z.string().trim().max(120).optional(),
  status: z.string().trim().max(60).optional(),
  companyId: z.string().uuid().optional(),
  areaCode: z.string().trim().max(60).optional(),
  complexityCode: z.string().trim().max(60).optional(),
  slaStatus: z.string().trim().max(30).optional(),
  assignedConsultantId: z.string().uuid().optional(),
  createdFrom: z.coerce.date().optional(),
  createdTo: z.coerce.date().optional(),
});
export type CaseListQuery = z.infer<typeof caseListQuerySchema>;

export const auditQuerySchema = paginationSchema.extend({
  caseId: z.string().uuid().optional(),
  companyId: z.string().uuid().optional(),
  actorId: z.string().uuid().optional(),
  action: z.string().trim().max(80).optional(),
  entity: z.string().trim().max(80).optional(),
  origin: z.enum(['USER', 'SYSTEM']).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});
export type AuditQuery = z.infer<typeof auditQuerySchema>;

export const opportunityQuerySchema = paginationSchema.extend({
  search: z.string().trim().max(120).optional(),
  areaCode: z.string().trim().max(60).optional(),
  complexityCode: z.string().trim().max(60).optional(),
  interventionTypeCode: z.string().trim().max(60).optional(),
  sectorCode: z.string().trim().max(60).optional(),
});
export type OpportunityQuery = z.infer<typeof opportunityQuerySchema>;
