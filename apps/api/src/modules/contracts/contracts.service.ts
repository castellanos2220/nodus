import { Injectable } from '@nestjs/common';
import { ChecklistItemStatus, ChecklistKind } from '@prisma/client';
import { AuditService, type AuditActor } from '../../core/audit/audit.service';
import type { AuthenticatedUser } from '../../core/auth/auth.types';
import { CaseAccessService } from '../../core/auth/case-access.service';
import { BusinessRuleError, NotFoundError } from '../../core/common/errors/domain.errors';
import { PrismaService } from '../../core/prisma/prisma.service';
import type {
  CreateContractEvidenceDto,
  UpdateChecklistItemDto,
  UpsertOperationalFrameworkDto,
} from './dto/contracts.dto';

/**
 * Contratación (Punto 7).
 *
 * Principio rector, y por eso no existe una entidad `Contract` en el modelo:
 * **NODUS no es parte contractual**. La relación contractual es Mipyme ↔
 * consultor y se formaliza fuera de la plataforma. Lo que NODUS hace —y controla
 * en base de datos— es la veeduría del proceso: checklist (T7A), evidencias
 * (T7C), marco operativo (T7B) e incidencias (T7D), y el bloqueo de la ejecución
 * hasta que los mínimos estén cumplidos (RF-070).
 */
