import { Injectable } from '@nestjs/common';
import { CaseStatusCode, ChecklistItemStatus, Prisma, RoleCode } from '@prisma/client';
import { AuditService, type AuditActor } from '../../core/audit/audit.service';
import type { AuthenticatedUser } from '../../core/auth/auth.types';
import { CaseAccessService } from '../../core/auth/case-access.service';
import {
  BusinessRuleError,
  ForbiddenError,
  NotFoundError,
} from '../../core/common/errors/domain.errors';
import { PrismaService } from '../../core/prisma/prisma.service';
import type {
  ConsultantEvaluationDto,
  CustomerClosureResponseDto,
  CustomerEvaluationDto,
  UpdateClosureChecklistItemDto,
} from './dto/execution.dto';

/**
 * Cierre del caso (Punto 9): T9C checklist de revisión final, T9F aceptación del
 * cliente, T9G satisfacción y T9H desempeño del consultor.
 *
 * Ninguno de estos registros cierra el caso por sí mismo: la transición
 * `CLOSE_CASE` exige que los cuatro existan. Esto es lo que hace imposible
 * "cerrar un caso incompleto" (§25), y la comprobación vive en los guards del
 * workflow, no repartida por la interfaz.
 */
@Injectable()
export class ClosureService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly caseAccess: CaseAccessService,
  ) {}

  /** T9A — declaración de cierre técnico registrada por la transición. */
  async getDeclaration(user: AuthenticatedUser, caseId: string) {
    await this.caseAccess.assertCanRead(user, caseId);

    return this.prisma.closureDeclaration.findUnique({
      where: { caseId },
      select: {
        id: true,
        statement: true,
        finalNotes: true,
        revokedAt: true,
        revokeReason: true,
        createdAt: true,
        declaredBy: { select: { id: true, fullName: true } },
      },
    });
  }

  /** T9C — checklist de revisión final de cumplimiento. */
  async getChecklist(user: AuthenticatedUser, caseId: string) {
    await this.caseAccess.assertCanRead(user, caseId);

    const checklist = await this.prisma.closureChecklist.findUnique({
      where: { caseId },
      select: {
        id: true,
        templateCode: true,
        completedAt: true,
        items: {
          orderBy: { sortOrder: 'asc' },
          select: {
            id: true,
            label: true,
            isRequired: true,
            sortOrder: true,
            status: true,
            notes: true,
          },
        },
      },
    });

    if (!checklist) {
      throw new NotFoundError('el checklist de cierre del caso', caseId);
    }

    const required = checklist.items.filter((item) => item.isRequired);
    const settled = required.filter(
      (item) =>
        item.status === ChecklistItemStatus.CUMPLIDO ||
        item.status === ChecklistItemStatus.NO_APLICA,
    );

    return {
      ...checklist,
      progress: {
        requiredTotal: required.length,
        requiredSettled: settled.length,
        percent: required.length === 0 ? 100 : Math.round((settled.length / required.length) * 100),
        isComplete: settled.length === required.length,
      },
    };
  }

  async updateChecklistItem(
    user: AuthenticatedUser,
    caseId: string,
    itemId: string,
    dto: UpdateClosureChecklistItemDto,
    actor: AuditActor,
  ) {
    await this.caseAccess.assertFullAccess(user, caseId);

    if (user.role !== RoleCode.ADVISORY && user.role !== RoleCode.SUPER_ADMIN) {
      throw new ForbiddenError(
        'La revisión final de cumplimiento (T9C) la realiza Advisory',
        'CLOSURE_REVIEW_NOT_ALLOWED',
      );
    }

    const item = await this.prisma.closureChecklistItem.findFirst({
      where: { id: itemId, checklist: { caseId } },
      select: { id: true, label: true, status: true, notes: true },
    });
    if (!item) throw new NotFoundError('el ítem del checklist de cierre', itemId);

    const kase = await this.prisma.case.findUniqueOrThrow({
      where: { id: caseId },
      select: { companyId: true },
    });

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.closureChecklistItem.update({
        where: { id: itemId },
        data: { status: dto.status as ChecklistItemStatus, notes: dto.notes ?? item.notes },
        select: { id: true, label: true, status: true, notes: true },
      });

      await this.audit.record(tx, actor, {
        action: 'CLOSURE_ITEM_UPDATED',
        entity: 'ClosureChecklistItem',
        entityId: itemId,
        caseId,
        companyId: kase.companyId,
        previousValue: { status: item.status },
        newValue: { status: updated.status, label: updated.label },
        metadata: { template: 'T9C' },
      });

      const pending = await tx.closureChecklistItem.count({
        where: {
          checklist: { caseId },
          isRequired: true,
          status: { notIn: [ChecklistItemStatus.CUMPLIDO, ChecklistItemStatus.NO_APLICA] },
        },
      });

      await tx.closureChecklist.update({
        where: { caseId },
        data: { completedAt: pending === 0 ? new Date() : null },
      });

      return updated;
    });
  }

  /** T9F — aceptación u observaciones de cierre del cliente. */
  async registerClientResponse(
    user: AuthenticatedUser,
    caseId: string,
    dto: CustomerClosureResponseDto,
    actor: AuditActor,
  ) {
    await this.caseAccess.assertIsClientOwner(user, caseId);

    const kase = await this.assertReadyForClosure(caseId);

    if (dto.response !== 'ACEPTACION' && (dto.observations ?? '').trim().length < 20) {
      throw new BusinessRuleError(
        'CLOSURE_OBSERVATIONS_REQUIRED',
        'Registre las observaciones de cierre (mínimo 20 caracteres).',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const response = await tx.customerClosureResponse.upsert({
        where: { caseId },
        create: {
          caseId,
          response: dto.response,
          observations: dto.observations ?? null,
          respondedById: user.id,
        },
        update: {
          response: dto.response,
          observations: dto.observations ?? null,
          respondedById: user.id,
        },
        select: { id: true, response: true, observations: true, createdAt: true },
      });

      await this.audit.record(tx, actor, {
        action: 'CLOSURE_CLIENT_RESPONSE',
        entity: 'CustomerClosureResponse',
        entityId: response.id,
        caseId,
        companyId: kase.companyId,
        newValue: { response: response.response },
        metadata: { template: 'T9F' },
      });

      return response;
    });
  }

  /** T9G — encuesta de satisfacción del cliente. */
  async registerCustomerEvaluation(
    user: AuthenticatedUser,
    caseId: string,
    dto: CustomerEvaluationDto,
    actor: AuditActor,
  ) {
    await this.caseAccess.assertIsClientOwner(user, caseId);
    const kase = await this.assertReadyForClosure(caseId);

    return this.prisma.$transaction(async (tx) => {
      const evaluation = await tx.customerEvaluation.upsert({
        where: { caseId },
        create: { caseId, ...dto, submittedById: user.id },
        update: { ...dto, submittedById: user.id },
        select: {
          id: true,
          overallSatisfaction: true,
          serviceClarity: true,
          expectationFulfilment: true,
          perceivedValue: true,
          wouldReuse: true,
          comments: true,
          createdAt: true,
        },
      });

      await this.audit.record(tx, actor, {
        action: 'CUSTOMER_EVALUATION_REGISTERED',
        entity: 'CustomerEvaluation',
        entityId: evaluation.id,
        caseId,
        companyId: kase.companyId,
        newValue: { overallSatisfaction: evaluation.overallSatisfaction },
        metadata: { template: 'T9G' },
      });

      return evaluation;
    });
  }

  /**
   * T9H — evaluación de desempeño del consultor.
   *
   * Es la fuente de datos del futuro sistema de reputación: se guarda todo lo que
   * lo alimentaría (cumplimiento, tiempos, orden documental, QA, complejidad del
   * caso atendido), pero no se calcula ni se expone ninguna puntuación pública.
   */
  async registerConsultantEvaluation(
    user: AuthenticatedUser,
    caseId: string,
    dto: ConsultantEvaluationDto,
    actor: AuditActor,
  ) {
    await this.caseAccess.assertFullAccess(user, caseId);

    if (user.role !== RoleCode.ADVISORY && user.role !== RoleCode.SUPER_ADMIN) {
      throw new ForbiddenError(
        'La evaluación de desempeño del consultor la registra Advisory',
        'EVALUATION_NOT_ALLOWED',
      );
    }

    const kase = await this.assertReadyForClosure(caseId);

    const assignment = await this.prisma.caseAssignment.findFirst({
      where: { caseId, isPrimary: true, isActive: true },
      select: { consultantId: true, consultant: { select: { code: true } } },
    });
    if (!assignment) {
      throw new BusinessRuleError(
        'NO_PRIMARY_CONSULTANT',
        'El caso no tiene consultor responsable principal al que evaluar.',
      );
    }

    const overallScore =
      (dto.scopeCompliance +
        dto.timeCompliance +
        dto.documentationOrder +
        dto.processConsistency +
        dto.qaOutcome) /
      5;

    return this.prisma.$transaction(async (tx) => {
      const evaluation = await tx.consultantEvaluation.upsert({
        where: {
          caseId_consultantId: { caseId, consultantId: assignment.consultantId },
        },
        create: {
          caseId,
          consultantId: assignment.consultantId,
          ...dto,
          overallScore: new Prisma.Decimal(overallScore.toFixed(2)),
          caseComplexityCode: kase.complexityCode,
          evaluatedById: user.id,
        },
        update: {
          ...dto,
          overallScore: new Prisma.Decimal(overallScore.toFixed(2)),
          caseComplexityCode: kase.complexityCode,
          evaluatedById: user.id,
        },
        select: {
          id: true,
          scopeCompliance: true,
          timeCompliance: true,
          documentationOrder: true,
          processConsistency: true,
          qaOutcome: true,
          overallScore: true,
          comments: true,
          createdAt: true,
        },
      });

      await this.audit.record(tx, actor, {
        action: 'CONSULTANT_EVALUATION_REGISTERED',
        entity: 'ConsultantEvaluation',
        entityId: evaluation.id,
        caseId,
        companyId: kase.companyId,
        newValue: {
          consultantCode: assignment.consultant.code,
          overallScore: Number(evaluation.overallScore),
        },
        metadata: { template: 'T9H' },
      });

      return { ...evaluation, overallScore: Number(evaluation.overallScore) };
    });
  }

  /** Vista consolidada del cierre: qué hay y qué falta. */
  async summary(user: AuthenticatedUser, caseId: string) {
    await this.caseAccess.assertCanRead(user, caseId);

    const [declaration, checklist, clientResponse, customerEval, consultantEval] =
      await Promise.all([
        this.prisma.closureDeclaration.findUnique({
          where: { caseId },
          select: { id: true, createdAt: true, revokedAt: true },
        }),
        this.prisma.closureChecklist.findUnique({
          where: { caseId },
          select: {
            completedAt: true,
            items: {
              where: {
                isRequired: true,
                status: { notIn: [ChecklistItemStatus.CUMPLIDO, ChecklistItemStatus.NO_APLICA] },
              },
              select: { label: true },
            },
          },
        }),
        this.prisma.customerClosureResponse.findUnique({
          where: { caseId },
          select: { response: true, createdAt: true },
        }),
        this.prisma.customerEvaluation.findUnique({
          where: { caseId },
          select: { overallSatisfaction: true, createdAt: true },
        }),
        this.prisma.consultantEvaluation.findFirst({
          where: { caseId },
          select: { overallScore: true, createdAt: true },
        }),
      ]);

    const missing: string[] = [];
    if (!declaration || declaration.revokedAt) missing.push('Declaración de cierre técnico (T9A)');
    if (!checklist) missing.push('Checklist de revisión final (T9C)');
    else if (checklist.items.length > 0) {
      missing.push(`Checklist T9C: ${checklist.items.length} ítem(s) pendiente(s)`);
    }
    if (!clientResponse) missing.push('Aceptación u observaciones del cliente (T9F)');
    else if (clientResponse.response === 'SOLICITUD_AJUSTE_FINAL') {
      missing.push('El cliente solicitó un ajuste final pendiente de atender');
    }
    if (!customerEval) missing.push('Encuesta de satisfacción (T9G)');
    if (!consultantEval) missing.push('Evaluación de desempeño del consultor (T9H)');

    return {
      declaration,
      checklistComplete: Boolean(checklist?.completedAt),
      clientResponse,
      customerEvaluation: customerEval,
      consultantEvaluation: consultantEval
        ? { ...consultantEval, overallScore: Number(consultantEval.overallScore) }
        : null,
      canClose: missing.length === 0,
      missing,
    };
  }

  private async assertReadyForClosure(caseId: string) {
    const kase = await this.prisma.case.findUnique({
      where: { id: caseId },
      select: { id: true, status: true, companyId: true, complexityCode: true },
    });
    if (!kase) throw new NotFoundError('el caso', caseId);

    if (kase.status !== CaseStatusCode.LISTO_PARA_CIERRE) {
      throw new BusinessRuleError(
        'CASE_NOT_READY_FOR_CLOSURE',
        `El caso debe estar en LISTO PARA CIERRE para registrar el cierre. Estado actual: ${kase.status}.`,
        { status: kase.status },
      );
    }

    return kase;
  }
}
