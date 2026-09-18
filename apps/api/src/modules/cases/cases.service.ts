import { randomBytes } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import {
  CaseStatusCode,
  DocumentStage,
  Prisma,
  RoleCode,
  SlaStatus,
  UserStatus,
} from '@prisma/client';
import { CASE_STATUS_LABEL, CASE_STATUS_ORDER } from '@nodus/types';
import { AuditService, type AuditActor } from '../../core/audit/audit.service';
import type { AuthenticatedUser } from '../../core/auth/auth.types';
import { CaseAccessService } from '../../core/auth/case-access.service';
import {
  BusinessRuleError,
  ForbiddenError,
  NotFoundError,
} from '../../core/common/errors/domain.errors';
import { paginate, safeOrderBy, type PaginatedResult } from '../../core/common/dto/pagination.dto';
import { nextCode } from '../../core/common/utils/code-sequence.util';
import {
  extractCorporateDomain,
  normalizeCompanyName,
  truncateWords,
} from '../../core/common/utils/text.util';
import { domainEvent } from '../../core/events/domain-events';
import { EventBusService } from '../../core/events/event-bus.service';
import { PrismaService, type TxClient } from '../../core/prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { CompanyMatchingService } from '../companies/company-matching.service';
import { LookupsService } from '../lookups/lookups.service';
import { SlaService } from '../sla/sla.service';
import { WorkflowService } from '../workflow/workflow.service';
import type { CaseListQueryDto, CreateCaseDto, IntakeDto, UpdateCaseDto } from './dto/cases.dto';

const SORTABLE = ['createdAt', 'updatedAt', 'code', 'title', 'status'] as const;

/** Descripción recortada que ve un consultor en la bolsa (sin datos sensibles). */
const REDACTED_SUMMARY_CHARS = 400;

@Injectable()
export class CasesService {
  private readonly logger = new Logger(CasesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly events: EventBusService,
    private readonly sla: SlaService,
    private readonly lookups: LookupsService,
    private readonly matching: CompanyMatchingService,
    private readonly caseAccess: CaseAccessService,
    private readonly workflow: WorkflowService,
  ) {}

  // ==========================================================================
  //  T1 — Onboarding y apertura del caso
  // ==========================================================================

