import { Injectable } from '@nestjs/common';
import {
  ApplicationStatus,
  CaseStatusCode,
  ConsultantStatus,
  Prisma,
  RoleCode,
} from '@prisma/client';
import { COMPLEXITY_RANK } from '@nodus/types';
import { AuditService, type AuditActor } from '../../core/audit/audit.service';
import type { AuthenticatedUser } from '../../core/auth/auth.types';
import { CaseAccessService } from '../../core/auth/case-access.service';
import {
  BusinessRuleError,
  ForbiddenError,
  NotFoundError,
} from '../../core/common/errors/domain.errors';
import { paginate, type PaginatedResult } from '../../core/common/dto/pagination.dto';
import { truncateWords } from '../../core/common/utils/text.util';
import { domainEvent } from '../../core/events/domain-events';
import { EventBusService } from '../../core/events/event-bus.service';
import { PrismaService } from '../../core/prisma/prisma.service';
import type { ApplyDto, OpportunityQueryDto } from './dto/applications.dto';

/** Lo que un consultor ve de un caso publicado: suficiente para decidir, nada más. */
const OPPORTUNITY_SUMMARY_CHARS = 420;

/**
 * Bolsa interna, postulación (T3C) y consulta de postulaciones.
 *
 * La bolsa **no es un marketplace abierto** (Punto 3 del blueprint): es un
 * espacio curado. Un consultor sólo ve los casos para los que es elegible, y la
 * elegibilidad se calcula en la consulta SQL — no filtrando en el cliente ni
 * ocultando tarjetas en el frontend.
 */
