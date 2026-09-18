/**
 * Enums del dominio NODUS.
 *
 * Fuente única de verdad compartida por API y Web. Los valores coinciden
 * carácter a carácter con los enums de Prisma (`apps/api/prisma/schema.prisma`);
 * el test `packages-types-parity.spec.ts` de la API lo verifica en CI, de modo
 * que una divergencia rompe el build y no la demo.
 */

// ---------------------------------------------------------------------- RBAC --

export const Role = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  ADVISORY: 'ADVISORY',
  CONSULTOR: 'CONSULTOR',
  CONSULTOR_REVISOR: 'CONSULTOR_REVISOR',
  CLIENTE_MIPYME: 'CLIENTE_MIPYME',
} as const;
export type Role = (typeof Role)[keyof typeof Role];
export const ALL_ROLES = Object.values(Role);

export const ROLE_LABEL: Record<Role, string> = {
  SUPER_ADMIN: 'Super administrador',
  ADVISORY: 'Advisory / PMO',
  CONSULTOR: 'Consultor',
  CONSULTOR_REVISOR: 'Consultor revisor',
  CLIENTE_MIPYME: 'Cliente Mipyme',
};

export const Permission = {
  // Empresas
  COMPANY_CREATE: 'COMPANY_CREATE',
  COMPANY_READ: 'COMPANY_READ',
  COMPANY_UPDATE: 'COMPANY_UPDATE',
  // Casos
  CASE_CREATE: 'CASE_CREATE',
  CASE_READ: 'CASE_READ',
  CASE_UPDATE: 'CASE_UPDATE',
  CASE_CLASSIFY: 'CASE_CLASSIFY',
  CASE_PUBLISH: 'CASE_PUBLISH',
  CASE_ASSIGN: 'CASE_ASSIGN',
  CASE_EXECUTE: 'CASE_EXECUTE',
  CASE_CLOSE: 'CASE_CLOSE',
  CASE_DECIDE: 'CASE_DECIDE',
  // Consultores
  CONSULTANT_READ: 'CONSULTANT_READ',
  CONSULTANT_MANAGE: 'CONSULTANT_MANAGE',
  CONSULTANT_SELF: 'CONSULTANT_SELF',
  // Postulaciones
  APPLICATION_CREATE: 'APPLICATION_CREATE',
  APPLICATION_READ: 'APPLICATION_READ',
  APPLICATION_EVALUATE: 'APPLICATION_EVALUATE',
  // Propuestas
  PROPOSAL_CREATE: 'PROPOSAL_CREATE',
  PROPOSAL_READ: 'PROPOSAL_READ',
  PROPOSAL_REVIEW: 'PROPOSAL_REVIEW',
  PROPOSAL_APPROVE: 'PROPOSAL_APPROVE',
  // Contratación
  CONTRACT_MANAGE: 'CONTRACT_MANAGE',
  // Documentos
  DOCUMENT_READ: 'DOCUMENT_READ',
  DOCUMENT_UPLOAD: 'DOCUMENT_UPLOAD',
  // Transversales
  AUDIT_READ: 'AUDIT_READ',
  SLA_MANAGE: 'SLA_MANAGE',
  LOOKUP_MANAGE: 'LOOKUP_MANAGE',
  LOOKUP_READ: 'LOOKUP_READ',
  NOTIFICATION_READ: 'NOTIFICATION_READ',
  DASHBOARD_READ: 'DASHBOARD_READ',
  USER_MANAGE: 'USER_MANAGE',
} as const;
export type Permission = (typeof Permission)[keyof typeof Permission];
export const ALL_PERMISSIONS = Object.values(Permission);

// ------------------------------------------------------------ Ciclo del caso --