  /**
   * Flujo completo de entrada (Punto 1 del blueprint operativo).
   *
   * Una única transacción crea, o vincula, **todo** lo que el documento exige:
   * empresa (si no existe), contacto, usuario del contacto, caso con ID único y
   * fecha/hora, estructura documental, bitácora y estado `CREADO`. Si algo falla,
   * no queda una empresa huérfana ni un usuario sin caso.
   */
  async intake(
    dto: IntakeDto,
    actor: AuditActor,
  ): Promise<{
    case: { id: string; code: string; title: string; status: CaseStatusCode; createdAt: Date };
    company: { id: string; code: string; name: string; wasCreated: boolean };
    contact: { id: string; email: string };
    user: { id: string; email: string; wasCreated: boolean; temporaryPassword: string | null };
  }> {
    const collector = this.events.collector();

    const result = await this.prisma.$transaction(
      async (tx) => {
        // Las clasificaciones del intake son LOV: nada de texto libre (RT-016).
        await this.lookups.assertValidCodes(tx, [
          { listCode: 'AREA_PROBLEMA', value: dto.areaCode, fieldLabel: 'área del negocio' },
          { listCode: 'URGENCIA', value: dto.urgencyCode, fieldLabel: 'nivel de urgencia' },
          { listCode: 'IMPACTO', value: dto.impactCode, fieldLabel: 'impacto estimado' },
        ]);

        // ---------------------------------------------- Empresa (única)
        const { company, wasCreated: companyCreated } = await this.resolveCompany(tx, dto, actor);

        // ---------------------------------------------- Contacto
        const existingContact = await tx.companyContact.findUnique({
          where: { companyId_email: { companyId: company.id, email: dto.contactEmail } },
          select: { id: true, userId: true, email: true },
        });

        const hasPrimary = await tx.companyContact.findFirst({
          where: { companyId: company.id, isPrimary: true, isActive: true },
          select: { id: true },
        });

        const contact =
          existingContact ??
          (await tx.companyContact.create({
            data: {
              companyId: company.id,
              fullName: dto.contactFullName,
              jobTitle: dto.contactJobTitle,
              email: dto.contactEmail,
              phone: dto.contactPhone,
              isPrimary: !hasPrimary,
            },
            select: { id: true, userId: true, email: true },
          }));

        // ---------------------------------------------- Usuario del contacto
        const { user, wasCreated: userCreated, temporaryPassword } = await this.resolveClientUser(
          tx,
          { email: dto.contactEmail, fullName: dto.contactFullName, phone: dto.contactPhone },
          company.id,
        );

        if (!contact.userId) {
          await tx.companyContact.update({
            where: { id: contact.id },
            data: { userId: user.id },
          });
        }

        // ---------------------------------------------- Caso
        const code = await nextCode(tx, 'CAS');
        const kase = await tx.case.create({
          data: {
            code,
            companyId: company.id,
            contactId: contact.id,
            createdById: user.id,
            title: dto.title,
            description: dto.description,
            areaCode: dto.areaCode,
            urgencyCode: dto.urgencyCode,
            impactCode: dto.impactCode,
            status: CaseStatusCode.CREADO,
          },
          select: { id: true, code: true, title: true, status: true, createdAt: true },
        });

        await tx.caseStatusHistory.create({
          data: {
            caseId: kase.id,
            previousStatus: null,
            newStatus: CaseStatusCode.CREADO,
            transitionCode: 'INTAKE',
            note: 'Caso registrado mediante la plantilla T1',
            actorId: user.id,
          },
        });

        // Estructura documental del caso (Empresa → Caso → Intake).
        await tx.document.create({
          data: {
            companyId: company.id,
            caseId: kase.id,
            stage: DocumentStage.INTAKE,
            type: 'ADJUNTOS_INTAKE',
            name: 'Adjuntos iniciales del caso',
            currentVersion: 0,
          },
        });

        await this.audit.record(tx, { ...actor, id: user.id, role: RoleCode.CLIENTE_MIPYME }, {
          action: 'CASE_CREATED',
          entity: 'Case',
          entityId: kase.id,
          caseId: kase.id,
          companyId: company.id,
          newValue: {
            code: kase.code,
            title: kase.title,
            areaCode: dto.areaCode,
            urgencyCode: dto.urgencyCode,
            impactCode: dto.impactCode,
            status: CaseStatusCode.CREADO,
          },
          metadata: { companyCreated, userCreated, template: 'T1' },
        });

        // Reloj de SLA de la etapa CREADO.
        await this.sla.onTransition(tx, {
          caseId: kase.id,
          companyId: company.id,
          from: null,
          to: CaseStatusCode.CREADO,
          urgencyCode: dto.urgencyCode,
        });

        collector.add(
          domainEvent('CaseCreated', {
            actorId: user.id,
            caseId: kase.id,
            companyId: company.id,
            payload: {
              caseCode: kase.code,
              caseTitle: kase.title,
              companyName: company.name,
              contactEmail: contact.email,
              contactName: dto.contactFullName,
              temporaryPassword,
            },
          }),
        );

        return {
          case: kase,
          company: { ...company, wasCreated: companyCreated },
          contact: { id: contact.id, email: contact.email },
          user: {
            id: user.id,
            email: user.email,
            wasCreated: userCreated,
            temporaryPassword,
          },
        };
      },
      { timeout: 20_000 },
    );

    await collector.flush();
    this.logger.log(`Intake completado: caso ${result.case.code} para ${result.company.code}`);

    return result;
  }

