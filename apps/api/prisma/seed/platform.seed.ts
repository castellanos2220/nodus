import { CaseStatusCode, ChecklistKind, type PrismaClient } from '@prisma/client';
import { CASE_STATUS_LABEL, CASE_STATUS_ORDER } from '@nodus/types';

/** Catálogo de metadatos de estado (etiqueta, orden, terminalidad). */
export async function seedCaseStatuses(prisma: PrismaClient): Promise<void> {
  const descriptions: Partial<Record<CaseStatusCode, string>> = {
    CREADO: 'Necesidad registrada por la Mipyme mediante la plantilla T1',
    EN_REVISION: 'Advisory ejecuta la debida diligencia inicial',
    CLASIFICADO: 'Caso elegible y clasificado con taxonomías gobernadas',
    EN_POSTULACION: 'Publicado en la bolsa interna de consultores elegibles',
    ASIGNADO: 'Existe un consultor responsable principal único',
    PROPUESTA_EN_DISENO: 'El consultor construye el análisis y la propuesta',
    PROPUESTA_LISTA_PARA_QA: 'Versión consolidada a la espera de revisión metodológica',
    PROPUESTA_ENVIADA: 'Propuesta formalmente entregada al cliente',
    EN_DECISION_CLIENTE: 'Ventana formal de decisión de la Mipyme',
    AJUSTES_DE_PROPUESTA: 'El cliente solicitó cambios; vuelve al consultor',
    PROPUESTA_ACEPTADA: 'Aceptación formal registrada',
    PENDIENTE_CONTRATACION: 'Formalización directa Mipyme ↔ consultor, con veeduría',
    AUTORIZADO_PARA_EJECUCION: 'Checklist completo y marco operativo cargado',
    EN_EJECUCION: 'Servicio en ejecución bajo seguimiento',
    LISTO_PARA_CIERRE: 'Cierre técnico declarado por el consultor',
    CERRADO: 'Servicio concluido con expediente completo',
    CERRADO_SIN_CONTRATACION: 'Cerrado sin llegar a contratación',
  };

  const colors: Partial<Record<CaseStatusCode, string>> = {
    CREADO: 'slate',
    EN_REVISION: 'amber',
    CLASIFICADO: 'sky',
    EN_POSTULACION: 'indigo',
    ASIGNADO: 'violet',
    PROPUESTA_EN_DISENO: 'violet',
    PROPUESTA_LISTA_PARA_QA: 'amber',
    PROPUESTA_ENVIADA: 'blue',
    EN_DECISION_CLIENTE: 'blue',
    AJUSTES_DE_PROPUESTA: 'orange',
    PROPUESTA_ACEPTADA: 'emerald',
    PENDIENTE_CONTRATACION: 'amber',
    AUTORIZADO_PARA_EJECUCION: 'teal',
    EN_EJECUCION: 'teal',
    LISTO_PARA_CIERRE: 'lime',
    CERRADO: 'emerald',
    CERRADO_SIN_CONTRATACION: 'rose',
  };

  for (const code of Object.values(CaseStatusCode)) {
    await prisma.caseStatus.upsert({
      where: { code },
      create: {
        code,
        label: CASE_STATUS_LABEL[code],
        description: descriptions[code] ?? null,
        sortOrder: CASE_STATUS_ORDER[code],
        isTerminal: code === CaseStatusCode.CERRADO || code === CaseStatusCode.CERRADO_SIN_CONTRATACION,
        colorToken: colors[code] ?? 'slate',
      },
      update: {
        label: CASE_STATUS_LABEL[code],
        description: descriptions[code] ?? null,
        sortOrder: CASE_STATUS_ORDER[code],
        colorToken: colors[code] ?? 'slate',
      },
    });
  }
}

/**
 * Plantillas de checklist T7A (contratación) y T9C (revisión final).
 *
 * Son datos, no código: el checklist que bloquea la ejecución se puede ajustar
 * desde administración sin desplegar. Los ítems provienen literalmente del
 * blueprint operativo (Punto 7, actividad 2; Punto 9, actividad 3).
 */
