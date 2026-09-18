import { Injectable } from '@nestjs/common';
import { CaseStatusCode, EligibilityResult } from '@prisma/client';
import { AuditService, type AuditActor } from '../../core/audit/audit.service';
import type { AuthenticatedUser } from '../../core/auth/auth.types';
import { CaseAccessService } from '../../core/auth/case-access.service';
import { BusinessRuleError, NotFoundError } from '../../core/common/errors/domain.errors';
import { PrismaService } from '../../core/prisma/prisma.service';
import { LookupsService } from '../lookups/lookups.service';
import type { ClassifyCaseDto } from './dto/classifications.dto';

/**
 * T2 — Evaluación, clasificación y habilitación del caso.
 *
 * Registrar una clasificación **no** cambia el estado del caso: lo hace la
 * transición `CLASSIFY`, que exige que exista una clasificación completa y
 * elegible. Están separados a propósito — advisory puede iterar la clasificación
 * mientras estudia el caso, y sólo cuando está conforme lo habilita.
 *
 * Cada reclasificación inserta una fila nueva y marca la anterior
 * `isCurrent = false` (RF-025): el historial nunca se pierde.
 */
@Injectable()
export class ClassificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly lookups: LookupsService,
    private readonly caseAccess: CaseAccessService,
  ) {}

  async classify(
    user: AuthenticatedUser,
    caseId: string,
    dto: ClassifyCaseDto,
    actor: AuditActor,
  ) {
    await this.caseAccess.assertFullAccess(user, caseId);

    const kase = await this.prisma.case.findUnique({
      where: { id: caseId },
      select: { id: true, status: true, companyId: true, code: true },
    });
    if (!kase) throw new NotFoundError('el caso', caseId);

    // Clasificar tiene sentido durante la debida diligencia y para reclasificar
    // un caso ya clasificado que aún no se publicó.
    const allowed: CaseStatusCode[] = [CaseStatusCode.EN_REVISION, CaseStatusCode.CLASIFICADO];
    if (!allowed.includes(kase.status)) {
      throw new BusinessRuleError(
        'CLASSIFICATION_NOT_ALLOWED_IN_STATUS',
        `Sólo se puede clasificar un caso en revisión o ya clasificado. Estado actual: ${kase.status}.`,
        { status: kase.status },
      );
    }

    return this.prisma.$transaction(async (tx) => {
      await this.lookups.assertValidCodes(tx, [
        { listCode: 'AREA_PROBLEMA', value: dto.areaCode, fieldLabel: 'área' },
        { listCode: 'SUBAREA', value: dto.subAreaCode, fieldLabel: 'subárea' },
        {
          listCode: 'TIPO_INTERVENCION',
          value: dto.interventionTypeCode,
          fieldLabel: 'tipo de intervención',
        },
        { listCode: 'COMPLEJIDAD', value: dto.complexityCode, fieldLabel: 'complejidad' },
        { listCode: 'IMPACTO', value: dto.impactCode, fieldLabel: 'impacto' },
        { listCode: 'URGENCIA', value: dto.urgencyCode, fieldLabel: 'urgencia' },
      ]);

      const previous = await tx.caseClassification.findFirst({
        where: { caseId, isCurrent: true },
        select: {
          id: true,
          areaCode: true,
          interventionTypeCode: true,
          complexityCode: true,
          impactCode: true,
          urgencyCode: true,
          eligibility: true,
        },
      });

      if (previous) {
        await tx.caseClassification.update({
          where: { id: previous.id },
          data: { isCurrent: false },
        });
      }

      const classification = await tx.caseClassification.create({
        data: {
          caseId,
          areaCode: dto.areaCode,
          subAreaCode: dto.subAreaCode ?? null,
          interventionTypeCode: dto.interventionTypeCode,
          complexityCode: dto.complexityCode,
          impactCode: dto.impactCode,
          urgencyCode: dto.urgencyCode,
          eligibility: dto.eligibility,
          reviewNotes: dto.reviewNotes,
          clarityScore: dto.clarityScore ?? null,
          completenessScore: dto.completenessScore ?? null,
          classifiedById: user.id,
          isCurrent: true,
        },
        select: {
          id: true,
          areaCode: true,
          subAreaCode: true,
          interventionTypeCode: true,
          complexityCode: true,
          impactCode: true,
          urgencyCode: true,
          eligibility: true,
          reviewNotes: true,
          createdAt: true,
        },
      });

      // Si el caso ya estaba clasificado, la denormalización se actualiza aquí;
      // si aún no lo está, la aplicará la transición CLASSIFY al confirmar.
      if (kase.status === CaseStatusCode.CLASIFICADO) {
        await tx.case.update({
          where: { id: caseId },
          data: {
            areaCode: classification.areaCode,
            subAreaCode: classification.subAreaCode,
            interventionTypeCode: classification.interventionTypeCode,
            complexityCode: classification.complexityCode,
            impactCode: classification.impactCode,
            urgencyCode: classification.urgencyCode,
          },
        });
      }

      await this.audit.record(tx, actor, {
        action: previous ? 'CASE_RECLASSIFIED' : 'CASE_CLASSIFIED',
        entity: 'CaseClassification',
        entityId: classification.id,
        caseId,
        companyId: kase.companyId,
        previousValue: previous ?? null,
        newValue: {
          areaCode: classification.areaCode,
          interventionTypeCode: classification.interventionTypeCode,
          complexityCode: classification.complexityCode,
          impactCode: classification.impactCode,
          urgencyCode: classification.urgencyCode,
          eligibility: classification.eligibility,
        },
        metadata: { template: 'T2' },
      });

      return classification;
    });
  }

  /** Historial completo de clasificaciones y reclasificaciones (RF-025). */
  async history(user: AuthenticatedUser, caseId: string) {
    await this.caseAccess.assertFullAccess(user, caseId);

    return this.prisma.caseClassification.findMany({
      where: { caseId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        areaCode: true,
        subAreaCode: true,
        interventionTypeCode: true,
        complexityCode: true,
        impactCode: true,
        urgencyCode: true,
        eligibility: true,
        reviewNotes: true,
        clarityScore: true,
        completenessScore: true,
        isCurrent: true,
        confirmedAt: true,
        createdAt: true,
        classifiedBy: { select: { id: true, fullName: true } },
      },
    });
  }

  /** Utilidad de lectura para el frontend: ¿qué falta para poder clasificar? */
  async eligibilitySummary(user: AuthenticatedUser, caseId: string) {
    await this.caseAccess.assertFullAccess(user, caseId);

    const current = await this.prisma.caseClassification.findFirst({
      where: { caseId, isCurrent: true },
      select: {
        areaCode: true,
        interventionTypeCode: true,
        complexityCode: true,
        impactCode: true,
        urgencyCode: true,
        eligibility: true,
      },
    });

    if (!current) {
      return { hasClassification: false, isEligible: false, missing: ['clasificación T2'] };
    }

    const missing = (
      [
        ['areaCode', 'área'],
        ['interventionTypeCode', 'tipo de intervención'],
        ['complexityCode', 'complejidad'],
        ['impactCode', 'impacto'],
        ['urgencyCode', 'urgencia'],
      ] as const
    )
      .filter(([field]) => !current[field])
      .map(([, label]) => label);

    return {
      hasClassification: true,
      isEligible: current.eligibility === EligibilityResult.ELEGIBLE && missing.length === 0,
      eligibility: current.eligibility,
      missing,
    };
  }
}