  /** Caso adicional para una empresa ya registrada. */
  async create(dto: CreateCaseDto, user: AuthenticatedUser, actor: AuditActor) {
    const companyId =
      user.role === RoleCode.CLIENTE_MIPYME ? (user.companyId ?? '') : (dto.companyId ?? '');

    if (!companyId) {
      throw new BusinessRuleError(
        'COMPANY_REQUIRED',
        'Debe indicar la empresa a la que pertenece el caso.',
      );
    }
    if (user.role === RoleCode.CLIENTE_MIPYME && dto.companyId && dto.companyId !== companyId) {
      throw new ForbiddenError('Sólo puede crear casos para su propia empresa', 'NOT_CASE_OWNER');
    }

    const collector = this.events.collector();

    const created = await this.prisma.$transaction(async (tx) => {
      await this.lookups.assertValidCodes(tx, [
        { listCode: 'AREA_PROBLEMA', value: dto.areaCode, fieldLabel: 'área del negocio' },
        { listCode: 'URGENCIA', value: dto.urgencyCode, fieldLabel: 'nivel de urgencia' },
        { listCode: 'IMPACTO', value: dto.impactCode, fieldLabel: 'impacto estimado' },
      ]);

      const company = await tx.company.findUnique({
        where: { id: companyId },
        select: { id: true, name: true },
      });
      if (!company) throw new NotFoundError('la empresa', companyId);

      const contactId =
        dto.contactId ??
        (
          await tx.companyContact.findFirst({
            where: { companyId, isPrimary: true, isActive: true },
            select: { id: true },
          })
        )?.id ??
        null;

      const code = await nextCode(tx, 'CAS');
      const kase = await tx.case.create({
        data: {
          code,
          companyId,
          contactId,
          createdById: user.id,
          title: dto.title,
          description: dto.description,
          areaCode: dto.areaCode,
          urgencyCode: dto.urgencyCode,
          impactCode: dto.impactCode,
          status: CaseStatusCode.CREADO,
        },
        select: { id: true, code: true, title: true, status: true, createdAt: true },
      });

      await tx.caseStatusHistory.create({
        data: {
          caseId: kase.id,
          newStatus: CaseStatusCode.CREADO,
          transitionCode: 'INTAKE',
          note: 'Caso registrado por un usuario autenticado',
          actorId: user.id,
        },
      });

      await tx.document.create({
        data: {
          companyId,
          caseId: kase.id,
          stage: DocumentStage.INTAKE,
          type: 'ADJUNTOS_INTAKE',
          name: 'Adjuntos iniciales del caso',
        },
      });

      await this.audit.record(tx, actor, {
        action: 'CASE_CREATED',
        entity: 'Case',
        entityId: kase.id,
        caseId: kase.id,
        companyId,
        newValue: { code: kase.code, title: kase.title, status: CaseStatusCode.CREADO },
      });

      await this.sla.onTransition(tx, {
        caseId: kase.id,
        companyId,
        from: null,
        to: CaseStatusCode.CREADO,
        urgencyCode: dto.urgencyCode,
      });

      collector.add(
        domainEvent('CaseCreated', {
          actorId: user.id,
          caseId: kase.id,
          companyId,
          payload: { caseCode: kase.code, caseTitle: kase.title, companyName: company.name },
        }),
      );

      return kase;
    });

    await collector.flush();
    return created;
  }

  // ==========================================================================
  //  Lectura
  // ==========================================================================