export const CaseStatusCode = {
  CREADO: 'CREADO',
  EN_REVISION: 'EN_REVISION',
  CLASIFICADO: 'CLASIFICADO',
  EN_POSTULACION: 'EN_POSTULACION',
  ASIGNADO: 'ASIGNADO',
  PROPUESTA_EN_DISENO: 'PROPUESTA_EN_DISENO',
  PROPUESTA_LISTA_PARA_QA: 'PROPUESTA_LISTA_PARA_QA',
  PROPUESTA_ENVIADA: 'PROPUESTA_ENVIADA',
  EN_DECISION_CLIENTE: 'EN_DECISION_CLIENTE',
  AJUSTES_DE_PROPUESTA: 'AJUSTES_DE_PROPUESTA',
  PROPUESTA_ACEPTADA: 'PROPUESTA_ACEPTADA',
  PENDIENTE_CONTRATACION: 'PENDIENTE_CONTRATACION',
  AUTORIZADO_PARA_EJECUCION: 'AUTORIZADO_PARA_EJECUCION',
  EN_EJECUCION: 'EN_EJECUCION',
  LISTO_PARA_CIERRE: 'LISTO_PARA_CIERRE',
  CERRADO: 'CERRADO',
  CERRADO_SIN_CONTRATACION: 'CERRADO_SIN_CONTRATACION',
} as const;
export type CaseStatusCode = (typeof CaseStatusCode)[keyof typeof CaseStatusCode];
export const ALL_CASE_STATUSES = Object.values(CaseStatusCode);

export const CASE_STATUS_LABEL: Record<CaseStatusCode, string> = {
  CREADO: 'Creado',
  EN_REVISION: 'En revisión',
  CLASIFICADO: 'Clasificado',
  EN_POSTULACION: 'En postulación',
  ASIGNADO: 'Asignado',
  PROPUESTA_EN_DISENO: 'Propuesta en diseño',
  PROPUESTA_LISTA_PARA_QA: 'Propuesta lista para QA',
  PROPUESTA_ENVIADA: 'Propuesta enviada',
  EN_DECISION_CLIENTE: 'En decisión del cliente',
  AJUSTES_DE_PROPUESTA: 'Ajustes de propuesta',
  PROPUESTA_ACEPTADA: 'Propuesta aceptada',
  PENDIENTE_CONTRATACION: 'Pendiente de contratación',
  AUTORIZADO_PARA_EJECUCION: 'Autorizado para ejecución',
  EN_EJECUCION: 'En ejecución',
  LISTO_PARA_CIERRE: 'Listo para cierre',
  CERRADO: 'Cerrado',
  CERRADO_SIN_CONTRATACION: 'Cerrado sin contratación',
};

/** Orden canónico para barras de progreso y ordenación en tableros. */
export const CASE_STATUS_ORDER: Record<CaseStatusCode, number> = {
  CREADO: 10,
  EN_REVISION: 20,
  CLASIFICADO: 30,
  EN_POSTULACION: 40,
  ASIGNADO: 50,
  PROPUESTA_EN_DISENO: 60,
  PROPUESTA_LISTA_PARA_QA: 70,
  PROPUESTA_ENVIADA: 80,
  EN_DECISION_CLIENTE: 90,
  AJUSTES_DE_PROPUESTA: 85,
  PROPUESTA_ACEPTADA: 100,
  PENDIENTE_CONTRATACION: 110,
  AUTORIZADO_PARA_EJECUCION: 120,
  EN_EJECUCION: 130,
  LISTO_PARA_CIERRE: 140,
  CERRADO: 150,
  CERRADO_SIN_CONTRATACION: 999,
};

export const TERMINAL_CASE_STATUSES: readonly CaseStatusCode[] = [
  CaseStatusCode.CERRADO,
  CaseStatusCode.CERRADO_SIN_CONTRATACION,
];

export const TransitionCode = {
  START_REVIEW: 'START_REVIEW',
  REQUEST_INFO: 'REQUEST_INFO',
  CLASSIFY: 'CLASSIFY',
  REJECT_INELIGIBLE: 'REJECT_INELIGIBLE',
  PUBLISH: 'PUBLISH',
  ASSIGN_CONSULTANT: 'ASSIGN_CONSULTANT',
  OPEN_PROPOSAL: 'OPEN_PROPOSAL',
  SUBMIT_FOR_QA: 'SUBMIT_FOR_QA',
  REQUEST_PROPOSAL_CHANGES: 'REQUEST_PROPOSAL_CHANGES',
  APPROVE_AND_SEND: 'APPROVE_AND_SEND',
  OPEN_CLIENT_DECISION: 'OPEN_CLIENT_DECISION',
  CLIENT_REQUEST_ADJUSTMENTS: 'CLIENT_REQUEST_ADJUSTMENTS',
  SUBMIT_ADJUSTED: 'SUBMIT_ADJUSTED',
  CLIENT_ACCEPT: 'CLIENT_ACCEPT',
  CLIENT_DECLINE: 'CLIENT_DECLINE',
  START_CONTRACTING: 'START_CONTRACTING',
  AUTHORIZE_EXECUTION: 'AUTHORIZE_EXECUTION',
  START_EXECUTION: 'START_EXECUTION',
  TECHNICAL_CLOSURE: 'TECHNICAL_CLOSURE',
  REOPEN_EXECUTION: 'REOPEN_EXECUTION',
  CLOSE_CASE: 'CLOSE_CASE',
} as const;
export type TransitionCode = (typeof TransitionCode)[keyof typeof TransitionCode];

