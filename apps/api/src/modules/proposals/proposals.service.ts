import { Injectable } from '@nestjs/common';
import { Prisma, ProposalVersionStatus, RoleCode } from '@prisma/client';
import { AuditService, type AuditActor } from '../../core/audit/audit.service';
import type { AuthenticatedUser } from '../../core/auth/auth.types';
import { CaseAccessService } from '../../core/auth/case-access.service';
import { BusinessRuleError, NotFoundError } from '../../core/common/errors/domain.errors';
import { PrismaService } from '../../core/prisma/prisma.service';
import type { UpdateProposalVersionDto } from './dto/proposals.dto';

/**
 * Expediente de propuesta (Punto 4).
 *
 * Reglas que este servicio hace cumplir:
 *
 *  · **Sólo se edita el borrador.** Una versión con `frozenAt` es inmutable; el
 *    servicio la rechaza y, por debajo, un trigger de PostgreSQL la rechaza
 *    también. Dos cierres independientes para la misma regla, porque
 *    "no sobrescribir versiones anteriores" (RF-042) es de las que no se pueden
 *    romper ni por error.
 *  · **Sólo el consultor responsable edita.** Advisory revisa; no redacta.
 *  · El historial completo de versiones queda disponible siempre.
 */
@Injectable()
export class ProposalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly caseAccess: CaseAccessService,
  ) {}

  /** Expediente completo: versiones, revisiones y solicitudes de ajuste. */
  async findByCase(user: AuthenticatedUser, caseId: string) {
    const access = await this.caseAccess.assertCanRead(user, caseId);

    const proposal = await this.prisma.proposal.findUnique({
      where: { caseId },
      select: {
        id: true,
        caseId: true,
        currentVersionNumber: true,
        createdAt: true,
        versions: {
          orderBy: { versionNumber: 'desc' },
          select: {
            id: true,
            versionNumber: true,
            status: true,
            analysis: true,
            content: true,
            changeNote: true,
            frozenAt: true,
            sentAt: true,
            acceptedAt: true,
            createdAt: true,
            createdBy: { select: { id: true, fullName: true } },
          },
        },
        reviews: {
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            type: true,
            outcome: true,
            checklist: true,
            observations: true,
            createdAt: true,
            version: { select: { versionNumber: true } },
            reviewer: {
              select: { id: true, fullName: true, role: { select: { code: true } } },
            },
          },
        },
        adjustments: {
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            details: true,
            response: true,
            respondedAt: true,
            createdAt: true,
            version: { select: { versionNumber: true } },
            requestedBy: { select: { id: true, fullName: true } },
          },
        },
      },
    });

    if (!proposal) {
      throw new NotFoundError('la propuesta del caso', caseId);
    }

    const canEdit = access.isLeadConsultant;

    return {
      ...proposal,
      versions: proposal.versions.map((version) => ({
        ...version,
        isEditable: canEdit && version.status === ProposalVersionStatus.BORRADOR,
      })),
      reviews: proposal.reviews.map((review) => ({
        ...review,
        versionNumber: review.version.versionNumber,
        reviewer: review.reviewer
          ? {
              id: review.reviewer.id,
              fullName: review.reviewer.fullName,
              role: review.reviewer.role.code,
            }
          : null,
        version: undefined,
      })),
      adjustments: proposal.adjustments.map((adjustment) => ({
        ...adjustment,
        versionNumber: adjustment.version.versionNumber,
        version: undefined,
      })),
    };
  }

  async findVersion(user: AuthenticatedUser, versionId: string) {
    const version = await this.prisma.proposalVersion.findUnique({
      where: { id: versionId },
      select: {
        id: true,
        versionNumber: true,
        status: true,
        analysis: true,
        content: true,
        changeNote: true,
        frozenAt: true,
        sentAt: true,
        acceptedAt: true,
        createdAt: true,
        createdBy: { select: { id: true, fullName: true } },
        proposal: { select: { caseId: true } },
      },
    });
    if (!version) throw new NotFoundError('la versión de propuesta', versionId);

    await this.caseAccess.assertCanRead(user, version.proposal.caseId);
    return version;
  }

  /**
   * Edita el borrador vigente (TP4B análisis + TP4C contenido).
   *
   * Sólo el consultor responsable principal. La versión debe estar en
   * `BORRADOR`: cualquier otra cosa exige crear una versión nueva, que es lo que
   * hacen las transiciones del workflow.
   */
  async updateVersion(
    user: AuthenticatedUser,
    versionId: string,
    dto: UpdateProposalVersionDto,
    actor: AuditActor,
  ) {
    const version = await this.prisma.proposalVersion.findUnique({
      where: { id: versionId },
      select: {
        id: true,
        versionNumber: true,
        status: true,
        frozenAt: true,
        analysis: true,
        content: true,
        proposal: { select: { caseId: true, case: { select: { companyId: true } } } },
      },
    });
    if (!version) throw new NotFoundError('la versión de propuesta', versionId);

    const caseId = version.proposal.caseId;
    await this.caseAccess.assertIsLeadConsultant(user, caseId);

    if (version.frozenAt || version.status !== ProposalVersionStatus.BORRADOR) {
      throw new BusinessRuleError(
        'PROPOSAL_VERSION_FROZEN',
        `La versión ${version.versionNumber} está en estado ${version.status} y no admite cambios. ` +
          'Para modificarla debe generarse una versión nueva desde el flujo de QA.',
        { versionNumber: version.versionNumber, status: version.status },
      );
    }

    // Se fusiona con lo existente para permitir guardado por bloques: el
    // formulario de propuesta es largo y se guarda por secciones.
    const analysis = {
      ...((version.analysis ?? {}) as Record<string, unknown>),
      ...(dto.analysis ?? {}),
    };
    const content = {
      ...((version.content ?? {}) as Record<string, unknown>),
      ...(dto.content ?? {}),
    };

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.proposalVersion.update({
        where: { id: versionId },
        data: {
          analysis: analysis as Prisma.InputJsonValue,
          content: content as Prisma.InputJsonValue,
          changeNote: dto.changeNote ?? version.status,
        },
        select: {
          id: true,
          versionNumber: true,
          status: true,
          analysis: true,
          content: true,
          changeNote: true,
          createdAt: true,
        },
      });

      await this.audit.record(tx, actor, {
        action: 'PROPOSAL_VERSION_UPDATED',
        entity: 'ProposalVersion',
        entityId: versionId,
        caseId,
        companyId: version.proposal.case.companyId,
        // Se auditan las secciones tocadas, no su contenido completo: la
        // bitácora es una traza, no una copia de la propuesta.
        newValue: {
          versionNumber: version.versionNumber,
          analysisSections: Object.keys(dto.analysis ?? {}),
          contentSections: Object.keys(dto.content ?? {}),
        },
        metadata: { template: 'TP4B/TP4C' },
      });

      return { ...updated, isEditable: true };
    });
  }

  /** Comparación entre dos versiones, para revisar qué cambió. */
  async diff(user: AuthenticatedUser, caseId: string, fromVersion: number, toVersion: number) {
    await this.caseAccess.assertCanRead(user, caseId);

    const versions = await this.prisma.proposalVersion.findMany({
      where: {
        proposal: { caseId },
        versionNumber: { in: [fromVersion, toVersion] },
      },
      select: { versionNumber: true, analysis: true, content: true },
    });

    const from = versions.find((version) => version.versionNumber === fromVersion);
    const to = versions.find((version) => version.versionNumber === toVersion);

    if (!from || !to) {
      throw new NotFoundError('una de las versiones solicitadas');
    }

    const sections = new Set([
      ...Object.keys((from.content ?? {}) as object),
      ...Object.keys((to.content ?? {}) as object),
    ]);

    const changes = [...sections]
      .map((section) => {
        const before = ((from.content ?? {}) as Record<string, string>)[section] ?? '';
        const after = ((to.content ?? {}) as Record<string, string>)[section] ?? '';
        return { section, before, after, changed: before !== after };
      })
      .filter((change) => change.changed);

    return { fromVersion, toVersion, changes };
  }

  /** Propuestas pendientes de revisión, para la bandeja de Advisory. */
  async pendingReview(user: AuthenticatedUser) {
    if (user.role !== RoleCode.ADVISORY && user.role !== RoleCode.SUPER_ADMIN && user.role !== RoleCode.CONSULTOR_REVISOR) {
      return [];
    }

    return this.prisma.proposalVersion.findMany({
      where: { status: ProposalVersionStatus.EN_QA },
      orderBy: { frozenAt: 'asc' },
      select: {
        id: true,
        versionNumber: true,
        frozenAt: true,
        proposal: {
          select: {
            caseId: true,
            case: {
              select: {
                code: true,
                title: true,
                status: true,
                complexityCode: true,
                company: { select: { name: true } },
              },
            },
          },
        },
        reviews: {
          select: { id: true, type: true, outcome: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
  }
}