  async findAll(
    user: AuthenticatedUser,
    query: CaseListQueryDto,
  ): Promise<PaginatedResult<CaseListItem>> {
    const where = this.buildScopedWhere(user, query);

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.case.findMany({
        where,
        // `select` explícito: no se traen description ni relaciones completas en
        // un listado. La descripción de 5000 caracteres por 20 filas es el tipo
        // de coste que no se nota hasta que la base tiene volumen.
        select: {
          id: true,
          code: true,
          title: true,
          status: true,
          areaCode: true,
          complexityCode: true,
          urgencyCode: true,
          impactCode: true,
          createdAt: true,
          updatedAt: true,
          company: { select: { id: true, name: true } },
          assignments: {
            where: { isActive: true, isPrimary: true },
            take: 1,
            select: {
              consultant: { select: { id: true, code: true, user: { select: { fullName: true } } } },
            },
          },
          slaInstances: {
            where: { status: { in: [SlaStatus.ON_TRACK, SlaStatus.AT_RISK, SlaStatus.OVERDUE] } },
            orderBy: { deadline: 'asc' },
            take: 1,
            select: { status: true, deadline: true, percentConsumed: true },
          },
          _count: {
            select: { incidents: { where: { status: { in: ['ABIERTA', 'EN_ATENCION', 'ESCALADA'] } } } },
          },
        },
        orderBy: safeOrderBy(query, SORTABLE, 'createdAt'),
        skip: query.skip,
        take: query.take,
      }),
      this.prisma.case.count({ where }),
    ]);

    const data: CaseListItem[] = rows.map((row) => {
      const sla = row.slaInstances[0];
      const lead = row.assignments[0]?.consultant;

      return {
        id: row.id,
        code: row.code,
        title: row.title,
        status: row.status,
        statusLabel: CASE_STATUS_LABEL[row.status],
        company: row.company,
        areaCode: row.areaCode,
        complexityCode: row.complexityCode,
        urgencyCode: row.urgencyCode,
        impactCode: row.impactCode,
        leadConsultant: lead
          ? { id: lead.id, code: lead.code, fullName: lead.user.fullName }
          : null,
        slaStatus: sla?.status ?? null,
        slaDeadline: sla?.deadline ?? null,
        slaPercentConsumed: sla ? Number(sla.percentConsumed) : null,
        openIncidents: row._count.incidents,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      };
    });

    return paginate(data, total, query);
  }

  async findById(user: AuthenticatedUser, caseId: string) {
    const access = await this.caseAccess.assertCanRead(user, caseId);

    const kase = await this.prisma.case.findUnique({
      where: { id: caseId },
      select: {
        id: true,
        code: true,
        title: true,
        description: true,
        status: true,
        areaCode: true,
        subAreaCode: true,
        interventionTypeCode: true,
        complexityCode: true,
        urgencyCode: true,
        impactCode: true,
        publishedAt: true,
        applicationDeadline: true,
        decisionOpenedAt: true,
        authorizedAt: true,
        executionStartedAt: true,
        closedAt: true,
        closureReason: true,
        closureReasonCode: true,
        createdAt: true,
        updatedAt: true,
        company: { select: { id: true, code: true, name: true, country: true, city: true } },
        contact: { select: { id: true, fullName: true, email: true, jobTitle: true, phone: true } },
        assignments: {
          where: { isActive: true },
          select: {
            id: true,
            isPrimary: true,
            createdAt: true,
            consultant: {
              select: {
                id: true,
                code: true,
                tier: true,
                user: { select: { fullName: true, email: true } },
              },
            },
          },
        },
        classifications: {
          where: { isCurrent: true },
          take: 1,
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
            confirmedAt: true,
            createdAt: true,
            classifiedBy: { select: { id: true, fullName: true } },
          },
        },
        slaInstances: {
          where: { status: { in: [SlaStatus.ON_TRACK, SlaStatus.AT_RISK, SlaStatus.OVERDUE] } },
          orderBy: { deadline: 'asc' },
          take: 1,
          select: {
            id: true,
            stage: true,
            status: true,
            startedAt: true,
            deadline: true,
            percentConsumed: true,
            rule: { select: { code: true, name: true } },
          },
        },
        _count: {
          select: {
            documents: true,
            applications: true,
            activities: true,
            milestones: true,
            incidents: true,
            deliverables: true,
            communications: true,
            meetings: true,
          },
        },
      },
    });

    if (!kase) throw new NotFoundError('el caso', caseId);

    const availableTransitions = await this.workflow.availableTransitions(user, caseId);
    const proposalVersions = await this.prisma.proposalVersion.count({
      where: { proposal: { caseId } },
    });

    const base = {
      ...kase,
      statusLabel: CASE_STATUS_LABEL[kase.status],
      progressPercent: progressOf(kase.status),
      classification: kase.classifications[0] ?? null,
      leadConsultant:
        kase.assignments.find((assignment) => assignment.isPrimary)?.consultant ?? null,
      sla: kase.slaInstances[0]
        ? {
            ...kase.slaInstances[0],
            percentConsumed: Number(kase.slaInstances[0].percentConsumed),
          }
        : null,
      counts: { ...kase._count, proposalVersions },
      availableTransitions,
      accessLevel: access.level,
    };

    // Versión controlada para consultores postulantes y revisores: el blueprint
    // es explícito en que la bolsa no expone información sensible del cliente.
    if (access.level === 'REDACTED') {
      return {
        ...base,
        description: truncateWords(kase.description, REDACTED_SUMMARY_CHARS),
        company: { id: kase.company.id, code: kase.company.code, name: 'Empresa reservada', country: kase.company.country, city: kase.company.city },
        contact: null,
        classifications: undefined,
      };
    }

    return { ...base, classifications: undefined };
  }

  /** Bitácora del caso como línea de tiempo (RT-005). */
  async timeline(user: AuthenticatedUser, caseId: string, take = 200) {
    await this.caseAccess.assertCanRead(user, caseId);

    const entries = await this.prisma.auditLog.findMany({
      where: { caseId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(take, 500),
      select: {
        id: true,
        createdAt: true,
        action: true,
        entity: true,
        entityId: true,
        origin: true,
        previousValue: true,
        newValue: true,
        metadata: true,
        actor: { select: { id: true, fullName: true, role: { select: { code: true } } } },
      },
    });

    return entries.map((entry) => ({
      id: entry.id,
      createdAt: entry.createdAt,
      action: entry.action,
      actionLabel: humanizeAction(entry.action),
      entity: entry.entity,
      entityId: entry.entityId,
      origin: entry.origin,
      actor: entry.actor
        ? { id: entry.actor.id, fullName: entry.actor.fullName, role: entry.actor.role.code }
        : null,
      previousValue: entry.previousValue,
      newValue: entry.newValue,
      metadata: entry.metadata,
    }));
  }

  /** Historial de estados con el tiempo permanecido en cada uno. */
  async statusHistory(user: AuthenticatedUser, caseId: string) {
    await this.caseAccess.assertCanRead(user, caseId);

    return this.prisma.caseStatusHistory.findMany({
      where: { caseId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        previousStatus: true,
        newStatus: true,
        transitionCode: true,
        note: true,
        origin: true,
        hoursInPreviousStatus: true,
        createdAt: true,
        actor: { select: { id: true, fullName: true } },
      },
    });
  }

  // ==========================================================================
  //  Edición (sólo en CREADO)
  // ==========================================================================

  /**
   * RF-013 / regla de gobierno del Punto 1: el cliente puede editar el caso
   * **únicamente** mientras esté en `CREADO`. Después, el relato original del
   * cliente no se toca: la plataforma añade clasificaciones, no reescribe.
   */
  async update(user: AuthenticatedUser, caseId: string, dto: UpdateCaseDto, actor: AuditActor) {
    const access = await this.caseAccess.assertFullAccess(user, caseId);

    const current = await this.prisma.case.findUniqueOrThrow({
      where: { id: caseId },
      select: {
        id: true,
        status: true,
        title: true,
        description: true,
        areaCode: true,
        urgencyCode: true,
        impactCode: true,
        companyId: true,
      },
    });

    if (current.status !== CaseStatusCode.CREADO) {
      throw new BusinessRuleError(
        'CASE_NOT_EDITABLE',
        `El caso sólo puede editarse mientras está en estado CREADO. Estado actual: ${CASE_STATUS_LABEL[current.status]}.`,
        { status: current.status },
      );
    }

    if (user.role === RoleCode.CONSULTOR || user.role === RoleCode.CONSULTOR_REVISOR) {
      throw new ForbiddenError('Los consultores no pueden editar el relato del caso');
    }
    if (user.role === RoleCode.CLIENTE_MIPYME && !access.isClientOwner) {
      throw new ForbiddenError('Sólo el cliente propietario puede editar el caso');
    }

    return this.prisma.$transaction(async (tx) => {
      await this.lookups.assertValidCodes(tx, [
        { listCode: 'AREA_PROBLEMA', value: dto.areaCode, fieldLabel: 'área del negocio' },
        { listCode: 'URGENCIA', value: dto.urgencyCode, fieldLabel: 'nivel de urgencia' },
        { listCode: 'IMPACTO', value: dto.impactCode, fieldLabel: 'impacto estimado' },
      ]);

      const changes = AuditService.diff(current as unknown as Record<string, unknown>, dto);
      if (!changes) return current;

      const updated = await tx.case.update({
        where: { id: caseId },
        data: {
          title: dto.title,
          description: dto.description,
          areaCode: dto.areaCode,
          urgencyCode: dto.urgencyCode,
          impactCode: dto.impactCode,
        },
        select: {
          id: true,
          code: true,
          title: true,
          description: true,
          status: true,
          areaCode: true,
          urgencyCode: true,
          impactCode: true,
        },
      });

      await this.audit.record(tx, actor, {
        action: 'CASE_UPDATED',
        entity: 'Case',
        entityId: caseId,
        caseId,
        companyId: current.companyId,
        previousValue: changes.previous,
        newValue: changes.next,
      });

      return updated;
    });
  }

  // ==========================================================================
  //  Internos
  // ==========================================================================

  /**
   * Alcance de lectura según el rol. Es el complemento del `CaseAccessGuard`
   * para listados: el cliente sólo ve su empresa, y el consultor sólo sus casos
   * asignados más las oportunidades publicadas.
   */
  private buildScopedWhere(
    user: AuthenticatedUser,
    query: CaseListQueryDto,
  ): Prisma.CaseWhereInput {
    const where: Prisma.CaseWhereInput = {};
    const and: Prisma.CaseWhereInput[] = [];

    switch (user.role) {
      case RoleCode.CLIENTE_MIPYME:
        and.push({ companyId: user.companyId ?? '00000000-0000-0000-0000-000000000000' });
        break;
      case RoleCode.CONSULTOR:
        and.push({
          OR: [
            {
              assignments: {
                some: { consultantId: user.consultantId ?? '', isActive: true },
              },
            },
            { applications: { some: { consultantId: user.consultantId ?? '' } } },
          ],
        });
        break;
      case RoleCode.CONSULTOR_REVISOR:
        and.push({
          status: {
            in: [CaseStatusCode.PROPUESTA_LISTA_PARA_QA, CaseStatusCode.AJUSTES_DE_PROPUESTA],
          },
        });
        break;
      default:
        break; // ADVISORY y SUPER_ADMIN ven todo
    }

    if (query.search) {
      and.push({
        OR: [
          { title: { contains: query.search, mode: 'insensitive' } },
          { code: { contains: query.search, mode: 'insensitive' } },
        ],
      });
    }
    if (query.status) and.push({ status: query.status });
    if (query.companyId) and.push({ companyId: query.companyId });
    if (query.areaCode) and.push({ areaCode: query.areaCode });
    if (query.complexityCode) and.push({ complexityCode: query.complexityCode });
    if (query.consultantId) {
      and.push({ assignments: { some: { consultantId: query.consultantId, isActive: true } } });
    }
    if (query.slaStatus) {
      and.push({ slaInstances: { some: { status: query.slaStatus as SlaStatus } } });
    }
    if (query.createdFrom || query.createdTo) {
      and.push({
        createdAt: {
          gte: query.createdFrom ?? undefined,
          lte: query.createdTo ?? undefined,
        },
      });
    }

    if (and.length > 0) where.AND = and;
    return where;
  }

  private async resolveCompany(tx: TxClient, dto: IntakeDto, actor: AuditActor) {
    if (dto.linkToCompanyId) {
      const company = await tx.company.findUnique({
        where: { id: dto.linkToCompanyId },
        select: { id: true, code: true, name: true },
      });
      if (!company) throw new NotFoundError('la empresa', dto.linkToCompanyId);
      return { company, wasCreated: false };
    }

    const matches = await this.matching.findMatches(tx, {
      name: dto.companyName,
      taxId: dto.taxId,
      contactEmail: dto.contactEmail,
    });
    const blocking = this.matching.blocking(matches);

    // Coincidencia exacta durante el intake: se **vincula** automáticamente.
    // El principio "Empresa Única – Casos Múltiples" dice justo eso: si la
    // empresa ya existe, el nuevo caso se asocia al registro existente.
    if (blocking.length > 0) {
      const target = blocking[0]!;
      const company = await tx.company.findUniqueOrThrow({
        where: { id: target.companyId },
        select: { id: true, code: true, name: true },
      });
      return { company, wasCreated: false };
    }

    const code = await nextCode(tx, 'EMP');
    const company = await tx.company.create({
      data: {
        code,
        name: dto.companyName,
        normalizedName: normalizeCompanyName(dto.companyName),
        taxId: dto.taxId?.trim() || null,
        emailDomain: extractCorporateDomain(dto.contactEmail),
        country: dto.country,
        city: dto.city,
        acceptedTermsAt: new Date(),
      },
      select: { id: true, code: true, name: true },
    });

    await this.audit.record(tx, actor, {
      action: 'COMPANY_CREATED',
      entity: 'Company',
      entityId: company.id,
      companyId: company.id,
      newValue: { code: company.code, name: company.name },
      metadata: {
        source: 'INTAKE_T1',
        suggestedMatches: matches.map((match) => ({ code: match.code, confidence: match.confidence })),
      },
    });

    return { company, wasCreated: true };
  }

  private async resolveClientUser(
    tx: TxClient,
    input: { email: string; fullName: string; phone: string },
    companyId: string,
  ) {
    const existing = await tx.user.findUnique({
      where: { email: input.email },
      select: { id: true, email: true, companyId: true },
    });

    if (existing) {
      return { user: existing, wasCreated: false, temporaryPassword: null as string | null };
    }

    const role = await tx.role.findUniqueOrThrow({
      where: { code: RoleCode.CLIENTE_MIPYME },
      select: { id: true },
    });

    // Contraseña temporal aleatoria. Se devuelve una sola vez (y viaja en la
    // notificación TCOM1); nunca se almacena en claro.
    const temporaryPassword = generateTemporaryPassword();

    const user = await tx.user.create({
      data: {
        email: input.email,
        fullName: input.fullName,
        phone: input.phone,
        passwordHash: await AuthService.hashPassword(temporaryPassword),
        roleId: role.id,
        companyId,
        status: UserStatus.ACTIVO,
        mustChangePassword: true,
      },
      select: { id: true, email: true, companyId: true },
    });

    return { user, wasCreated: true, temporaryPassword };
  }
}