export async function seedChecklistTemplates(prisma: PrismaClient): Promise<void> {
  const contract = await prisma.checklistTemplate.upsert({
    where: { code: 'T7A_CONTRATACION_V1' },
    create: {
      kind: ChecklistKind.CONTRATACION,
      code: 'T7A_CONTRATACION_V1',
      name: 'T7A — Checklist de cumplimiento de contratación',
      isActive: true,
    },
    update: { name: 'T7A — Checklist de cumplimiento de contratación', isActive: true },
    select: { id: true },
  });

  const contractItems = [
    {
      label: 'Acuerdo o contrato de prestación firmado entre Mipyme y consultor',
      description:
        'NODUS no es parte contractual: sólo verifica que exista evidencia de formalización.',
      defaultResponsible: 'Consultor responsable',
      isRequired: true,
      requiresEvidence: true,
    },
    {
      label: 'Acuerdo de confidencialidad (NDA), si aplica',
      description: 'Márquese NO APLICA cuando el acuerdo principal ya lo contemple.',
      defaultResponsible: 'Consultor responsable',
      isRequired: true,
      requiresEvidence: false,
    },
    {
      label: 'Documentos de responsabilidad y pólizas, si aplican',
      defaultResponsible: 'Consultor responsable',
      isRequired: false,
      requiresEvidence: false,
    },
    {
      label: 'Validaciones administrativas del cliente (alta de proveedor, tributarias)',
      defaultResponsible: 'Mipyme cliente',
      isRequired: true,
      requiresEvidence: false,
    },
    {
      label: 'Acuerdo económico definitivo confirmado por ambas partes',
      defaultResponsible: 'Consultor responsable',
      isRequired: true,
      requiresEvidence: false,
    },
    {
      label: 'Marco operativo del servicio (T7B) cargado en la plataforma',
      description: 'Base de seguimiento durante toda la ejecución.',
      defaultResponsible: 'Consultor responsable',
      isRequired: true,
      requiresEvidence: false,
    },
    {
      label: 'Verificación de veeduría por parte de Advisory',
      description: 'Confirma cumplimiento del proceso, no del contenido legal.',
      defaultResponsible: 'Advisory',
      isRequired: true,
      requiresEvidence: false,
    },
  ];

  await prisma.checklistTemplateItem.deleteMany({ where: { templateId: contract.id } });
  await prisma.checklistTemplateItem.createMany({
    data: contractItems.map((item, index) => ({
      templateId: contract.id,
      label: item.label,
      description: item.description ?? null,
      defaultResponsible: item.defaultResponsible,
      isRequired: item.isRequired,
      requiresEvidence: item.requiresEvidence,
      sortOrder: index * 10,
    })),
  });

  const closure = await prisma.checklistTemplate.upsert({
    where: { code: 'T9C_CIERRE_V1' },
    create: {
      kind: ChecklistKind.CIERRE,
      code: 'T9C_CIERRE_V1',
      name: 'T9C — Checklist de revisión final de cumplimiento',
      isActive: true,
    },
    update: { name: 'T9C — Checklist de revisión final de cumplimiento', isActive: true },
    select: { id: true },
  });

  const closureItems = [
    'Los hitos principales están cumplidos o justificados',
    'Los entregables comprometidos están cargados y versionados',
    'Las incidencias críticas están cerradas o documentadas',
    'La agenda del caso tiene consistencia de cierre',
    'El expediente documental cuenta con trazabilidad suficiente',
    'El caso está metodológicamente completo para su cierre',
  ];

  await prisma.checklistTemplateItem.deleteMany({ where: { templateId: closure.id } });
  await prisma.checklistTemplateItem.createMany({
    data: closureItems.map((label, index) => ({
      templateId: closure.id,
      label,
      isRequired: true,
      requiresEvidence: false,
      sortOrder: index * 10,
    })),
  });
}

/**
 * Reglas de SLA por etapa.
 *
 * Las duraciones **no** están en el código: son estas filas. Se incluyen reglas
 * generales por etapa y reglas más específicas por complejidad y urgencia, para
 * demostrar la resolución por especificidad (gana la que más dimensiones
 * coincidentes tenga).
 */
