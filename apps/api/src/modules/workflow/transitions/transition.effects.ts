import {
  ApplicationStatus,
  ChecklistItemStatus,
  ChecklistKind,
  ClientDecisionType,
  CommunicationAudience,
  CommunicationType,
  DocumentStage,
  ProposalVersionStatus,
} from '@prisma/client';
import { BusinessRuleError } from '../../../core/common/errors/domain.errors';
import type { EffectContext, EffectResult } from '../workflow.types';

/**
 * Efectos propios de cada transición.
 *
 * Todo lo que ocurre aquí se ejecuta **dentro** de la transacción de la
 * transición, junto al cambio de estado, el historial y la auditoría. O pasa
 * todo, o no pasa nada.
 *
 * Los efectos escriben directamente con el cliente de transacción en lugar de
 * llamar a los servicios de `proposals`, `contracts`, etc. Es deliberado: hacerlo
 * al revés crearía dependencias circulares entre módulos (propuestas necesita
 * workflow para transitar, workflow necesitaría propuestas para crear versiones)
 * y rompería la frontera modular que justifica el monolito modular.
 */
export type EffectFn = (context: EffectContext) => Promise<EffectResult>;

const str = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');
const int = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

const DEFAULT_APPLICATION_WINDOW_DAYS = 7;