// ---------------------------------------------------------------- utilidades --

export interface CaseListItem {
  id: string;
  code: string;
  title: string;
  status: CaseStatusCode;
  statusLabel: string;
  company: { id: string; name: string };
  areaCode: string | null;
  complexityCode: string | null;
  urgencyCode: string | null;
  impactCode: string | null;
  leadConsultant: { id: string; code: string; fullName: string } | null;
  slaStatus: SlaStatus | null;
  slaDeadline: Date | null;
  slaPercentConsumed: number | null;
  openIncidents: number;
  createdAt: Date;
  updatedAt: Date;
}

/** Avance del caso en el ciclo, 0–100, para barras de progreso. */
function progressOf(status: CaseStatusCode): number {
  if (status === CaseStatusCode.CERRADO) return 100;
  if (status === CaseStatusCode.CERRADO_SIN_CONTRATACION) return 100;
  const order = CASE_STATUS_ORDER[status] ?? 0;
  return Math.min(99, Math.round((order / CASE_STATUS_ORDER.CERRADO) * 100));
}

const ACTION_LABELS: Record<string, string> = {
  CASE_CREATED: 'Caso registrado',
  CASE_UPDATED: 'Caso actualizado',
  COMPANY_CREATED: 'Empresa registrada',
  COMPANY_CONTACT_CREATED: 'Contacto registrado',
  CASE_CLASSIFIED: 'Caso clasificado',
  APPLICATION_SUBMITTED: 'Postulación recibida',
  APPLICATION_WITHDRAWN: 'Postulación retirada',
  PROPOSAL_VERSION_UPDATED: 'Propuesta editada',
  PROPOSAL_REVIEW_CREATED: 'Revisión de propuesta registrada',
  DOCUMENT_UPLOADED: 'Documento cargado',
  DELIVERABLE_VERSION_UPLOADED: 'Entregable cargado',
  CONTRACT_ITEM_UPDATED: 'Checklist de contratación actualizado',
  OPERATIONAL_FRAMEWORK_UPLOADED: 'Marco operativo cargado',
  SLA_ALERT: 'Alerta de SLA',
  NOTIFICATION_SENT: 'Notificación enviada',
};

function humanizeAction(action: string): string {
  if (ACTION_LABELS[action]) return ACTION_LABELS[action]!;

  if (action.startsWith('CASE_TRANSITION_')) {
    const code = action.replace('CASE_TRANSITION_', '');
    return `Transición ${code.replace(/_/g, ' ').toLowerCase()}`;
  }

  return action.replace(/_/g, ' ').toLowerCase();
}

function generateTemporaryPassword(): string {
  // 12 caracteres legibles + un dígito y una letra garantizados, para cumplir la
  // política sin producir algo imposible de teclear.
  const raw = randomBytes(12).toString('base64url').replace(/[^A-Za-z0-9]/g, '');
  return `Nd${raw.slice(0, 10)}7`;
}