@Injectable()
export class ApplicationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly events: EventBusService,
    private readonly caseAccess: CaseAccessService,
  ) {}

  /**
   * Oportunidades elegibles para el consultor autenticado.
   *
   * Criterios de elegibilidad (RF-027, RF-028):
   *  · el consultor está `HABILITADO`;
   *  · el caso está en `EN_POSTULACION` y dentro del plazo;
   *  · la complejidad del caso no supera la máxima habilitada del consultor;
   *  · el tipo de intervención está en el alcance del consultor;
   *  · el área del caso coincide con alguna de sus especialidades.
   */
  async opportunities(
    user: AuthenticatedUser,
    query: OpportunityQueryDto,
  ): Promise<PaginatedResult<OpportunityView>> {
    const consultant = await this.requireEnabledConsultant(user);

    const specialtyCodes = consultant.specialties.map((item) => item.specialtyCode);
    const interventionCodes = consultant.scope?.interventionTypeCodes ?? [];
    const sectorCodes = consultant.scope?.sectorCodes ?? [];
    const maxRank = consultant.maxComplexityCode
      ? (COMPLEXITY_RANK[consultant.maxComplexityCode] ?? 99)
      : 99;

    // Las complejidades permitidas se resuelven aquí y se pasan como lista al
    // `where`, para que el filtro por complejidad viaje al índice
    // `(status, areaCode, complexityCode)` y no se evalúe fila a fila.
    const allowedComplexities = Object.entries(COMPLEXITY_RANK)
      .filter(([, rank]) => rank <= maxRank)
      .map(([code]) => code);

    const and: Prisma.CaseWhereInput[] = [
      { status: CaseStatusCode.EN_POSTULACION },
      {
        OR: [
          { applicationDeadline: null },
          { applicationDeadline: { gte: new Date() } },
        ],
      },
      {
        OR: [
          { complexityCode: null },
          { complexityCode: { in: allowedComplexities } },
        ],
      },
    ];

    if (specialtyCodes.length > 0) {
      and.push({ OR: [{ areaCode: null }, { areaCode: { in: specialtyCodes } }] });
    }
    if (interventionCodes.length > 0) {
      and.push({
        OR: [
          { interventionTypeCode: null },
          { interventionTypeCode: { in: interventionCodes } },
        ],
      });
    }
    if (sectorCodes.length > 0) {
      and.push({
        OR: [{ company: { sectorCode: null } }, { company: { sectorCode: { in: sectorCodes } } }],
      });
    }

    if (query.search) {
      and.push({
        OR: [
          { title: { contains: query.search, mode: 'insensitive' } },
          { code: { contains: query.search, mode: 'insensitive' } },
        ],
      });
    }
    if (query.areaCode) and.push({ areaCode: query.areaCode });
    if (query.complexityCode) and.push({ complexityCode: query.complexityCode });
    if (query.interventionTypeCode) and.push({ interventionTypeCode: query.interventionTypeCode });

    const where: Prisma.CaseWhereInput = { AND: and };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.case.findMany({
        where,
        select: {
          id: true,
          code: true,
          title: true,
          description: true,
          areaCode: true,
          interventionTypeCode: true,
          complexityCode: true,
          urgencyCode: true,
          impactCode: true,
          publishedAt: true,
          applicationDeadline: true,
          company: { select: { sectorCode: true, country: true, city: true } },
          applications: {
            where: { consultantId: consultant.id },
            select: { id: true, status: true },
            take: 1,
          },
          _count: { select: { applications: true } },
        },
        orderBy: [{ publishedAt: 'desc' }],
        skip: query.skip,
        take: query.take,
      }),
      this.prisma.case.count({ where }),
    ]);

    const data: OpportunityView[] = rows.map((row) => ({
      caseId: row.id,
      code: row.code,
      title: row.title,
      // La descripción íntegra es información del cliente: en la bolsa se
      // entrega recortada, sin identificar a la empresa.
      summary: truncateWords(row.description, OPPORTUNITY_SUMMARY_CHARS),
      areaCode: row.areaCode,
      interventionTypeCode: row.interventionTypeCode,
      complexityCode: row.complexityCode,
      urgencyCode: row.urgencyCode,
      impactCode: row.impactCode,
      sectorCode: row.company.sectorCode,
      country: row.company.country,
      city: row.company.city,
      publishedAt: row.publishedAt,
      applicationDeadline: row.applicationDeadline,
      applicationsCount: row._count.applications,
      alreadyApplied: row.applications.length > 0,
      myApplicationStatus: row.applications[0]?.status ?? null,
    }));

    return paginate(data, total, query);
  }

  /** T3C — postulación estructurada del consultor. */
  async apply(user: AuthenticatedUser, caseId: string, dto: ApplyDto, actor: AuditActor) {
    const consultant = await this.requireEnabledConsultant(user);

    const kase = await this.prisma.case.findUnique({
      where: { id: caseId },
      select: {
        id: true,
        code: true,
        title: true,
        status: true,
        companyId: true,
        complexityCode: true,
        applicationDeadline: true,
      },
    });
    if (!kase) throw new NotFoundError('el caso', caseId);

    if (kase.status !== CaseStatusCode.EN_POSTULACION) {
      throw new BusinessRuleError(
        'CASE_NOT_OPEN_FOR_APPLICATIONS',
        'El caso no está abierto a postulaciones.',
        { status: kase.status },
      );
    }
    if (kase.applicationDeadline && kase.applicationDeadline < new Date()) {
      throw new BusinessRuleError(
        'APPLICATION_WINDOW_CLOSED',
        'El plazo de postulación para este caso ya venció.',
        { deadline: kase.applicationDeadline },
      );
    }

    // Se revalida la complejidad aquí, aunque la bolsa ya filtre: un consultor
    // podría llamar al endpoint directamente con un caseId que no vio.
    if (kase.complexityCode && consultant.maxComplexityCode) {
      const caseRank = COMPLEXITY_RANK[kase.complexityCode] ?? 0;
      const allowedRank = COMPLEXITY_RANK[consultant.maxComplexityCode] ?? 0;
      if (allowedRank < caseRank) {
        throw new ForbiddenError(
          `Su alcance está habilitado hasta complejidad ${consultant.maxComplexityCode}; este caso es ${kase.complexityCode}.`,
          'COMPLEXITY_NOT_ALLOWED',
        );
      }
    }

    const existing = await this.prisma.application.findUnique({
      where: { caseId_consultantId: { caseId, consultantId: consultant.id } },
      select: { id: true, status: true },
    });
    if (existing && existing.status !== ApplicationStatus.RETIRADA) {
      throw new BusinessRuleError(
        'ALREADY_APPLIED',
        'Ya presentó una postulación para este caso.',
        { applicationId: existing.id },
      );
    }

    const collector = this.events.collector();

    const application = await this.prisma.$transaction(async (tx) => {
      const created = await tx.application.upsert({
        where: { caseId_consultantId: { caseId, consultantId: consultant.id } },
        create: {
          caseId,
          consultantId: consultant.id,
          interestStatement: dto.interestStatement,
          availability: dto.availability,
          relevantExperience: dto.relevantExperience,
          fitJustification: dto.fitJustification,
          preliminaryApproach: dto.preliminaryApproach,
          acceptsConditions: dto.acceptsConditions,
          status: ApplicationStatus.PRESENTADA,
        },
        update: {
          interestStatement: dto.interestStatement,
          availability: dto.availability,
          relevantExperience: dto.relevantExperience,
          fitJustification: dto.fitJustification,
          preliminaryApproach: dto.preliminaryApproach,
          acceptsConditions: dto.acceptsConditions,
          status: ApplicationStatus.PRESENTADA,
        },
        select: { id: true, status: true, createdAt: true },
      });

      await this.audit.record(tx, actor, {
        action: 'APPLICATION_SUBMITTED',
        entity: 'Application',
        entityId: created.id,
        caseId,
        companyId: kase.companyId,
        newValue: { consultantCode: consultant.code, status: created.status },
        metadata: { template: 'T3C' },
      });

      collector.add(
        domainEvent('ApplicationSubmitted', {
          actorId: user.id,
          caseId,
          companyId: kase.companyId,
          payload: {
            caseCode: kase.code,
            caseTitle: kase.title,
            consultantCode: consultant.code,
            consultantName: user.fullName,
            applicationId: created.id,
          },
        }),
      );

      return created;
    });

    await collector.flush();
    return application;
  }

  /** Retirar la propia postulación mientras el caso siga abierto. */
  async withdraw(user: AuthenticatedUser, caseId: string, actor: AuditActor) {
    const consultant = await this.requireEnabledConsultant(user);

    const application = await this.prisma.application.findUnique({
      where: { caseId_consultantId: { caseId, consultantId: consultant.id } },
      select: { id: true, status: true, case: { select: { status: true, companyId: true } } },
    });
    if (!application) throw new NotFoundError('la postulación');

    if (application.status === ApplicationStatus.ACEPTADA) {
      throw new BusinessRuleError(
        'APPLICATION_ALREADY_ACCEPTED',
        'No puede retirar una postulación ya aceptada; contacte a Advisory.',
      );
    }
    if (application.case.status !== CaseStatusCode.EN_POSTULACION) {
      throw new BusinessRuleError(
        'CASE_NOT_OPEN_FOR_APPLICATIONS',
        'El caso ya no está en fase de postulación.',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.application.update({
        where: { id: application.id },
        data: { status: ApplicationStatus.RETIRADA },
        select: { id: true, status: true },
      });

      await this.audit.record(tx, actor, {
        action: 'APPLICATION_WITHDRAWN',
        entity: 'Application',
        entityId: application.id,
        caseId,
        companyId: application.case.companyId,
        previousValue: { status: application.status },
        newValue: { status: ApplicationStatus.RETIRADA },
      });

      return updated;
    });
  }

  /**
   * Postulaciones de un caso.
   *
   * Advisory las ve todas con el perfil del consultor y su evaluación. Un
   * consultor sólo ve la suya: la competencia no es información pública.
   */
  async findByCase(user: AuthenticatedUser, caseId: string) {
    await this.caseAccess.assertCanRead(user, caseId);

    const isAdvisory = user.role === RoleCode.ADVISORY || user.role === RoleCode.SUPER_ADMIN;

    const applications = await this.prisma.application.findMany({
      where: isAdvisory ? { caseId } : { caseId, consultantId: user.consultantId ?? '' },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        status: true,
        interestStatement: true,
        availability: true,
        relevantExperience: true,
        fitJustification: true,
        preliminaryApproach: true,
        acceptsConditions: true,
        createdAt: true,
        consultant: {
          select: {
            id: true,
            code: true,
            tier: true,
            experienceLevelCode: true,
            maxComplexityCode: true,
            yearsOfExperience: true,
            user: { select: { fullName: true, email: true } },
            specialties: { select: { specialtyCode: true, isPrimary: true } },
            _count: { select: { assignments: true, evaluations: true } },
          },
        },
        evaluation: {
          select: {
            specialtyFit: true,
            experienceFit: true,
            levelFit: true,
            availabilityFit: true,
            trackRecordFit: true,
            totalScore: true,
            notes: true,
            createdAt: true,
            evaluatedBy: { select: { id: true, fullName: true } },
          },
        },
      },
    });

    return applications.map((application) => ({
      ...application,
      consultant: {
        id: application.consultant.id,
        code: application.consultant.code,
        fullName: application.consultant.user.fullName,
        // El correo del consultor sólo se muestra a advisory.
        email: isAdvisory ? application.consultant.user.email : null,
        tier: application.consultant.tier,
        experienceLevelCode: application.consultant.experienceLevelCode,
        maxComplexityCode: application.consultant.maxComplexityCode,
        yearsOfExperience: application.consultant.yearsOfExperience,
        specialties: application.consultant.specialties,
        assignedCases: application.consultant._count.assignments,
        evaluatedCases: application.consultant._count.evaluations,
      },
    }));
  }

  /** Postulaciones del consultor autenticado, para su panel. */
  async myApplications(user: AuthenticatedUser) {
    if (!user.consultantId) {
      throw new ForbiddenError('Su usuario no está vinculado a un perfil de consultor');
    }

    return this.prisma.application.findMany({
      where: { consultantId: user.consultantId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        status: true,
        createdAt: true,
        case: {
          select: {
            id: true,
            code: true,
            title: true,
            status: true,
            areaCode: true,
            complexityCode: true,
            applicationDeadline: true,
          },
        },
      },
    });
  }

  private async requireEnabledConsultant(user: AuthenticatedUser) {
    if (!user.consultantId) {
      throw new ForbiddenError(
        'Su usuario no está vinculado a un perfil de consultor',
        'NOT_A_CONSULTANT',
      );
    }

    const consultant = await this.prisma.consultant.findUnique({
      where: { id: user.consultantId },
      select: {
        id: true,
        code: true,
        status: true,
        maxComplexityCode: true,
        specialties: { select: { specialtyCode: true } },
        scope: { select: { interventionTypeCodes: true, sectorCodes: true } },
      },
    });

    if (!consultant) throw new NotFoundError('el perfil de consultor');

    // Regla dura del ecosistema: sólo HABILITADO participa (Punto: principio de
    // habilitación previa obligatoria).
    if (consultant.status !== ConsultantStatus.HABILITADO) {
      throw new ForbiddenError(
        `Su perfil está en estado ${consultant.status}. Sólo un consultor HABILITADO puede ver oportunidades y postularse.`,
        'CONSULTANT_NOT_ENABLED',
      );
    }

    return consultant;
  }
}

export interface OpportunityView {
  caseId: string;
  code: string;
  title: string;
  summary: string;
  areaCode: string | null;
  interventionTypeCode: string | null;
  complexityCode: string | null;
  urgencyCode: string | null;
  impactCode: string | null;
  sectorCode: string | null;
  country: string;
  city: string;
  publishedAt: Date | null;
  applicationDeadline: Date | null;
  applicationsCount: number;
  alreadyApplied: boolean;
  myApplicationStatus: ApplicationStatus | null;
}