@Injectable()
export class ContractsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly caseAccess: CaseAccessService,
  ) {}

  async getChecklist(user: AuthenticatedUser, caseId: string) {
    await this.caseAccess.assertCanRead(user, caseId);

    const checklist = await this.prisma.contractChecklist.findUnique({
      where: { caseId },
      select: {
        id: true,
        templateCode: true,
        completedAt: true,
        createdAt: true,
        items: {
          orderBy: { sortOrder: 'asc' },
          select: {
            id: true,
            label: true,
            description: true,
            responsible: true,
            isRequired: true,
            requiresEvidence: true,
            sortOrder: true,
            status: true,
            targetDate: true,
            completedDate: true,
            notes: true,
            evidences: {
              select: { id: true, title: true, documentId: true, createdAt: true },
            },
          },
        },
      },
    });

    if (!checklist) {
      throw new NotFoundError('el checklist de contratación del caso', caseId);
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
        pending: required
          .filter((item) => !settled.includes(item))
          .map((item) => item.label),
      },
    };
  }

  async updateItem(
    user: AuthenticatedUser,
    caseId: string,
    itemId: string,
    dto: UpdateChecklistItemDto,
    actor: AuditActor,
  ) {
    await this.caseAccess.assertFullAccess(user, caseId);

    const item = await this.prisma.contractChecklistItem.findUnique({
      where: { id: itemId },
      select: {
        id: true,
        label: true,
        status: true,
        requiresEvidence: true,
        responsible: true,
        targetDate: true,
        completedDate: true,
        notes: true,
        checklist: { select: { caseId: true, case: { select: { companyId: true } } } },
        _count: { select: { evidences: true } },
      },
    });

    if (!item || item.checklist.caseId !== caseId) {
      throw new NotFoundError('el ítem del checklist', itemId);
    }

    // Un ítem que exige evidencia no puede marcarse cumplido sin ella: es el
    // control documental que da sentido a la veeduría.
    if (
      dto.status === ChecklistItemStatus.CUMPLIDO &&
      item.requiresEvidence &&
      item._count.evidences === 0
    ) {
      throw new BusinessRuleError(
        'EVIDENCE_REQUIRED',
        `El ítem "${item.label}" requiere evidencia registrada antes de marcarse como cumplido.`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.contractChecklistItem.update({
        where: { id: itemId },
        data: {
          status: dto.status,
          responsible: dto.responsible ?? item.responsible,
          targetDate: dto.targetDate ?? item.targetDate,
          completedDate:
            dto.status === ChecklistItemStatus.CUMPLIDO
              ? (dto.completedDate ?? new Date())
              : null,
          notes: dto.notes ?? item.notes,
        },
        select: {
          id: true,
          label: true,
          status: true,
          responsible: true,
          targetDate: true,
          completedDate: true,
          notes: true,
        },
      });

      await this.audit.record(tx, actor, {
        action: 'CONTRACT_ITEM_UPDATED',
        entity: 'ContractChecklistItem',
        entityId: itemId,
        caseId,
        companyId: item.checklist.case.companyId,
        previousValue: { status: item.status },
        newValue: { status: updated.status, label: updated.label },
        metadata: { template: 'T7A' },
      });

      // Si tras este cambio todo lo obligatorio está resuelto, se sella la fecha
      // de completitud del checklist para poder medir el tiempo de formalización.
      const pending = await tx.contractChecklistItem.count({
        where: {
          checklist: { caseId },
          isRequired: true,
          status: { notIn: [ChecklistItemStatus.CUMPLIDO, ChecklistItemStatus.NO_APLICA] },
        },
      });

      await tx.contractChecklist.update({
        where: { caseId },
        data: { completedAt: pending === 0 ? new Date() : null },
      });

      return updated;
    });
  }

  /** T7C — evidencia contractual. NODUS asocia el soporte, no valida su contenido legal. */
  async addEvidence(
    user: AuthenticatedUser,
    caseId: string,
    dto: CreateContractEvidenceDto,
    actor: AuditActor,
  ) {
    await this.caseAccess.assertFullAccess(user, caseId);

    const kase = await this.prisma.case.findUniqueOrThrow({
      where: { id: caseId },
      select: { companyId: true },
    });

    if (dto.itemId) {
      const item = await this.prisma.contractChecklistItem.findFirst({
        where: { id: dto.itemId, checklist: { caseId } },
        select: { id: true },
      });
      if (!item) throw new NotFoundError('el ítem del checklist', dto.itemId);
    }

    return this.prisma.$transaction(async (tx) => {
      const evidence = await tx.contractEvidence.create({
        data: {
          caseId,
          itemId: dto.itemId ?? null,
          title: dto.title,
          description: dto.description ?? null,
          documentId: dto.documentId ?? null,
          registeredById: user.id,
        },
        select: { id: true, title: true, documentId: true, createdAt: true },
      });

      await this.audit.record(tx, actor, {
        action: 'CONTRACT_EVIDENCE_REGISTERED',
        entity: 'ContractEvidence',
        entityId: evidence.id,
        caseId,
        companyId: kase.companyId,
        newValue: { title: evidence.title, documentId: evidence.documentId },
        metadata: { template: 'T7C' },
      });

      return evidence;
    });
  }

  async listEvidences(user: AuthenticatedUser, caseId: string) {
    await this.caseAccess.assertCanRead(user, caseId);

    return this.prisma.contractEvidence.findMany({
      where: { caseId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        description: true,
        documentId: true,
        createdAt: true,
        item: { select: { id: true, label: true } },
        registeredBy: { select: { id: true, fullName: true } },
      },
    });
  }

  /** T7B — marco operativo del servicio formalizado. Lo carga el consultor. */
  async upsertOperationalFramework(
    user: AuthenticatedUser,
    caseId: string,
    dto: UpsertOperationalFrameworkDto,
    actor: AuditActor,
  ) {
    await this.caseAccess.assertIsLeadConsultant(user, caseId);

    const kase = await this.prisma.case.findUniqueOrThrow({
      where: { id: caseId },
      select: { companyId: true },
    });

    const existing = await this.prisma.operationalFramework.findUnique({
      where: { caseId },
      select: { id: true },
    });

    return this.prisma.$transaction(async (tx) => {
      const framework = await tx.operationalFramework.upsert({
        where: { caseId },
        create: { caseId, ...dto, uploadedById: user.id },
        update: { ...dto, uploadedById: user.id },
        select: {
          id: true,
          operatingConditions: true,
          estimatedDurationDays: true,
          baselineSchedule: true,
          committedDeliverables: true,
          clientDependencies: true,
          assumptions: true,
          executionConstraints: true,
          primaryContact: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      await this.audit.record(tx, actor, {
        action: existing ? 'OPERATIONAL_FRAMEWORK_UPDATED' : 'OPERATIONAL_FRAMEWORK_UPLOADED',
        entity: 'OperationalFramework',
        entityId: framework.id,
        caseId,
        companyId: kase.companyId,
        newValue: { estimatedDurationDays: framework.estimatedDurationDays },
        metadata: { template: 'T7B' },
      });

      return framework;
    });
  }

  async getOperationalFramework(user: AuthenticatedUser, caseId: string) {
    await this.caseAccess.assertCanRead(user, caseId);

    const framework = await this.prisma.operationalFramework.findUnique({
      where: { caseId },
      select: {
        id: true,
        operatingConditions: true,
        estimatedDurationDays: true,
        baselineSchedule: true,
        committedDeliverables: true,
        clientDependencies: true,
        assumptions: true,
        executionConstraints: true,
        primaryContact: true,
        createdAt: true,
        updatedAt: true,
        uploadedBy: { select: { id: true, fullName: true } },
      },
    });

    if (!framework) throw new NotFoundError('el marco operativo del caso', caseId);
    return framework;
  }

  /** Plantillas de checklist disponibles, para administración. */
  async listTemplates(kind?: ChecklistKind) {
    return this.prisma.checklistTemplate.findMany({
      where: kind ? { kind } : {},
      orderBy: [{ kind: 'asc' }, { code: 'asc' }],
      select: {
        id: true,
        kind: true,
        code: true,
        name: true,
        isActive: true,
        items: {
          orderBy: { sortOrder: 'asc' },
          select: {
            id: true,
            label: true,
            description: true,
            isRequired: true,
            requiresEvidence: true,
            sortOrder: true,
          },
        },
      },
    });
  }
}
