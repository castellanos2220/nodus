import { NotificationChannel, type PrismaClient } from '@prisma/client';

/**
 * Plantillas de comunicación TCOM1 – TCOM12 (blueprint operativo, componente
 * transversal de comunicaciones).
 *
 * Son **datos parametrizables**: asunto, cuerpo, audiencias y canal viven en la
 * base y se pueden editar sin desplegar. La sintaxis es `{{variable}}` y nada
 * más, deliberadamente: una plantilla editable por un administrador no debe
 * poder ejecutar lógica.
 *
 * `audiences` se resuelve a personas concretas en el momento del envío
 * (`RecipientResolverService`), no al crear la plantilla.
 */
const TEMPLATES = [
  {
    code: 'TCOM1',
    name: 'Confirmación de caso recibido',
    eventName: 'CaseCreated',
    audiences: ['CLIENTE'],
    subjectTemplate: 'NODUS · Hemos recibido su caso {{caseCode}}',
    bodyTemplate: `Hola {{recipientName}},

Hemos registrado formalmente su necesidad en NODUS con el identificador {{caseCode}}: «{{caseTitle}}».

Nuestro equipo advisory iniciará la revisión y la debida diligencia del caso. Le informaremos en cuanto el caso quede clasificado y habilitado.

Mientras el caso permanezca en estado CREADO podrá editar la información desde la plataforma.`,
  },
  {
    code: 'TCOM2',
    name: 'Solicitud de aclaración al cliente',
    eventName: 'CaseInformationRequested',
    audiences: ['CLIENTE'],
    subjectTemplate: 'NODUS · Necesitamos ampliar información del caso {{caseCode}}',
    bodyTemplate: `Hola {{recipientName}},

Para continuar con la evaluación del caso {{caseCode}} necesitamos ampliar algunos puntos.

Puede responder desde la plataforma, en la sección de comunicaciones del caso. Su respuesta queda registrada en el expediente.`,
  },
  {
    code: 'TCOM3',
    name: 'Caso habilitado para postulación',
    eventName: 'CaseClassified',
    audiences: ['CLIENTE', 'ADVISORY'],
    subjectTemplate: 'NODUS · Su caso {{caseCode}} ha sido clasificado',
    bodyTemplate: `Hola {{recipientName}},

El caso {{caseCode}} «{{caseTitle}}» ha superado la debida diligencia y ha quedado clasificado.

Área: {{areaCode}}
Tipo de intervención: {{interventionTypeCode}}
Complejidad: {{complexityCode}}

El siguiente paso es la publicación controlada en la bolsa interna de consultores habilitados.`,
  },
  {
    code: 'TCOM4',
    name: 'Notificación de oportunidad a consultor elegible',
    eventName: 'CasePublished',
    audiences: ['CONSULTORES_ELEGIBLES'],
    subjectTemplate: 'NODUS · Nueva oportunidad elegible: {{caseCode}}',
    bodyTemplate: `Hola {{recipientName}},

Se ha publicado una oportunidad para la que usted es elegible según su especialidad, nivel y alcance habilitado.

Caso: {{caseCode}} — {{caseTitle}}
Plazo de postulación: {{applicationDeadline}}

Puede revisar la versión controlada del caso y presentar su postulación estructurada desde su panel de oportunidades.`,
  },
  {
    code: 'TCOM5',
    name: 'Confirmación de asignación de consultor',
    eventName: 'ConsultantAssigned',
    audiences: ['CONSULTOR_ASIGNADO', 'CLIENTE', 'ADVISORY'],
    subjectTemplate: 'NODUS · Consultor asignado al caso {{caseCode}}',
    bodyTemplate: `Hola {{recipientName}},

El caso {{caseCode}} «{{caseTitle}}» ya tiene consultor responsable principal designado: {{consultantName}} ({{consultantCode}}).

El consultor asume la responsabilidad profesional de la solución. NODUS mantiene la veeduría metodológica y el control del proceso.`,
  },
  {
    code: 'TCOM6',
    name: 'Propuesta enviada al cliente',
    eventName: 'ProposalSent',
    audiences: ['CLIENTE', 'CONSULTOR_ASIGNADO'],
    subjectTemplate: 'NODUS · Propuesta disponible para el caso {{caseCode}}',
    bodyTemplate: `Hola {{recipientName}},

La propuesta del caso {{caseCode}} «{{caseTitle}}» ha superado la revisión metodológica y está formalmente disponible para su revisión.

Versión: {{versionNumber}}

Desde la plataforma podrá aceptarla, solicitar ajustes o registrar que no desea continuar. Toda decisión queda documentada en el expediente.`,
  },
  {
    code: 'TCOM7',
    name: 'Observaciones a propuesta',
    eventName: 'ProposalAdjustmentRequested',
    audiences: ['CONSULTOR_ASIGNADO'],
    subjectTemplate: 'NODUS · Ajustes solicitados a la propuesta de {{caseCode}}',
    bodyTemplate: `Hola {{recipientName}},

Se han registrado observaciones sobre la propuesta del caso {{caseCode}}.

Se ha creado la versión {{versionNumber}} en borrador a partir de la anterior, para que atienda los ajustes sin perder el histórico. La versión previa queda archivada e íntegra.`,
  },
  {
    code: 'TCOM8',
    name: 'Recordatorio de SLA próximo a vencer',
    eventName: 'SlaAtRisk',
    audiences: ['ADVISORY', 'CONSULTOR_ASIGNADO'],
    subjectTemplate: 'NODUS · SLA en riesgo — caso {{caseCode}}',
    bodyTemplate: `Hola {{recipientName}},

El SLA «{{ruleName}}» del caso {{caseCode}} ha consumido el {{percentConsumed}} % de su tiempo.

Etapa: {{stage}}
Vence: {{deadline}}

Esta es una alerta preventiva para evitar el incumplimiento.`,
  },
  {
    code: 'TCOM9',
    name: 'Alerta de SLA vencido / escalamiento',
    eventName: 'SlaOverdue',
    audiences: ['ADVISORY'],
    subjectTemplate: 'NODUS · SLA VENCIDO — caso {{caseCode}}',
    bodyTemplate: `Hola {{recipientName}},

El SLA «{{ruleName}}» del caso {{caseCode}} «{{caseTitle}}» está vencido.

Etapa: {{stage}}
Vencimiento: {{deadline}}

Se requiere intervención del equipo advisory para desbloquear el caso.`,
  },
  {
    code: 'TCOM10',
    name: 'Inicio de ejecución',
    eventName: 'ExecutionStarted',
    audiences: ['CLIENTE', 'CONSULTOR_ASIGNADO', 'ADVISORY'],
    subjectTemplate: 'NODUS · Inicia la ejecución del caso {{caseCode}}',
    bodyTemplate: `Hola {{recipientName}},

La ejecución del caso {{caseCode}} «{{caseTitle}}» ha comenzado formalmente.

A partir de ahora el avance, los hitos, las incidencias y los entregables se registran y se siguen dentro de la plataforma.`,
  },
  {
    code: 'TCOM11',
    name: 'Entregable cargado / en revisión',
    eventName: 'DeliverableUploaded',
    audiences: ['CLIENTE', 'ADVISORY'],
    subjectTemplate: 'NODUS · Nuevo entregable en el caso {{caseCode}}',
    bodyTemplate: `Hola {{recipientName}},

Se ha cargado una versión nueva de un entregable del caso {{caseCode}}.

Entregable: {{deliverableName}}
Versión: {{versionNumber}}

Las versiones anteriores permanecen disponibles: el versionamiento es obligatorio y nada se sobrescribe.`,
  },
  {
    code: 'TCOM12',
    name: 'Cierre de caso y evaluación',
    eventName: 'CaseClosed',
    audiences: ['CLIENTE', 'CONSULTOR_ASIGNADO', 'ADVISORY'],
    subjectTemplate: 'NODUS · Caso {{caseCode}} cerrado formalmente',
    bodyTemplate: `Hola {{recipientName}},

El caso {{caseCode}} «{{caseTitle}}» ha sido cerrado formalmente.

El expediente queda completo y trazable: entregables finales, aceptación del cliente, evaluación de satisfacción y evaluación de desempeño del consultor.

Gracias por confiar en NODUS.`,
  },

  // --- Plantillas complementarias para eventos que el blueprint exige comunicar
  {
    code: 'TCOM13',
    name: 'Postulación recibida',
    eventName: 'ApplicationSubmitted',
    audiences: ['ADVISORY'],
    subjectTemplate: 'NODUS · Nueva postulación en el caso {{caseCode}}',
    bodyTemplate: `Hola {{recipientName}},

El consultor {{consultantName}} ({{consultantCode}}) se ha postulado al caso {{caseCode}} «{{caseTitle}}».

Puede evaluar las postulaciones recibidas desde el expediente del caso.`,
  },
  {
    code: 'TCOM14',
    name: 'Propuesta lista para QA',
    eventName: 'ProposalSubmitted',
    audiences: ['ADVISORY', 'REVISORES'],
    subjectTemplate: 'NODUS · Propuesta lista para QA — caso {{caseCode}}',
    bodyTemplate: `Hola {{recipientName}},

La propuesta del caso {{caseCode}} «{{caseTitle}}» ha sido consolidada y está lista para revisión metodológica.

Versión: {{versionNumber}}

La versión ha quedado congelada: cualquier cambio exigirá generar una versión nueva.`,
  },
  {
    code: 'TCOM15',
    name: 'Paso a contratación',
    eventName: 'ContractingStarted',
    audiences: ['CLIENTE', 'CONSULTOR_ASIGNADO', 'ADVISORY'],
    subjectTemplate: 'NODUS · Caso {{caseCode}} pendiente de contratación',
    bodyTemplate: `Hola {{recipientName}},

La propuesta del caso {{caseCode}} ha sido aceptada y el caso pasa a la etapa de formalización.

La contratación se realiza directamente entre la Mipyme y el consultor responsable; NODUS no es parte contractual. La plataforma verifica el cumplimiento del proceso mediante el checklist T7A y no habilitará la ejecución hasta completarlo.`,
  },
  {
    code: 'TCOM16',
    name: 'Ejecución autorizada',
    eventName: 'ExecutionAuthorized',
    audiences: ['CONSULTOR_ASIGNADO', 'CLIENTE'],
    subjectTemplate: 'NODUS · Ejecución autorizada — caso {{caseCode}}',
    bodyTemplate: `Hola {{recipientName}},

El checklist de contratación está completo y el marco operativo del servicio ha sido cargado. El caso {{caseCode}} queda autorizado para iniciar ejecución.

El siguiente paso es activar la agenda operativa con actividades e hitos.`,
  },
  {
    code: 'TCOM17',
    name: 'Cierre técnico declarado',
    eventName: 'CaseReadyForClosure',
    audiences: ['ADVISORY', 'CLIENTE'],
    subjectTemplate: 'NODUS · Cierre técnico declarado — caso {{caseCode}}',
    bodyTemplate: `Hola {{recipientName}},

El consultor responsable ha declarado el cierre técnico del caso {{caseCode}} «{{caseTitle}}».

Corresponde ahora la revisión final de cumplimiento, la entrega formal y el registro de la aceptación del cliente.`,
  },
  {
    code: 'TCOM18',
    name: 'Cierre sin contratación',
    eventName: 'CaseClosedWithoutContracting',
    audiences: ['ADVISORY'],
    subjectTemplate: 'NODUS · Caso {{caseCode}} cerrado sin contratación',
    bodyTemplate: `Hola {{recipientName}},

El caso {{caseCode}} se ha cerrado sin llegar a contratación.

Motivo registrado: {{reasonCode}}

El registro alimenta la analítica comercial del modelo.`,
  },
  {
    code: 'TCOM19',
    name: 'Incidencia abierta',
    eventName: 'IncidentOpened',
    audiences: ['ADVISORY'],
    subjectTemplate: 'NODUS · Incidencia registrada en el caso {{caseCode}}',
    bodyTemplate: `Hola {{recipientName}},

Se ha registrado una incidencia en el caso {{caseCode}} «{{caseTitle}}».

Incidencia: {{incidentTitle}}
Impacto: {{impact}}

Las incidencias de impacto alto o crítico bloquean el cierre técnico hasta ser resueltas.`,
  },
  {
    code: 'TCOM20',
    name: 'Hito vencido',
    eventName: 'MilestoneOverdue',
    audiences: ['ADVISORY', 'CONSULTOR_ASIGNADO'],
    subjectTemplate: 'NODUS · Hito vencido en el caso {{caseCode}}',
    bodyTemplate: `Hola {{recipientName}},

El hito «{{milestoneName}}» del caso {{caseCode}} ha superado su fecha objetivo ({{targetDate}}).

Criticidad: {{criticality}}

Debe cumplirse, reprogramarse con justificación o documentarse antes del cierre.`,
  },
] as const;

export async function seedNotificationTemplates(prisma: PrismaClient): Promise<void> {
  for (const template of TEMPLATES) {
    await prisma.notificationTemplate.upsert({
      where: { code: template.code },
      create: {
        code: template.code,
        name: template.name,
        eventName: template.eventName,
        audiences: [...template.audiences],
        subjectTemplate: template.subjectTemplate,
        bodyTemplate: template.bodyTemplate,
        channel: NotificationChannel.EMAIL,
        isActive: true,
      },
      update: {
        name: template.name,
        eventName: template.eventName,
        audiences: [...template.audiences],
        subjectTemplate: template.subjectTemplate,
        bodyTemplate: template.bodyTemplate,
        isActive: true,
      },
    });
  }
}