// ------------------------------------------------------------------ Consultor --

export const ConsultantStatus = {
  REGISTRADO: 'REGISTRADO',
  EN_VALIDACION: 'EN_VALIDACION',
  HABILITADO: 'HABILITADO',
  CONDICIONADO: 'CONDICIONADO',
  SUSPENDIDO: 'SUSPENDIDO',
  INACTIVO: 'INACTIVO',
} as const;
export type ConsultantStatus = (typeof ConsultantStatus)[keyof typeof ConsultantStatus];

export const CONSULTANT_STATUS_LABEL: Record<ConsultantStatus, string> = {
  REGISTRADO: 'Registrado',
  EN_VALIDACION: 'En validación',
  HABILITADO: 'Habilitado',
  CONDICIONADO: 'Condicionado',
  SUSPENDIDO: 'Suspendido',
  INACTIVO: 'Inactivo',
};

export const EngagementMode = {
  INDEPENDIENTE: 'INDEPENDIENTE',
  SPONSOR: 'SPONSOR',
  PROPIO: 'PROPIO',
} as const;
export type EngagementMode = (typeof EngagementMode)[keyof typeof EngagementMode];

export const ConsultantTier = {
  VALIDADO: 'VALIDADO',
  HABILITADO: 'HABILITADO',
  PREMIUM: 'PREMIUM',
  ESTRATEGICO: 'ESTRATEGICO',
} as const;
export type ConsultantTier = (typeof ConsultantTier)[keyof typeof ConsultantTier];

// --------------------------------------------------------------- Aplicaciones --

export const ApplicationStatus = {
  PRESENTADA: 'PRESENTADA',
  EN_EVALUACION: 'EN_EVALUACION',
  ACEPTADA: 'ACEPTADA',
  NO_SELECCIONADA: 'NO_SELECCIONADA',
  RETIRADA: 'RETIRADA',
} as const;
export type ApplicationStatus = (typeof ApplicationStatus)[keyof typeof ApplicationStatus];

// ----------------------------------------------------------------- Propuestas --

export const ProposalVersionStatus = {
  BORRADOR: 'BORRADOR',
  EN_QA: 'EN_QA',
  ENVIADA: 'ENVIADA',
  ACEPTADA: 'ACEPTADA',
  SUPERADA: 'SUPERADA',
  DESCARTADA: 'DESCARTADA',
} as const;
export type ProposalVersionStatus =
  (typeof ProposalVersionStatus)[keyof typeof ProposalVersionStatus];

export const ReviewType = {
  METODOLOGICA: 'METODOLOGICA',
  PEER: 'PEER',
} as const;
export type ReviewType = (typeof ReviewType)[keyof typeof ReviewType];

export const ReviewOutcome = {
  APROBADA: 'APROBADA',
  AJUSTES_SOLICITADOS: 'AJUSTES_SOLICITADOS',
  OBSERVACIONES: 'OBSERVACIONES',
} as const;
export type ReviewOutcome = (typeof ReviewOutcome)[keyof typeof ReviewOutcome];

export const ClientDecisionType = {
  ACEPTAR: 'ACEPTAR',
  SOLICITAR_AJUSTES: 'SOLICITAR_AJUSTES',
  NO_CONTINUAR: 'NO_CONTINUAR',
} as const;
export type ClientDecisionType = (typeof ClientDecisionType)[keyof typeof ClientDecisionType];

// ------------------------------------------------------------------ Ejecución --

export const ActivityStatus = {
  NO_INICIADA: 'NO_INICIADA',
  EN_CURSO: 'EN_CURSO',
  COMPLETADA: 'COMPLETADA',
  BLOQUEADA: 'BLOQUEADA',
  REPROGRAMADA: 'REPROGRAMADA',
} as const;
export type ActivityStatus = (typeof ActivityStatus)[keyof typeof ActivityStatus];

