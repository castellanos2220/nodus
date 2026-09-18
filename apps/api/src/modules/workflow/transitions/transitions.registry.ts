import { CaseStatusCode, RoleCode } from '@prisma/client';
import type { TransitionDefinition } from '../workflow.types';

const ADV = [RoleCode.ADVISORY, RoleCode.SUPER_ADMIN];

/**
 * Registro de transiciones: la máquina de estados del caso, declarada como datos.
 *
 * Esta tabla es la **única** puerta por la que el estado de un caso puede
 * cambiar. Está deliberadamente escrita como datos y no como `if`s repartidos por
 * servicios: así se puede validar (hay un test que comprueba que todo estado no
 * terminal tiene salida y que todo estado es alcanzable), documentar y exponer a
 * la UI sin duplicar la regla.
 *
 * Especificación normativa: `docs/workflow/transitions.md`.
 */
export const TRANSITIONS: readonly TransitionDefinition[] = [
  // ------------------------------------------------- Punto 2: debida diligencia
  {
    code: 'START_REVIEW',
    label: 'Iniciar revisión',
    from: CaseStatusCode.CREADO,
    to: CaseStatusCode.EN_REVISION,
    roles: ADV,
    scope: 'ANY',
    guards: [],
    event: 'CaseReviewStarted',
    requiresPayload: false,
    description: 'Advisory inicia formalmente la debida diligencia del caso.',
  },
  {
    code: 'REQUEST_INFO',
    label: 'Solicitar información al cliente',
    from: CaseStatusCode.EN_REVISION,
    to: CaseStatusCode.EN_REVISION,
    roles: ADV,
    scope: 'ANY',
    guards: ['GUARD_NOTE_REQUIRED'],
    event: 'CaseInformationRequested',
    requiresPayload: true,
    description:
      'Registra una solicitud estructurada de ampliación (T3B). El caso permanece en revisión.',
  },
  {
    code: 'CLASSIFY',
    label: 'Clasificar y habilitar',
    from: CaseStatusCode.EN_REVISION,
    to: CaseStatusCode.CLASIFICADO,
    roles: ADV,
    scope: 'ANY',
    guards: ['GUARD_CLASSIFICATION_COMPLETE'],
    event: 'CaseClassified',
    requiresPayload: false,
    description: 'Confirma la clasificación T2 y habilita el caso para la bolsa interna.',
  },
  {
    code: 'REJECT_INELIGIBLE',
    label: 'Cerrar por no elegible',
    from: CaseStatusCode.EN_REVISION,
    to: CaseStatusCode.CERRADO_SIN_CONTRATACION,
    roles: ADV,
    scope: 'ANY',
    guards: ['GUARD_REASON_REQUIRED'],
    event: 'CaseClosedWithoutContracting',
    requiresPayload: true,
    description: 'El caso no es elegible para el modelo de atención de la plataforma.',
  },

  // ------------------------------------------ Punto 3: bolsa interna y asignación
  {
    code: 'PUBLISH',
    label: 'Publicar en bolsa interna',
    from: CaseStatusCode.CLASIFICADO,
    to: CaseStatusCode.EN_POSTULACION,
    roles: ADV,
    scope: 'ANY',
    guards: ['GUARD_CLASSIFICATION_COMPLETE'],
    event: 'CasePublished',
    requiresPayload: false,
    description:
      'Publica el caso para los consultores elegibles. La versión visible es controlada.',
  },
  {
    code: 'ASSIGN_CONSULTANT',
    label: 'Asignar consultor responsable',
    from: CaseStatusCode.EN_POSTULACION,
    to: CaseStatusCode.ASIGNADO,
    roles: ADV,
    scope: 'ANY',
    guards: [
      'GUARD_HAS_APPLICATIONS',
      'GUARD_APPLICATION_BELONGS_TO_CASE',
      'GUARD_CONSULTANT_ENABLED',
      'GUARD_CONSULTANT_COMPLEXITY_ALLOWED',
      'GUARD_NO_ACTIVE_PRIMARY_ASSIGNMENT',
    ],
    event: 'ConsultantAssigned',
    requiresPayload: true,
    description:
      'Designa un único consultor responsable principal y documenta la evaluación T3D.',
  },

  // ------------------------------------------------- Punto 4: diseño de propuesta
  {
    code: 'OPEN_PROPOSAL',
    label: 'Abrir expediente de propuesta',
    from: CaseStatusCode.ASIGNADO,
    to: CaseStatusCode.PROPUESTA_EN_DISENO,
    roles: [RoleCode.CONSULTOR, RoleCode.ADVISORY, RoleCode.SUPER_ADMIN],
    scope: 'ANY',
    guards: ['GUARD_HAS_PRIMARY_ASSIGNMENT'],
    event: 'ProposalCreated',
    requiresPayload: false,
    description: 'Crea la propuesta y su versión 1 en borrador (TP4B/TP4C).',
  },
  {
    code: 'SUBMIT_FOR_QA',
    label: 'Enviar a QA',
    from: CaseStatusCode.PROPUESTA_EN_DISENO,
    to: CaseStatusCode.PROPUESTA_LISTA_PARA_QA,
    roles: [RoleCode.CONSULTOR],
    scope: 'LEAD_CONSULTANT',
    guards: ['GUARD_PROPOSAL_CONTENT_COMPLETE'],
    event: 'ProposalSubmitted',
    requiresPayload: false,
    description: 'Congela la versión vigente y la somete a revisión metodológica.',
  },

  // ---------------------------------------------------------------- Punto 5: QA
  {
    code: 'REQUEST_PROPOSAL_CHANGES',
    label: 'Solicitar ajustes a la propuesta',
    from: CaseStatusCode.PROPUESTA_LISTA_PARA_QA,
    to: CaseStatusCode.PROPUESTA_EN_DISENO,
    roles: [RoleCode.ADVISORY, RoleCode.CONSULTOR_REVISOR, RoleCode.SUPER_ADMIN],
    scope: 'ANY',
    guards: ['GUARD_REVIEW_REQUESTED_CHANGES'],
    event: 'ProposalAdjustmentRequested',
    requiresPayload: false,
    description: 'Devuelve la propuesta al consultor creando la versión n+1 en borrador.',
  },
  {
    code: 'APPROVE_AND_SEND',
    label: 'Aprobar y enviar al cliente',
    from: CaseStatusCode.PROPUESTA_LISTA_PARA_QA,
    to: CaseStatusCode.PROPUESTA_ENVIADA,
    roles: ADV,
    scope: 'ANY',
    guards: ['GUARD_REVIEW_APPROVED'],
    event: 'ProposalSent',
    autoNext: 'OPEN_CLIENT_DECISION',
    requiresPayload: false,
    description: 'Autoriza el envío formal de la propuesta a la Mipyme.',
  },
  {
    code: 'OPEN_CLIENT_DECISION',
    label: 'Abrir período de decisión',
    from: CaseStatusCode.PROPUESTA_ENVIADA,
    to: CaseStatusCode.EN_DECISION_CLIENTE,
    roles: [],
    scope: 'SYSTEM',
    guards: [],
    event: 'ClientDecisionWindowOpened',
    requiresPayload: false,
    description:
      'Automática: al enviarse la propuesta se habilita la ventana formal de decisión.',
  },

  // ------------------------------------------------- Punto 6: decisión del cliente
  {
    code: 'CLIENT_REQUEST_ADJUSTMENTS',
    label: 'Solicitar ajustes',
    from: CaseStatusCode.EN_DECISION_CLIENTE,
    to: CaseStatusCode.AJUSTES_DE_PROPUESTA,
    roles: [RoleCode.CLIENTE_MIPYME],
    scope: 'CLIENT_OWNER',
    guards: ['GUARD_ADJUSTMENT_DETAILS_REQUIRED'],
    event: 'ClientDecisionReceived',
    requiresPayload: true,
    description: 'Registra TP6B y devuelve la propuesta al consultor con una versión nueva.',
  },
  {
    code: 'SUBMIT_ADJUSTED',
    label: 'Enviar propuesta ajustada',
    from: CaseStatusCode.AJUSTES_DE_PROPUESTA,
    to: CaseStatusCode.PROPUESTA_LISTA_PARA_QA,
    roles: [RoleCode.CONSULTOR],
    scope: 'LEAD_CONSULTANT',
    guards: ['GUARD_PROPOSAL_CONTENT_COMPLETE', 'GUARD_ADJUSTED_VERSION_IS_NEWER'],
    event: 'ProposalSubmitted',
    requiresPayload: false,
    description: 'Responde la solicitud de ajustes (TP6C) y vuelve a someter a QA.',
  },
  {
    code: 'CLIENT_ACCEPT',
    label: 'Aceptar propuesta',
    from: CaseStatusCode.EN_DECISION_CLIENTE,
    to: CaseStatusCode.PROPUESTA_ACEPTADA,
    roles: [RoleCode.CLIENTE_MIPYME],
    scope: 'CLIENT_OWNER',
    guards: ['GUARD_HAS_SENT_VERSION'],
    event: 'ClientDecisionReceived',
    autoNext: 'START_CONTRACTING',
    requiresPayload: false,
    description: 'Aceptación formal (TP6D). Encadena automáticamente a contratación.',
  },
  {
    code: 'CLIENT_DECLINE',
    label: 'No continuar',
    from: CaseStatusCode.EN_DECISION_CLIENTE,
    to: CaseStatusCode.CERRADO_SIN_CONTRATACION,
    roles: [RoleCode.CLIENTE_MIPYME],
    scope: 'CLIENT_OWNER',
    guards: ['GUARD_DECLINE_REASON_REQUIRED'],
    event: 'CaseClosedWithoutContracting',
    requiresPayload: true,
    description: 'Cierre comercial sin continuidad (TP6E), con motivo y potencial futuro.',
  },

  // --------------------------------------------------------- Punto 7: contratación
  {
    code: 'START_CONTRACTING',
    label: 'Iniciar contratación',
    from: CaseStatusCode.PROPUESTA_ACEPTADA,
    to: CaseStatusCode.PENDIENTE_CONTRATACION,
    roles: [],
    scope: 'SYSTEM',
    guards: [],
    event: 'ContractingStarted',
    requiresPayload: false,
    description: 'Automática: instancia el checklist T7A desde la plantilla vigente.',
  },
  {
    code: 'AUTHORIZE_EXECUTION',
    label: 'Autorizar ejecución',
    from: CaseStatusCode.PENDIENTE_CONTRATACION,
    to: CaseStatusCode.AUTORIZADO_PARA_EJECUCION,
    roles: ADV,
    scope: 'ANY',
    guards: ['GUARD_CONTRACT_CHECKLIST_COMPLETE', 'GUARD_OPERATIONAL_FRAMEWORK_UPLOADED'],
    event: 'ExecutionAuthorized',
    requiresPayload: false,
    description:
      'Veeduría: confirma checklist completo y marco operativo cargado. Sin esto no hay ejecución.',
  },

  // ------------------------------------------------------------ Punto 8: ejecución
  {
    code: 'START_EXECUTION',
    label: 'Iniciar ejecución',
    from: CaseStatusCode.AUTORIZADO_PARA_EJECUCION,
    to: CaseStatusCode.EN_EJECUCION,
    roles: [RoleCode.CONSULTOR, RoleCode.ADVISORY, RoleCode.SUPER_ADMIN],
    scope: 'ANY',
    guards: ['GUARD_AGENDA_ACTIVATED'],
    event: 'ExecutionStarted',
    requiresPayload: false,
    description: 'Activa la agenda operativa del caso (T8A) y arranca el seguimiento.',
  },
  {
    code: 'TECHNICAL_CLOSURE',
    label: 'Declarar cierre técnico',
    from: CaseStatusCode.EN_EJECUCION,
    to: CaseStatusCode.LISTO_PARA_CIERRE,
    roles: [RoleCode.CONSULTOR],
    scope: 'LEAD_CONSULTANT',
    guards: [
      'GUARD_DELIVERABLES_READY',
      'GUARD_MILESTONES_SETTLED',
      'GUARD_NO_CRITICAL_OPEN_INCIDENTS',
      'GUARD_CLOSURE_STATEMENT_REQUIRED',
    ],
    event: 'CaseReadyForClosure',
    requiresPayload: true,
    description: 'T9A: el consultor declara concluida su intervención.',
  },
  {
    code: 'REOPEN_EXECUTION',
    label: 'Reabrir ejecución',
    from: CaseStatusCode.LISTO_PARA_CIERRE,
    to: CaseStatusCode.EN_EJECUCION,
    roles: ADV,
    scope: 'ANY',
    guards: ['GUARD_REASON_REQUIRED'],
    event: 'ExecutionReopened',
    requiresPayload: true,
    description: 'La revisión final detectó pendientes: el caso vuelve a ejecución.',
  },

  // ---------------------------------------------------------------- Punto 9: cierre
  {
    code: 'CLOSE_CASE',
    label: 'Cerrar caso',
    from: CaseStatusCode.LISTO_PARA_CIERRE,
    to: CaseStatusCode.CERRADO,
    roles: ADV,
    scope: 'ANY',
    guards: [
      'GUARD_CLOSURE_CHECKLIST_COMPLETE',
      'GUARD_CLIENT_CLOSURE_RESPONSE',
      'GUARD_CUSTOMER_EVALUATION',
      'GUARD_CONSULTANT_EVALUATION',
    ],
    event: 'CaseClosed',
    requiresPayload: false,
    description: 'Cierre formal con expediente completo, aceptación del cliente y evaluaciones.',
  },
];

/** Índice por estado de origen: evita recorrer el array en cada petición. */
const BY_FROM = new Map<CaseStatusCode, TransitionDefinition[]>();
const BY_CODE = new Map<string, TransitionDefinition>();

for (const transition of TRANSITIONS) {
  const bucket = BY_FROM.get(transition.from) ?? [];
  bucket.push(transition);
  BY_FROM.set(transition.from, bucket);
  BY_CODE.set(transition.code, transition);
}

export function transitionsFrom(status: CaseStatusCode): readonly TransitionDefinition[] {
  return BY_FROM.get(status) ?? [];
}

export function findTransition(
  status: CaseStatusCode,
  code: string,
): TransitionDefinition | undefined {
  const transition = BY_CODE.get(code);
  return transition && transition.from === status ? transition : undefined;
}

export function getTransition(code: string): TransitionDefinition | undefined {
  return BY_CODE.get(code);
}

export const TERMINAL_STATUSES: readonly CaseStatusCode[] = [
  CaseStatusCode.CERRADO,
  CaseStatusCode.CERRADO_SIN_CONTRATACION,
];
