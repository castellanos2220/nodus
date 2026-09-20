import type { CaseStatusCode } from '@nodus/types';

/**
 * Etapas visuales del ciclo de vida del caso.
 *
 * Es **presentación**, no reglas: agrupa los 17 estados en 7 etapas para que la
 * interfaz pueda mostrar *dónde* está un caso sin pintar cada estado de un color.
 * La máquina de estados real —qué transición existe, quién puede ejecutarla y
 * con qué precondiciones— vive en el backend (`transitions.registry.ts`) y no
 * se consulta ni se replica aquí.
 */

export type StageId =
  'intake' | 'sourcing' | 'proposal' | 'decision' | 'contracting' | 'execution' | 'closure';

export interface StageDefinition {
  id: StageId;
  label: string;
  /** Estados del camino principal, en orden. */
  statuses: CaseStatusCode[];
}

export const CASE_STAGES: StageDefinition[] = [
  { id: 'intake', label: 'Entrada', statuses: ['CREADO', 'EN_REVISION', 'CLASIFICADO'] },
  { id: 'sourcing', label: 'Bolsa', statuses: ['EN_POSTULACION', 'ASIGNADO'] },
  {
    id: 'proposal',
    label: 'Propuesta',
    statuses: ['PROPUESTA_EN_DISENO', 'PROPUESTA_LISTA_PARA_QA', 'PROPUESTA_ENVIADA'],
  },
  {
    id: 'decision',
    label: 'Cliente',
    statuses: ['EN_DECISION_CLIENTE', 'AJUSTES_DE_PROPUESTA', 'PROPUESTA_ACEPTADA'],
  },
  {
    id: 'contracting',
    label: 'Contratación',
    statuses: ['PENDIENTE_CONTRATACION', 'AUTORIZADO_PARA_EJECUCION'],
  },
  { id: 'execution', label: 'Ejecución', statuses: ['EN_EJECUCION', 'LISTO_PARA_CIERRE'] },
  { id: 'closure', label: 'Cierre', statuses: ['CERRADO', 'CERRADO_SIN_CONTRATACION'] },
];

const STAGE_BY_STATUS = new Map<CaseStatusCode, StageDefinition>(
  CASE_STAGES.flatMap((stage) => stage.statuses.map((status) => [status, stage] as const)),
);

export function stageOf(status: CaseStatusCode): StageDefinition {
  return STAGE_BY_STATUS.get(status) ?? CASE_STAGES[0]!;
}

export function stageIndex(status: CaseStatusCode): number {
  return CASE_STAGES.findIndex((stage) => stage.id === stageOf(status).id);
}

/**
 * Forma del indicador de estado. Sustituye al color por estado: la forma dice
 * en qué momento del ciclo está el caso, sin añadir un tono nuevo.
 *
 *   pending  ○  anillo      — entrada, aún no hay trabajo comprometido
 *   active   ●  gris medio  — bolsa
 *   working  ●  grafito     — propuesta, decisión, contratación
 *   live     ●  turquesa    — ejecución (progreso real)
 *   done     ✓               — cerrado
 *   void     ⊘               — cerrado sin contratación
 */
export type StatusShape = 'pending' | 'active' | 'working' | 'live' | 'done' | 'void';

const SHAPE_BY_STAGE: Record<StageId, StatusShape> = {
  intake: 'pending',
  sourcing: 'active',
  proposal: 'working',
  decision: 'working',
  contracting: 'working',
  execution: 'live',
  closure: 'done',
};

export function statusShape(status: CaseStatusCode): StatusShape {
  if (status === 'CERRADO_SIN_CONTRATACION') return 'void';
  return SHAPE_BY_STAGE[stageOf(status).id];
}