export const MilestoneStatus = {
  PENDIENTE: 'PENDIENTE',
  EN_CURSO: 'EN_CURSO',
  CUMPLIDO: 'CUMPLIDO',
  INCUMPLIDO: 'INCUMPLIDO',
  JUSTIFICADO: 'JUSTIFICADO',
  REPROGRAMADO: 'REPROGRAMADO',
} as const;
export type MilestoneStatus = (typeof MilestoneStatus)[keyof typeof MilestoneStatus];

export const IncidentStatus = {
  ABIERTA: 'ABIERTA',
  EN_ATENCION: 'EN_ATENCION',
  ESCALADA: 'ESCALADA',
  RESUELTA: 'RESUELTA',
  CERRADA: 'CERRADA',
} as const;
export type IncidentStatus = (typeof IncidentStatus)[keyof typeof IncidentStatus];

export const ImpactLevel = {
  BAJO: 'BAJO',
  MEDIO: 'MEDIO',
  ALTO: 'ALTO',
  CRITICO: 'CRITICO',
} as const;
export type ImpactLevel = (typeof ImpactLevel)[keyof typeof ImpactLevel];

export const DeliverableStatus = {
  PENDIENTE: 'PENDIENTE',
  EN_DESARROLLO: 'EN_DESARROLLO',
  CARGADO: 'CARGADO',
  EN_REVISION: 'EN_REVISION',
  AJUSTADO: 'AJUSTADO',
  LISTO_PARA_CIERRE: 'LISTO_PARA_CIERRE',
} as const;
export type DeliverableStatus = (typeof DeliverableStatus)[keyof typeof DeliverableStatus];

// ------------------------------------------------------------------ Documentos --

export const DocumentStage = {
  INTAKE: 'INTAKE',
  EVALUACION: 'EVALUACION',
  POSTULACION: 'POSTULACION',
  PROPUESTA: 'PROPUESTA',
  DECISION: 'DECISION',
  CONTRATACION: 'CONTRATACION',
  EJECUCION: 'EJECUCION',
  CIERRE: 'CIERRE',
} as const;
export type DocumentStage = (typeof DocumentStage)[keyof typeof DocumentStage];

export const DOCUMENT_STAGE_LABEL: Record<DocumentStage, string> = {
  INTAKE: 'Intake',
  EVALUACION: 'Evaluación y clasificación',
  POSTULACION: 'Postulación y asignación',
  PROPUESTA: 'Propuesta',
  DECISION: 'Decisión del cliente',
  CONTRATACION: 'Contratación',
  EJECUCION: 'Ejecución',
  CIERRE: 'Cierre',
};

// ------------------------------------------------------------------------ SLA --

export const SlaStatus = {
  ON_TRACK: 'ON_TRACK',
  AT_RISK: 'AT_RISK',
  OVERDUE: 'OVERDUE',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
} as const;
export type SlaStatus = (typeof SlaStatus)[keyof typeof SlaStatus];

export const SLA_STATUS_LABEL: Record<SlaStatus, string> = {
  ON_TRACK: 'En tiempo',
  AT_RISK: 'En riesgo',
  OVERDUE: 'Vencido',
  COMPLETED: 'Cumplido',
  CANCELLED: 'Cancelado',
};

export const SlaAlertKind = {
  PREVENTIVA: 'PREVENTIVA',
  VENCIMIENTO: 'VENCIMIENTO',
  ESCALAMIENTO: 'ESCALAMIENTO',
} as const;
export type SlaAlertKind = (typeof SlaAlertKind)[keyof typeof SlaAlertKind];

// ------------------------------------------------------------------ Auditoría --

export const AuditOrigin = {
  USER: 'USER',
  SYSTEM: 'SYSTEM',
} as const;
export type AuditOrigin = (typeof AuditOrigin)[keyof typeof AuditOrigin];

// -------------------------------------------------------------- Notificaciones --

export const NotificationChannel = {
  IN_APP: 'IN_APP',
  EMAIL: 'EMAIL',
} as const;
export type NotificationChannel = (typeof NotificationChannel)[keyof typeof NotificationChannel];