const effects: Record<string, EffectFn> = {
  // ------------------------------------------------------------- Punto 2 --
  async REQUEST_INFO({ tx, case: kase, payload, note, user }) {
    const body = str(payload.note) || str(note);
    const communication = await tx.communication.create({
      data: {
        caseId: kase.id,
        type: CommunicationType.SOLICITUD_INFORMACION,
        stage: DocumentStage.EVALUACION,
        audience: CommunicationAudience.CLIENTE,
        subject: `Solicitud de información — ${kase.code}`,
        body,
        createdById: user?.id ?? null,
      },
      select: { id: true },
    });
    return { communicationId: communication.id };
  },

  async CLASSIFY({ tx, case: kase }) {
    const classification = await tx.caseClassification.findFirst({
      where: { caseId: kase.id, isCurrent: true },
    });
    if (!classification) throw new BusinessRuleError('NO_CLASSIFICATION', 'Sin clasificación');

    await tx.caseClassification.update({
      where: { id: classification.id },
      data: { confirmedAt: new Date() },
    });

    // La clasificación vigente se denormaliza en el caso para poder filtrar y
    // agregar sin join; el historial completo sigue en case_classifications.
    await tx.case.update({
      where: { id: kase.id },
      data: {
        areaCode: classification.areaCode,
        subAreaCode: classification.subAreaCode,
        interventionTypeCode: classification.interventionTypeCode,
        complexityCode: classification.complexityCode,
        impactCode: classification.impactCode,
        urgencyCode: classification.urgencyCode,
      },
    });

    return {
      areaCode: classification.areaCode,
      complexityCode: classification.complexityCode,
      interventionTypeCode: classification.interventionTypeCode,
    };
  },

  async REJECT_INELIGIBLE({ tx, case: kase, payload, note, user }) {
    const reason = str(payload.reason) || str(note);
    await tx.case.update({
      where: { id: kase.id },
      data: {
        closureReason: reason,
        closureReasonCode: str(payload.reasonCode) || 'NO_ELEGIBLE',
        closedAt: new Date(),
        closedById: user?.id ?? null,
      },
    });
    return { reason };
  },

  // ------------------------------------------------------------- Punto 3 --
  async PUBLISH({ tx, case: kase, payload }) {
    const days = int(payload.applicationWindowDays, DEFAULT_APPLICATION_WINDOW_DAYS);
    const deadline = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

    await tx.case.update({
      where: { id: kase.id },
      data: { publishedAt: new Date(), applicationDeadline: deadline },
    });

    return { applicationDeadline: deadline.toISOString(), windowDays: days };
  },

  async ASSIGN_CONSULTANT({ tx, case: kase, payload, user }) {
    const applicationId = str(payload.applicationId);
    const rationale = str(payload.decisionRationale);

    // T3D — se registra la evaluación de TODAS las postulaciones, no sólo de la
    // ganadora: el blueprint exige que la decisión sea trazable y comparable.
    const evaluations = Array.isArray(payload.evaluations)
      ? (payload.evaluations as Record<string, unknown>[])
      : [];

    for (const raw of evaluations) {
      const targetId = str(raw.applicationId);
      if (!targetId) continue;

      const scores = {
        specialtyFit: int(raw.specialtyFit, 3),
        experienceFit: int(raw.experienceFit, 3),
        levelFit: int(raw.levelFit, 3),
        availabilityFit: int(raw.availabilityFit, 3),
        trackRecordFit: int(raw.trackRecordFit, 3),
      };
      const totalScore = Object.values(scores).reduce((sum, value) => sum + value, 0);

      await tx.applicationEvaluation.upsert({
        where: { applicationId: targetId },
        create: {
          applicationId: targetId,
          ...scores,
          totalScore,
          notes: str(raw.notes) || rationale,
          evaluatedById: user?.id ?? null,
        },
        update: {
          ...scores,
          totalScore,
          notes: str(raw.notes) || rationale,
          evaluatedById: user?.id ?? null,
        },
      });
    }

    const application = await tx.application.findUniqueOrThrow({
      where: { id: applicationId },
      select: { consultantId: true, consultant: { select: { code: true, user: { select: { fullName: true } } } } },
    });

    // La ganadora queda ACEPTADA; el resto, NO_SELECCIONADA. Nadie queda en
    // estado ambiguo tras una asignación.
    await tx.application.update({
      where: { id: applicationId },
      data: { status: ApplicationStatus.ACEPTADA },
    });
    await tx.application.updateMany({
      where: {
        caseId: kase.id,
        id: { not: applicationId },
        status: { in: [ApplicationStatus.PRESENTADA, ApplicationStatus.EN_EVALUACION] },
      },
      data: { status: ApplicationStatus.NO_SELECCIONADA },
    });

    const assignment = await tx.caseAssignment.create({
      data: {
        caseId: kase.id,
        consultantId: application.consultantId,
        applicationId,
        isPrimary: true,
        isActive: true,
        assignedById: user?.id ?? null,
        decisionRationale: rationale,
      },
      select: { id: true },
    });

    return {
      assignmentId: assignment.id,
      consultantId: application.consultantId,
      consultantCode: application.consultant.code,
      consultantName: application.consultant.user.fullName,
    };
  },

  // ------------------------------------------------------------- Punto 4 --
  async OPEN_PROPOSAL({ tx, case: kase, user }) {
    const existing = await tx.proposal.findUnique({
      where: { caseId: kase.id },
      select: { id: true, currentVersionNumber: true },
    });

    const proposal =
      existing ??
      (await tx.proposal.create({
        data: { caseId: kase.id, currentVersionNumber: 0 },
        select: { id: true, currentVersionNumber: true },
      }));

    const draft = await tx.proposalVersion.findFirst({
      where: { proposalId: proposal.id, status: ProposalVersionStatus.BORRADOR },
      select: { id: true, versionNumber: true },
    });

    if (draft) return { proposalId: proposal.id, versionNumber: draft.versionNumber };

    const versionNumber = proposal.currentVersionNumber + 1;
    await tx.proposalVersion.create({
      data: {
        proposalId: proposal.id,
        versionNumber,
        status: ProposalVersionStatus.BORRADOR,
        createdById: user?.id ?? null,
        changeNote: 'Versión inicial',
      },
    });
    await tx.proposal.update({
      where: { id: proposal.id },
      data: { currentVersionNumber: versionNumber },
    });

    return { proposalId: proposal.id, versionNumber };
  },

  async SUBMIT_FOR_QA(context) {
    return freezeDraftForQa(context);
  },

  async SUBMIT_ADJUSTED(context) {
    const result = await freezeDraftForQa(context);

    // TP6C — responde formalmente la solicitud de ajustes abierta.
    const pending = await context.tx.proposalAdjustment.findFirst({
      where: { proposal: { caseId: context.case.id }, respondedAt: null },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });
    if (pending) {
      await context.tx.proposalAdjustment.update({
        where: { id: pending.id },
        data: {
          respondedAt: new Date(),
          response:
            str(context.payload.response) ||
            str(context.note) ||
            `Ajustes atendidos en la versión ${result.versionNumber}.`,
        },
      });
    }

    return result;
  },

  // ------------------------------------------------------------- Punto 5 --
  async REQUEST_PROPOSAL_CHANGES({ tx, case: kase, user }) {
    return supersedeAndCreateDraft(tx, kase.id, ProposalVersionStatus.EN_QA, user?.id ?? null,
      'Nueva versión tras observaciones de QA');
  },

  async APPROVE_AND_SEND({ tx, case: kase }) {
    const version = await tx.proposalVersion.findFirstOrThrow({
      where: { proposal: { caseId: kase.id }, status: ProposalVersionStatus.EN_QA },
      orderBy: { versionNumber: 'desc' },
      select: { id: true, versionNumber: true },
    });

    await tx.proposalVersion.update({
      where: { id: version.id },
      data: { status: ProposalVersionStatus.ENVIADA, sentAt: new Date() },
    });

    return { versionNumber: version.versionNumber };
  },

  async OPEN_CLIENT_DECISION({ tx, case: kase }) {
    await tx.case.update({
      where: { id: kase.id },
      data: { decisionOpenedAt: new Date() },
    });
    return {};
  },

  // ------------------------------------------------------------- Punto 6 --
  async CLIENT_REQUEST_ADJUSTMENTS({ tx, case: kase, payload, user }) {
    const details = str(payload.adjustmentDetails);

    const sent = await tx.proposalVersion.findFirstOrThrow({
      where: { proposal: { caseId: kase.id }, status: ProposalVersionStatus.ENVIADA },
      orderBy: { versionNumber: 'desc' },
      select: { id: true, versionNumber: true, proposalId: true },
    });

    await tx.customerDecision.create({
      data: {
        caseId: kase.id,
        versionNumber: sent.versionNumber,
        decision: ClientDecisionType.SOLICITAR_AJUSTES,
        comments: str(payload.comments) || null,
        adjustmentDetails: details,
        decidedById: user?.id ?? null,
      },
    });

    await tx.proposalAdjustment.create({
      data: {
        proposalId: sent.proposalId,
        versionId: sent.id,
        details,
        requestedById: user?.id ?? null,
      },
    });

    const next = await supersedeAndCreateDraft(
      tx,
      kase.id,
      ProposalVersionStatus.ENVIADA,
      user?.id ?? null,
      'Versión para atender los ajustes solicitados por el cliente',
    );

    return { ...next, requestedVersion: sent.versionNumber };
  },

  async CLIENT_ACCEPT({ tx, case: kase, payload, user }) {
    const sent = await tx.proposalVersion.findFirstOrThrow({
      where: { proposal: { caseId: kase.id }, status: ProposalVersionStatus.ENVIADA },
      orderBy: { versionNumber: 'desc' },
      select: { id: true, versionNumber: true },
    });

    await tx.proposalVersion.update({
      where: { id: sent.id },
      data: { status: ProposalVersionStatus.ACEPTADA, acceptedAt: new Date() },
    });

    await tx.customerDecision.create({
      data: {
        caseId: kase.id,
        versionNumber: sent.versionNumber,
        decision: ClientDecisionType.ACEPTAR,
        comments: str(payload.comments) || null,
        decidedById: user?.id ?? null,
      },
    });

    return { acceptedVersion: sent.versionNumber };
  },

  async CLIENT_DECLINE({ tx, case: kase, payload, user }) {
    const sent = await tx.proposalVersion.findFirst({
      where: { proposal: { caseId: kase.id }, status: ProposalVersionStatus.ENVIADA },
      orderBy: { versionNumber: 'desc' },
      select: { versionNumber: true },
    });

    await tx.customerDecision.create({
      data: {
        caseId: kase.id,
        versionNumber: sent?.versionNumber ?? 0,
        decision: ClientDecisionType.NO_CONTINUAR,
        comments: str(payload.comments) || null,
        declineReasonCode: str(payload.declineReasonCode),
        reactivationPotential: str(payload.reactivationPotential) || null,
        decidedById: user?.id ?? null,
      },
    });

    await tx.case.update({
      where: { id: kase.id },
      data: {
        closedAt: new Date(),
        closedById: user?.id ?? null,
        closureReasonCode: str(payload.declineReasonCode),
        closureReason: str(payload.comments) || 'El cliente decidió no continuar',
        reactivationPotential: str(payload.reactivationPotential) || null,
      },
    });

    return { reasonCode: str(payload.declineReasonCode) };
  },

  // ------------------------------------------------------------- Punto 7 --
  async START_CONTRACTING({ tx, case: kase }) {
    const existing = await tx.contractChecklist.findUnique({
      where: { caseId: kase.id },
      select: { id: true },
    });
    if (existing) return { checklistId: existing.id };

    const template = await tx.checklistTemplate.findFirst({
      where: { kind: ChecklistKind.CONTRATACION, isActive: true },
      select: {
        code: true,
        items: { orderBy: { sortOrder: 'asc' } },
      },
    });

    if (!template) {
      throw new BusinessRuleError(
        'NO_CONTRACT_CHECKLIST_TEMPLATE',
        'No hay una plantilla de checklist de contratación (T7A) activa. Configúrela en administración.',
      );
    }

    const checklist = await tx.contractChecklist.create({
      data: {
        caseId: kase.id,
        templateCode: template.code,
        items: {
          create: template.items.map((item) => ({
            label: item.label,
            description: item.description,
            responsible: item.defaultResponsible,
            isRequired: item.isRequired,
            requiresEvidence: item.requiresEvidence,
            sortOrder: item.sortOrder,
            status: ChecklistItemStatus.PENDIENTE,
          })),
        },
      },
      select: { id: true, items: { select: { id: true } } },
    });

    return { checklistId: checklist.id, itemCount: checklist.items.length };
  },

  async AUTHORIZE_EXECUTION({ tx, case: kase, user }) {
    await tx.case.update({
      where: { id: kase.id },
      data: { authorizedAt: new Date(), authorizedById: user?.id ?? null },
    });
    return {};
  },

  // ------------------------------------------------------------- Punto 8 --
  async START_EXECUTION({ tx, case: kase }) {
    await tx.case.update({
      where: { id: kase.id },
      data: { executionStartedAt: new Date() },
    });
    return {};
  },

  async TECHNICAL_CLOSURE({ tx, case: kase, payload, user }) {
    await tx.closureDeclaration.upsert({
      where: { caseId: kase.id },
      create: {
        caseId: kase.id,
        statement: str(payload.statement),
        finalNotes: str(payload.finalNotes) || null,
        declaredById: user?.id ?? null,
      },
      update: {
        statement: str(payload.statement),
        finalNotes: str(payload.finalNotes) || null,
        declaredById: user?.id ?? null,
        revokedAt: null,
        revokeReason: null,
      },
    });

    // Se instancia el checklist de revisión final (T9C) en el momento en que
    // advisory lo necesita, no antes: así refleja la plantilla vigente ese día.
    const existing = await tx.closureChecklist.findUnique({
      where: { caseId: kase.id },
      select: { id: true },
    });

    if (!existing) {
      const template = await tx.checklistTemplate.findFirst({
        where: { kind: ChecklistKind.CIERRE, isActive: true },
        select: { code: true, items: { orderBy: { sortOrder: 'asc' } } },
      });

      if (template) {
        await tx.closureChecklist.create({
          data: {
            caseId: kase.id,
            templateCode: template.code,
            items: {
              create: template.items.map((item) => ({
                label: item.label,
                isRequired: item.isRequired,
                sortOrder: item.sortOrder,
                status: ChecklistItemStatus.PENDIENTE,
              })),
            },
          },
        });
      }
    }

    return {};
  },

  async REOPEN_EXECUTION({ tx, case: kase, payload, note }) {
    const reason = str(payload.reason) || str(note);
    await tx.closureDeclaration.updateMany({
      where: { caseId: kase.id, revokedAt: null },
      data: { revokedAt: new Date(), revokeReason: reason },
    });
    return { reason };
  },

  // ------------------------------------------------------------- Punto 9 --
  async CLOSE_CASE({ tx, case: kase, user }) {
    const response = await tx.customerClosureResponse.findUnique({
      where: { caseId: kase.id },
      select: { response: true },
    });

    await tx.case.update({
      where: { id: kase.id },
      data: {
        closedAt: new Date(),
        closedById: user?.id ?? null,
        closureReasonCode: 'CIERRE_FORMAL',
        closureReason:
          response?.response === 'CIERRE_CON_OBSERVACIONES'
            ? 'Cierre formal con observaciones del cliente'
            : 'Cierre formal con aceptación del cliente',
      },
    });

    return { clientResponse: response?.response ?? null };
  },
};

