import { Injectable } from '@nestjs/common';
import { Prisma, ProposalVersionStatus, ReviewType, RoleCode } from '@prisma/client';
import { AuditService, type AuditActor } from '../../core/audit/audit.service';
import type { AuthenticatedUser } from '../../core/auth/auth.types';
import { CaseAccessService } from '../../core/auth/case-access.service';
import {
  BusinessRuleError,
  ForbiddenError,
  NotFoundError,
} from '../../core/common/errors/domain.errors';
import { domainEvent } from '../../core/events/domain-events';
import { EventBusService } from '../../core/events/event-bus.service';
import { PrismaService } from '../../core/prisma/prisma.service';
import type { CreateReviewDto } from './dto/proposals.dto';

/**
 * QA de propuestas (Punto 5).
 *
 * Dos tipos de revisión, con responsabilidades distintas:
 *
 *  · **METODOLOGICA (TP4H)** — la hace Advisory. Es la que habilita el envío al
 *    cliente: sin una revisión metodológica aprobada, la transición
 *    `APPROVE_AND_SEND` no pasa.
 *  · **PEER** — revisión experta independiente, opcional, de un consultor
 *    revisor. Enriquece técnicamente pero **no** sustituye a la metodológica ni
 *    genera responsabilidad sobre la solución. Ver `docs/architecture/
 *    source-discrepancies.md` D-03 sobre su alcance en el MVP.
 *
 * Registrar una revisión **no** mueve el caso: eso lo hacen las transiciones,
 * que comprueban que la revisión existe con el resultado adecuado.
 */
@Injectable()
export class ReviewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly events: EventBusService,
    private readonly caseAccess: CaseAccessService,
  ) {}

  async create(
    user: AuthenticatedUser,
    caseId: string,
    dto: CreateReviewDto,
    actor: AuditActor,
  ) {
    await this.caseAccess.assertCanRead(user, caseId);

    // Un consultor revisor sólo puede emitir peer reviews; la revisión
    // metodológica es responsabilidad indelegable de Advisory.
    if (user.role === RoleCode.CONSULTOR_REVISOR && dto.type !== ReviewType.PEER) {
      throw new ForbiddenError(
        'Un consultor revisor sólo puede registrar revisiones de tipo PEER',
        'REVIEW_TYPE_NOT_ALLOWED',
      );
    }
    if (
      dto.type === ReviewType.METODOLOGICA &&
      user.role !== RoleCode.ADVISORY &&
      user.role !== RoleCode.SUPER_ADMIN
    ) {
      throw new ForbiddenError(
        'La revisión metodológica (TP4H) sólo puede registrarla Advisory',
        'REVIEW_TYPE_NOT_ALLOWED',
      );
    }

    const version = await this.prisma.proposalVersion.findFirst({
      where: { proposal: { caseId }, status: ProposalVersionStatus.EN_QA },
      orderBy: { versionNumber: 'desc' },
      select: {
        id: true,
        versionNumber: true,
        proposalId: true,
        proposal: { select: { case: { select: { code: true, title: true, companyId: true } } } },
      },
    });

    if (!version) {
      throw new BusinessRuleError(
        'NO_VERSION_IN_QA',
        'No hay ninguna versión de propuesta en QA para revisar.',
      );
    }

    const collector = this.events.collector();

    const review = await this.prisma.$transaction(async (tx) => {
      const created = await tx.proposalReview.create({
        data: {
          proposalId: version.proposalId,
          versionId: version.id,
          type: dto.type,
          outcome: dto.outcome,
          checklist: dto.checklist as unknown as Prisma.InputJsonValue,
          observations: dto.observations ?? null,
          reviewerId: user.id,
        },
        select: {
          id: true,
          type: true,
          outcome: true,
          checklist: true,
          observations: true,
          createdAt: true,
        },
      });

      await this.audit.record(tx, actor, {
        action: 'PROPOSAL_REVIEW_CREATED',
        entity: 'ProposalReview',
        entityId: created.id,
        caseId,
        companyId: version.proposal.case.companyId,
        newValue: {
          type: created.type,
          outcome: created.outcome,
          versionNumber: version.versionNumber,
        },
        metadata: { template: dto.type === ReviewType.METODOLOGICA ? 'TP4H' : 'PEER_REVIEW' },
      });

      collector.add(
        domainEvent('ProposalReviewed', {
          actorId: user.id,
          caseId,
          companyId: version.proposal.case.companyId,
          payload: {
            caseCode: version.proposal.case.code,
            caseTitle: version.proposal.case.title,
            versionNumber: version.versionNumber,
            type: created.type,
            outcome: created.outcome,
            observations: created.observations,
          },
        }),
      );

      return { ...created, versionNumber: version.versionNumber };
    });

    await collector.flush();
    return review;
  }

  async findByCase(user: AuthenticatedUser, caseId: string) {
    await this.caseAccess.assertCanRead(user, caseId);

    const reviews = await this.prisma.proposalReview.findMany({
      where: { proposal: { caseId } },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        type: true,
        outcome: true,
        checklist: true,
        observations: true,
        createdAt: true,
        version: { select: { versionNumber: true } },
        reviewer: { select: { id: true, fullName: true, role: { select: { code: true } } } },
      },
    });

    if (reviews.length === 0) {
      const exists = await this.prisma.proposal.findUnique({
        where: { caseId },
        select: { id: true },
      });
      if (!exists) throw new NotFoundError('la propuesta del caso', caseId);
    }

    return reviews.map((review) => ({
      id: review.id,
      versionNumber: review.version.versionNumber,
      type: review.type,
      outcome: review.outcome,
      checklist: review.checklist,
      observations: review.observations,
      createdAt: review.createdAt,
      reviewer: review.reviewer
        ? {
            id: review.reviewer.id,
            fullName: review.reviewer.fullName,
            role: review.reviewer.role.code,
          }
        : null,
    }));
  }
}