export const NotificationStatus = {
  PENDIENTE: 'PENDIENTE',
  ENVIADA: 'ENVIADA',
  FALLIDA: 'FALLIDA',
  LEIDA: 'LEIDA',
} as const;
export type NotificationStatus = (typeof NotificationStatus)[keyof typeof NotificationStatus];

/** Plantillas oficiales de comunicación TCOM1–TCOM12 (blueprint operativo). */
export const CommunicationTemplateCode = {
  TCOM1: 'TCOM1',
  TCOM2: 'TCOM2',
  TCOM3: 'TCOM3',
  TCOM4: 'TCOM4',
  TCOM5: 'TCOM5',
  TCOM6: 'TCOM6',
  TCOM7: 'TCOM7',
  TCOM8: 'TCOM8',
  TCOM9: 'TCOM9',
  TCOM10: 'TCOM10',
  TCOM11: 'TCOM11',
  TCOM12: 'TCOM12',
} as const;
export type CommunicationTemplateCode =
  (typeof CommunicationTemplateCode)[keyof typeof CommunicationTemplateCode];

// ---------------------------------------------------------- Eventos de dominio --

export const DomainEventName = {
  CaseCreated: 'CaseCreated',
  CaseReviewStarted: 'CaseReviewStarted',
  CaseInformationRequested: 'CaseInformationRequested',
  CaseClassified: 'CaseClassified',
  CasePublished: 'CasePublished',
  ApplicationSubmitted: 'ApplicationSubmitted',
  ConsultantAssigned: 'ConsultantAssigned',
  ProposalCreated: 'ProposalCreated',
  ProposalSubmitted: 'ProposalSubmitted',
  ProposalReviewed: 'ProposalReviewed',
  ProposalAdjustmentRequested: 'ProposalAdjustmentRequested',
  ProposalSent: 'ProposalSent',
  ClientDecisionWindowOpened: 'ClientDecisionWindowOpened',
  ClientDecisionReceived: 'ClientDecisionReceived',
  ContractingStarted: 'ContractingStarted',
  ExecutionAuthorized: 'ExecutionAuthorized',
  ExecutionStarted: 'ExecutionStarted',
  ExecutionReopened: 'ExecutionReopened',
  MilestoneAtRisk: 'MilestoneAtRisk',
  MilestoneOverdue: 'MilestoneOverdue',
  IncidentOpened: 'IncidentOpened',
  DeliverableUploaded: 'DeliverableUploaded',
  CaseReadyForClosure: 'CaseReadyForClosure',
  CaseClosed: 'CaseClosed',
  CaseClosedWithoutContracting: 'CaseClosedWithoutContracting',
  SlaAtRisk: 'SlaAtRisk',
  SlaOverdue: 'SlaOverdue',
  SlaEscalated: 'SlaEscalated',
} as const;
export type DomainEventName = (typeof DomainEventName)[keyof typeof DomainEventName];

// ------------------------------------------------------------------- Lookups --

/** Códigos de lista de valores gobernadas centralmente (RT-015..017). */
export const LookupListCode = {
  AREA_PROBLEMA: 'AREA_PROBLEMA',
  SUBAREA: 'SUBAREA',
  TIPO_INTERVENCION: 'TIPO_INTERVENCION',
  COMPLEJIDAD: 'COMPLEJIDAD',
  URGENCIA: 'URGENCIA',
  IMPACTO: 'IMPACTO',
  TIPO_ENTREGABLE: 'TIPO_ENTREGABLE',
  ESPECIALIDAD: 'ESPECIALIDAD',
  NIVEL_CONSULTOR: 'NIVEL_CONSULTOR',
  SECTOR: 'SECTOR',
  MODALIDAD_VINCULACION: 'MODALIDAD_VINCULACION',
  TIPO_INCIDENCIA: 'TIPO_INCIDENCIA',
  MOTIVO_CIERRE: 'MOTIVO_CIERRE',
  SEGMENTO_CLIENTE: 'SEGMENTO_CLIENTE',
} as const;
export type LookupListCode = (typeof LookupListCode)[keyof typeof LookupListCode];

/** Complejidad ordenada: se usa para comprobar el alcance habilitado del consultor. */
export const COMPLEXITY_RANK: Record<string, number> = {
  BAJO: 1,
  MEDIO: 2,
  ALTO: 3,
  ESTRATEGICO: 4,
};