// ------------------------------------------------------------------ Helpers --

/** Congela el borrador vigente y lo pasa a QA. */
async function freezeDraftForQa({
  tx,
  case: kase,
}: EffectContext): Promise<{ versionNumber: number }> {
  const draft = await tx.proposalVersion.findFirstOrThrow({
    where: { proposal: { caseId: kase.id }, status: ProposalVersionStatus.BORRADOR },
    orderBy: { versionNumber: 'desc' },
    select: { id: true, versionNumber: true },
  });

  await tx.proposalVersion.update({
    where: { id: draft.id },
    data: { status: ProposalVersionStatus.EN_QA, frozenAt: new Date() },
  });

  return { versionNumber: draft.versionNumber };
}

/**
 * Marca la versión vigente como SUPERADA y crea la n+1 en borrador **copiando**
 * su contenido. Copiar y no mover es la clave de RF-042: la versión anterior
 * queda intacta e íntegra para siempre.
 */
async function supersedeAndCreateDraft(
  tx: EffectContext['tx'],
  caseId: string,
  fromStatus: ProposalVersionStatus,
  userId: string | null,
  changeNote: string,
): Promise<{ proposalId: string; versionNumber: number; supersededVersion: number }> {
  const current = await tx.proposalVersion.findFirstOrThrow({
    where: { proposal: { caseId }, status: fromStatus },
    orderBy: { versionNumber: 'desc' },
    select: { id: true, proposalId: true, versionNumber: true, analysis: true, content: true },
  });

  await tx.proposalVersion.update({
    where: { id: current.id },
    data: { status: ProposalVersionStatus.SUPERADA },
  });

  const proposal = await tx.proposal.findUniqueOrThrow({
    where: { id: current.proposalId },
    select: { currentVersionNumber: true },
  });

  const versionNumber = proposal.currentVersionNumber + 1;

  await tx.proposalVersion.create({
    data: {
      proposalId: current.proposalId,
      versionNumber,
      status: ProposalVersionStatus.BORRADOR,
      analysis: current.analysis ?? undefined,
      content: current.content ?? undefined,
      changeNote,
      createdById: userId,
    },
  });

  await tx.proposal.update({
    where: { id: current.proposalId },
    data: { currentVersionNumber: versionNumber },
  });

  return {
    proposalId: current.proposalId,
    versionNumber,
    supersededVersion: current.versionNumber,
  };
}

export const TRANSITION_EFFECTS: Readonly<Record<string, EffectFn>> = effects;
