import type { Prisma, PrismaClient } from '@prisma/client';

interface ListDefinition {
  code: string;
  name: string;
  description: string;
  values: Array<{
    code: string;
    label: string;
    description?: string;
    metadata?: Record<string, unknown>;
  }>;
}

/**
 * Listas de valores gobernadas (RT-015 .. RT-017).
 *
 * Los valores salen de los documentos fuente: el Punto 2 del blueprint operativo
 * (áreas, tipos de intervención, complejidad, impacto), el Punto 1 (urgencia) y
 * el componente de gestión de consultores (especialidades, niveles, sectores).
 *
 * `metadata.rank` en COMPLEJIDAD es lo que permite comparar "hasta qué
 * complejidad está habilitado un consultor" sin escribir el orden en código.
 */
export const LOOKUP_LISTS: ListDefinition[] = [
  {
    code: 'AREA_PROBLEMA',
    name: 'Áreas del problema',
    description: 'Área del negocio involucrada en el caso (Punto 1 y Punto 2)',
    values: [
      { code: 'ESTRATEGIA', label: 'Estrategia' },
      { code: 'TECNOLOGIA', label: 'Tecnología' },
      { code: 'FINANZAS', label: 'Finanzas' },
      { code: 'OPERACIONES', label: 'Operaciones' },
      { code: 'LEGAL_CUMPLIMIENTO', label: 'Legal / cumplimiento' },
      { code: 'TALENTO_HUMANO', label: 'Talento humano' },
      { code: 'ANALITICA_DATOS', label: 'Analítica / datos' },
      { code: 'TRANSFORMACION_DIGITAL', label: 'Transformación digital' },
      { code: 'OTRO', label: 'Otro' },
    ],
  },
  {
    code: 'SUBAREA',
    name: 'Subáreas',
    description: 'Taxonomía de segundo nivel para afinar la clasificación',
    values: [
      { code: 'PLANEACION_ESTRATEGICA', label: 'Planeación estratégica' },
      { code: 'MODELO_NEGOCIO', label: 'Modelo de negocio' },
      { code: 'INFRAESTRUCTURA_TI', label: 'Infraestructura TI' },
      { code: 'SISTEMAS_INFORMACION', label: 'Sistemas de información' },
      { code: 'CIBERSEGURIDAD', label: 'Ciberseguridad' },
      { code: 'COSTOS_RENTABILIDAD', label: 'Costos y rentabilidad' },
      { code: 'FLUJO_CAJA', label: 'Flujo de caja' },
      { code: 'CADENA_SUMINISTRO', label: 'Cadena de suministro' },
      { code: 'INVENTARIOS', label: 'Gestión de inventarios' },
      { code: 'PROCESOS', label: 'Procesos y productividad' },
      { code: 'CUMPLIMIENTO_NORMATIVO', label: 'Cumplimiento normativo' },
      { code: 'GESTION_TALENTO', label: 'Gestión del talento' },
      { code: 'GOBIERNO_DATOS', label: 'Gobierno de datos' },
    ],
  },
  {
    code: 'TIPO_INTERVENCION',
    name: 'Tipos de intervención',
    description: 'Naturaleza de la intervención consultiva (Punto 2)',
    values: [
      { code: 'DIAGNOSTICO', label: 'Diagnóstico' },
      { code: 'EVALUACION_ESPECIALIZADA', label: 'Evaluación especializada' },
      { code: 'DISENO_SOLUCION', label: 'Diseño de solución' },
      { code: 'IMPLEMENTACION', label: 'Implementación' },
      { code: 'OPTIMIZACION', label: 'Optimización' },
      { code: 'ACOMPANAMIENTO_ESTRATEGICO', label: 'Acompañamiento estratégico' },
    ],
  },
  {
    code: 'COMPLEJIDAD',
    name: 'Niveles de complejidad',
    description:
      'Complejidad del caso. `metadata.rank` ordena los niveles y permite comparar el ' +
      'alcance habilitado de un consultor sin escribir el orden en código.',
    values: [
      { code: 'BAJO', label: 'Bajo', metadata: { rank: 1 } },
      { code: 'MEDIO', label: 'Medio', metadata: { rank: 2 } },
      { code: 'ALTO', label: 'Alto', metadata: { rank: 3 } },
      { code: 'ESTRATEGICO', label: 'Estratégico', metadata: { rank: 4 } },
    ],
  },
  {
    code: 'URGENCIA',
    name: 'Niveles de urgencia',
    description: 'Urgencia declarada por la Mipyme en el intake T1',
    values: [
      { code: 'ALTA', label: 'Alta', metadata: { rank: 3 } },
      { code: 'MEDIA', label: 'Media', metadata: { rank: 2 } },
      { code: 'BAJA', label: 'Baja', metadata: { rank: 1 } },
    ],
  },
  {
    code: 'IMPACTO',
    name: 'Niveles de impacto',
    description: 'Impacto estimado para la empresa',
    values: [
      { code: 'CRITICO', label: 'Crítico', metadata: { rank: 4 } },
      { code: 'ALTO', label: 'Alto', metadata: { rank: 3 } },
      { code: 'MEDIO', label: 'Medio', metadata: { rank: 2 } },
      { code: 'BAJO', label: 'Bajo', metadata: { rank: 1 } },
    ],
  },
  {
    code: 'TIPO_ENTREGABLE',
    name: 'Tipos de entregable',
    description: 'Clasificación de los entregables del servicio (T8G)',
    values: [
      { code: 'DIAGNOSTICO', label: 'Informe de diagnóstico' },
      { code: 'PLAN_TRABAJO', label: 'Plan de trabajo' },
      { code: 'INFORME_TECNICO', label: 'Informe técnico' },
      { code: 'MANUAL_PROCEDIMIENTO', label: 'Manual o procedimiento' },
      { code: 'MATRIZ_RIESGOS', label: 'Matriz de riesgos' },
      { code: 'MODELO_FINANCIERO', label: 'Modelo financiero' },
      { code: 'DISENO_SOLUCION', label: 'Diseño de solución' },
      { code: 'CAPACITACION', label: 'Sesión de capacitación' },
      { code: 'INFORME_FINAL', label: 'Informe final' },
    ],
  },
  {
    code: 'ESPECIALIDAD',
    name: 'Especialidades del consultor',
    description: 'Especialidad principal declarada y validada (TC3)',
    values: [
      { code: 'ESTRATEGIA', label: 'Estrategia' },
      { code: 'TECNOLOGIA', label: 'Tecnología' },
      { code: 'FINANZAS', label: 'Finanzas' },
      { code: 'OPERACIONES', label: 'Operaciones' },
      { code: 'RIESGO', label: 'Riesgo' },
      { code: 'CUMPLIMIENTO', label: 'Cumplimiento' },
      { code: 'ANALITICA_DATOS', label: 'Analítica / datos' },
      { code: 'TRANSFORMACION_DIGITAL', label: 'Transformación digital' },
      { code: 'TALENTO_HUMANO', label: 'Talento humano' },
      { code: 'LEGAL_CUMPLIMIENTO', label: 'Legal / cumplimiento' },
    ],
  },
  {
    code: 'NIVEL_CONSULTOR',
    name: 'Niveles de experiencia del consultor',
    description: 'Nivel de experiencia validado por la plataforma',
    values: [
      { code: 'JUNIOR', label: 'Junior', description: 'No aplica para casos críticos', metadata: { rank: 1 } },
      { code: 'SEMI_SENIOR', label: 'Semi senior', metadata: { rank: 2 } },
      { code: 'SENIOR', label: 'Senior', metadata: { rank: 3 } },
      { code: 'EXPERTO', label: 'Experto', metadata: { rank: 4 } },
      { code: 'ESTRATEGICO', label: 'Estratégico', metadata: { rank: 5 } },
    ],
  },
  {
    code: 'SECTOR',
    name: 'Sectores de experiencia',
    description: 'Sector económico de la empresa o de experiencia del consultor',
    values: [
      { code: 'INDUSTRIA', label: 'Industria' },
      { code: 'SALUD', label: 'Salud' },
      { code: 'RETAIL', label: 'Retail' },
      { code: 'SERVICIOS', label: 'Servicios' },
      { code: 'ENERGIA', label: 'Energía' },
      { code: 'LOGISTICA', label: 'Logística' },
      { code: 'TECNOLOGIA', label: 'Tecnología' },
      { code: 'AGROINDUSTRIA', label: 'Agroindustria' },
      { code: 'CONSTRUCCION', label: 'Construcción' },
      { code: 'EDUCACION', label: 'Educación' },
    ],
  },
  {
    code: 'MODALIDAD_VINCULACION',
    name: 'Modalidades de vinculación',
    description: 'Cómo se vincula el consultor al ecosistema',
    values: [
      { code: 'INDEPENDIENTE', label: 'Consultor independiente' },
      { code: 'SPONSOR', label: 'Patrocinado por empresa sponsor' },
      { code: 'PROPIO', label: 'Consultor propio de la plataforma' },
    ],
  },
  {
    code: 'TIPO_INCIDENCIA',
    name: 'Tipos de incidencia',
    description: 'Clasificación de bloqueos, riesgos y desviaciones (T8D)',
    values: [
      { code: 'RETRASO_CLIENTE', label: 'Retraso del cliente' },
      { code: 'FALTA_INFORMACION', label: 'Falta de información' },
      { code: 'CAMBIO_CONDICIONES', label: 'Cambio en las condiciones del caso' },
      { code: 'BLOQUEO_OPERATIVO', label: 'Bloqueo operativo' },
      { code: 'RIESGO_CRONOGRAMA', label: 'Riesgo de cronograma' },
      { code: 'DESVIACION_ALCANCE', label: 'Desviación frente al alcance' },
      { code: 'DEPENDENCIA_TERCEROS', label: 'Dependencia de terceros' },
      { code: 'CONTRATACION', label: 'Incidencia de contratación (T7D)' },
    ],
  },
  {
    code: 'MOTIVO_CIERRE',
    name: 'Motivos de cierre sin contratación',
    description: 'Alimenta la analítica comercial del Punto 6 (TP6E)',
    values: [
      { code: 'PRESUPUESTO', label: 'Presupuesto insuficiente' },
      { code: 'TIEMPO', label: 'Tiempos no compatibles' },
      { code: 'ALCANCE', label: 'Alcance no responde a la necesidad' },
      { code: 'PRIORIDAD_INTERNA', label: 'Cambio de prioridades internas' },
      { code: 'SOLUCION_INTERNA', label: 'Se resolvió internamente' },
      { code: 'OTRA_ALTERNATIVA', label: 'Se eligió otra alternativa' },
      { code: 'NO_ELEGIBLE', label: 'Caso no elegible para la plataforma' },
      { code: 'SIN_RESPUESTA', label: 'Sin respuesta del cliente' },
    ],
  },
  {
    code: 'SEGMENTO_CLIENTE',
    name: 'Segmentos de cliente',
    description: 'Dimensión opcional para parametrizar SLA diferenciados',
    values: [
      { code: 'MICRO', label: 'Microempresa' },
      { code: 'PEQUENA', label: 'Pequeña empresa' },
      { code: 'MEDIANA', label: 'Mediana empresa' },
      { code: 'PREMIUM', label: 'Cliente premium' },
    ],
  },
];

export async function seedLookups(prisma: PrismaClient): Promise<void> {
  for (const list of LOOKUP_LISTS) {
    const created = await prisma.lookupList.upsert({
      where: { code: list.code },
      create: {
        code: list.code,
        name: list.name,
        description: list.description,
        isSystem: true,
      },
      update: { name: list.name, description: list.description },
      select: { id: true },
    });

    for (const [index, value] of list.values.entries()) {
      await prisma.lookupValue.upsert({
        where: { listId_code: { listId: created.id, code: value.code } },
        create: {
          listId: created.id,
          code: value.code,
          label: value.label,
          description: value.description ?? null,
          sortOrder: index * 10,
          isActive: true,
          metadata: (value.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
        },
        update: {
          label: value.label,
          description: value.description ?? null,
          sortOrder: index * 10,
          isActive: true,
          metadata: (value.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
        },
      });
    }
  }
}