export async function seedSlaRules(prisma: PrismaClient): Promise<void> {
  const rules: Array<{
    code: string;
    name: string;
    stage: CaseStatusCode;
    durationHours: number;
    warningThresholdPercent?: number;
    escalationAfterHours?: number;
    complexityCode?: string;
    priorityCode?: string;
  }> = [
    // --- Reglas generales por etapa (comodín en todas las dimensiones)
    { code: 'SLA_CREADO', name: 'Confirmación e inicio de revisión del caso', stage: CaseStatusCode.CREADO, durationHours: 24, escalationAfterHours: 24 },
    { code: 'SLA_EN_REVISION', name: 'Cierre de la debida diligencia', stage: CaseStatusCode.EN_REVISION, durationHours: 48, escalationAfterHours: 24 },
    { code: 'SLA_CLASIFICADO', name: 'Publicación en bolsa tras clasificar', stage: CaseStatusCode.CLASIFICADO, durationHours: 24 },
    { code: 'SLA_EN_POSTULACION', name: 'Ventana de postulación', stage: CaseStatusCode.EN_POSTULACION, durationHours: 168, warningThresholdPercent: 80 },
    { code: 'SLA_ASIGNADO', name: 'Apertura del expediente de propuesta', stage: CaseStatusCode.ASIGNADO, durationHours: 48 },
    { code: 'SLA_PROPUESTA_EN_DISENO', name: 'Diseño de la propuesta', stage: CaseStatusCode.PROPUESTA_EN_DISENO, durationHours: 120, escalationAfterHours: 48 },
    { code: 'SLA_PROPUESTA_QA', name: 'Revisión metodológica (QA)', stage: CaseStatusCode.PROPUESTA_LISTA_PARA_QA, durationHours: 48, escalationAfterHours: 24 },
    { code: 'SLA_PROPUESTA_ENVIADA', name: 'Apertura del período de decisión', stage: CaseStatusCode.PROPUESTA_ENVIADA, durationHours: 12 },
    { code: 'SLA_DECISION_CLIENTE', name: 'Respuesta del cliente a la propuesta', stage: CaseStatusCode.EN_DECISION_CLIENTE, durationHours: 120, warningThresholdPercent: 70, escalationAfterHours: 72 },
    { code: 'SLA_AJUSTES_PROPUESTA', name: 'Atención de ajustes solicitados', stage: CaseStatusCode.AJUSTES_DE_PROPUESTA, durationHours: 72, escalationAfterHours: 24 },
    { code: 'SLA_PROPUESTA_ACEPTADA', name: 'Paso a contratación tras aceptación', stage: CaseStatusCode.PROPUESTA_ACEPTADA, durationHours: 12 },
    { code: 'SLA_PENDIENTE_CONTRATACION', name: 'Formalización contractual', stage: CaseStatusCode.PENDIENTE_CONTRATACION, durationHours: 240, warningThresholdPercent: 70, escalationAfterHours: 72 },
    { code: 'SLA_AUTORIZADO_EJECUCION', name: 'Inicio de ejecución tras autorización', stage: CaseStatusCode.AUTORIZADO_PARA_EJECUCION, durationHours: 72, escalationAfterHours: 48 },
    { code: 'SLA_EN_EJECUCION', name: 'Ejecución del servicio', stage: CaseStatusCode.EN_EJECUCION, durationHours: 720, warningThresholdPercent: 85, escalationAfterHours: 120 },
    { code: 'SLA_LISTO_PARA_CIERRE', name: 'Revisión final y cierre formal', stage: CaseStatusCode.LISTO_PARA_CIERRE, durationHours: 120, escalationAfterHours: 48 },

    // --- Reglas específicas: demuestran la resolución por especificidad
    {
      code: 'SLA_EN_REVISION_URGENCIA_ALTA',
      name: 'Debida diligencia acelerada para casos urgentes',
      stage: CaseStatusCode.EN_REVISION,
      durationHours: 24,
      priorityCode: 'ALTA',
      escalationAfterHours: 12,
    },
    {
      code: 'SLA_PROPUESTA_DISENO_ESTRATEGICO',
      name: 'Diseño de propuesta para casos estratégicos',
      stage: CaseStatusCode.PROPUESTA_EN_DISENO,
      durationHours: 240,
      complexityCode: 'ESTRATEGICO',
      warningThresholdPercent: 80,
    },
    {
      code: 'SLA_PROPUESTA_DISENO_BAJO',
      name: 'Diseño de propuesta para casos de baja complejidad',
      stage: CaseStatusCode.PROPUESTA_EN_DISENO,
      durationHours: 72,
      complexityCode: 'BAJO',
    },
  ];

  for (const rule of rules) {
    await prisma.slaRule.upsert({
      where: { code: rule.code },
      create: {
        code: rule.code,
        name: rule.name,
        stage: rule.stage,
        durationHours: rule.durationHours,
        warningThresholdPercent: rule.warningThresholdPercent ?? 75,
        escalationAfterHours: rule.escalationAfterHours ?? null,
        complexityCode: rule.complexityCode ?? null,
        priorityCode: rule.priorityCode ?? null,
        isActive: true,
      },
      update: {
        name: rule.name,
        durationHours: rule.durationHours,
        warningThresholdPercent: rule.warningThresholdPercent ?? 75,
        escalationAfterHours: rule.escalationAfterHours ?? null,
        isActive: true,
      },
    });
  }
}
