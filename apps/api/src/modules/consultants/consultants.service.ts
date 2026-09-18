import { Injectable } from '@nestjs/common';
import { ConsultantStatus, Prisma, RoleCode, UserStatus } from '@prisma/client';
import { AuditService, type AuditActor } from '../../core/audit/audit.service';
import type { AuthenticatedUser } from '../../core/auth/auth.types';
import { BusinessRuleError, NotFoundError } from '../../core/common/errors/domain.errors';
import { paginate, safeOrderBy, type PaginatedResult } from '../../core/common/dto/pagination.dto';
import { nextCode } from '../../core/common/utils/code-sequence.util';
import { PrismaService } from '../../core/prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { LookupsService } from '../lookups/lookups.service';
import type {
  ChangeConsultantStatusDto,
  ClassifyConsultantDto,
  ConsultantListQueryDto,
  CreateConsultantDto,
} from './dto/consultants.dto';

const SORTABLE = ['createdAt', 'code', 'status'] as const;

/**
 * Transiciones permitidas del ciclo de vida del consultor.
 *
 * El ecosistema es curado: nadie participa sin pasar por registro → debida
 * diligencia → clasificación → habilitación. Esta tabla impide saltos que
 * vaciarían de sentido ese control (p. ej. `REGISTRADO → HABILITADO` sin
 * validación).
 */
const STATUS_TRANSITIONS: Record<ConsultantStatus, ConsultantStatus[]> = {
  REGISTRADO: [ConsultantStatus.EN_VALIDACION, ConsultantStatus.INACTIVO],
  EN_VALIDACION: [
    ConsultantStatus.HABILITADO,
    ConsultantStatus.CONDICIONADO,
    ConsultantStatus.INACTIVO,
  ],
  HABILITADO: [
    ConsultantStatus.CONDICIONADO,
    ConsultantStatus.SUSPENDIDO,
    ConsultantStatus.INACTIVO,
  ],
  CONDICIONADO: [
    ConsultantStatus.HABILITADO,
    ConsultantStatus.SUSPENDIDO,
    ConsultantStatus.INACTIVO,
  ],
  SUSPENDIDO: [ConsultantStatus.HABILITADO, ConsultantStatus.INACTIVO],
  INACTIVO: [ConsultantStatus.EN_VALIDACION],
};

@Injectable()
export class ConsultantsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly lookups: LookupsService,
  ) {}

  /** TC1 — registro del consultor. Crea usuario + perfil en una transacción. */
  async create(dto: CreateConsultantDto, actor: AuditActor) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: { id: true },
    });
    if (existingUser) {
      throw new BusinessRuleError(
        'EMAIL_ALREADY_REGISTERED',
        'Ya existe un usuario con ese correo electrónico.',
      );
    }

    const existingDocument = await this.prisma.consultant.findUnique({
      where: { identityDocument: dto.identityDocument },
      select: { code: true },
    });
    if (existingDocument) {
      // Principio de consultor único: no se duplica por cambio de correo o sponsor.
      throw new BusinessRuleError(
        'CONSULTANT_ALREADY_REGISTERED',
        `Ya existe un consultor registrado con ese documento de identidad (${existingDocument.code}).`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const role = await tx.role.findUniqueOrThrow({
        where: { code: RoleCode.CONSULTOR },
        select: { id: true },
      });

      const temporaryPassword = `Nd${Math.random().toString(36).slice(2, 12)}7`;

      const user = await tx.user.create({
        data: {
          email: dto.email,
          fullName: dto.fullName,
          phone: dto.phone,
          passwordHash: await AuthService.hashPassword(temporaryPassword),
          roleId: role.id,
          status: UserStatus.ACTIVO,
          mustChangePassword: true,
        },
        select: { id: true, email: true },
      });

      const code = await nextCode(tx, 'CON');

      const consultant = await tx.consultant.create({
        data: {
          code,
          userId: user.id,
          identityDocument: dto.identityDocument,
          phone: dto.phone,
          country: dto.country,
          city: dto.city,
          professionalProfile: dto.professionalProfile,
          yearsOfExperience: dto.yearsOfExperience,
          certifications: dto.certifications ?? null,
          availability: dto.availability,
          engagementMode: dto.engagementMode,
          sponsorId: dto.sponsorId ?? null,
          status: ConsultantStatus.REGISTRADO,
          scope: { create: {} },
          statusHistory: {
            create: {
              previousStatus: null,
              newStatus: ConsultantStatus.REGISTRADO,
              reason: 'Registro inicial del consultor (TC1)',
              changedById: actor.id,
            },
          },
        },
        select: { id: true, code: true, status: true, createdAt: true },
      });

      await this.audit.record(tx, actor, {
        action: 'CONSULTANT_REGISTERED',
        entity: 'Consultant',
        entityId: consultant.id,
        newValue: {
          code: consultant.code,
          email: user.email,
          engagementMode: dto.engagementMode,
        },
        metadata: { template: 'TC1' },
      });

      return { ...consultant, email: user.email, temporaryPassword };
    });
  }

  async findAll(query: ConsultantListQueryDto): Promise<PaginatedResult<ConsultantListItem>> {
    const where: Prisma.ConsultantWhereInput = {};
    const and: Prisma.ConsultantWhereInput[] = [];

    if (query.status) and.push({ status: query.status });
    if (query.tier) and.push({ tier: query.tier });
    if (query.maxComplexityCode) and.push({ maxComplexityCode: query.maxComplexityCode });
    if (query.specialtyCode) {
      and.push({ specialties: { some: { specialtyCode: query.specialtyCode } } });
    }
    if (query.search) {
      and.push({
        OR: [
          { code: { contains: query.search, mode: 'insensitive' } },
          { user: { fullName: { contains: query.search, mode: 'insensitive' } } },
          { user: { email: { contains: query.search, mode: 'insensitive' } } },
        ],
      });
    }
    if (and.length > 0) where.AND = and;

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.consultant.findMany({
        where,
        orderBy: safeOrderBy(query, SORTABLE, 'createdAt'),
        skip: query.skip,
        take: query.take,
        select: {
          id: true,
          code: true,
          status: true,
          tier: true,
          engagementMode: true,
          experienceLevelCode: true,
          maxComplexityCode: true,
          yearsOfExperience: true,
          availability: true,
          createdAt: true,
          user: { select: { fullName: true, email: true } },
          sponsor: { select: { name: true } },
          specialties: { select: { specialtyCode: true, isPrimary: true } },
          _count: { select: { assignments: true, applications: true, evaluations: true } },
        },
      }),
      this.prisma.consultant.count({ where }),
    ]);

    return paginate(
      rows.map((row) => ({
        id: row.id,
        code: row.code,
        fullName: row.user.fullName,
        email: row.user.email,
        status: row.status,
        tier: row.tier,
        engagementMode: row.engagementMode,
        experienceLevelCode: row.experienceLevelCode,
        maxComplexityCode: row.maxComplexityCode,
        yearsOfExperience: row.yearsOfExperience,
        availability: row.availability,
        sponsorName: row.sponsor?.name ?? null,
        specialties: row.specialties,
        assignedCases: row._count.assignments,
        applications: row._count.applications,
        evaluations: row._count.evaluations,
        createdAt: row.createdAt,
      })),
      total,
      query,
    );
  }

  async findById(id: string) {
    const consultant = await this.prisma.consultant.findUnique({
      where: { id },
      select: {
        id: true,
        code: true,
        status: true,
        tier: true,
        engagementMode: true,
        identityDocument: true,
        phone: true,
        country: true,
        city: true,
        professionalProfile: true,
        yearsOfExperience: true,
        certifications: true,
        availability: true,
        experienceLevelCode: true,
        maxComplexityCode: true,
        dueDiligenceNotes: true,
        dueDiligenceDecidedAt: true,
        createdAt: true,
        user: { select: { id: true, fullName: true, email: true, status: true } },
        sponsor: { select: { id: true, code: true, name: true } },
        specialties: true,
        scope: true,
        statusHistory: {
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            previousStatus: true,
            newStatus: true,
            reason: true,
            createdAt: true,
            changedBy: { select: { id: true, fullName: true } },
          },
        },
      },
    });

    if (!consultant) throw new NotFoundError('el consultor', id);
    return consultant;
  }

  /**
   * Historial de desempeño.
   *
   * Es la base del futuro sistema de reputación (§48): se expone la evidencia
   * acumulada —casos atendidos, complejidad, evaluaciones, incidencias— pero
   * **no** se calcula ni se publica ninguna puntuación ni estrellas. Primero
   * gobierno y desempeño; la reputación visible viene después.
   */
  async performance(id: string) {
    const [consultant, evaluations, assignments] = await Promise.all([
      this.prisma.consultant.findUnique({
        where: { id },
        select: { id: true, code: true, user: { select: { fullName: true } } },
      }),
      this.prisma.consultantEvaluation.findMany({
        where: { consultantId: id },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          scopeCompliance: true,
          timeCompliance: true,
          documentationOrder: true,
          processConsistency: true,
          qaOutcome: true,
          overallScore: true,
          caseComplexityCode: true,
          comments: true,
          createdAt: true,
          case: { select: { code: true, title: true } },
        },
      }),
      this.prisma.caseAssignment.findMany({
        where: { consultantId: id },
        select: {
          createdAt: true,
          isActive: true,
          case: {
            select: {
              id: true,
              code: true,
              title: true,
              status: true,
              complexityCode: true,
              closedAt: true,
            },
          },
        },
      }),
    ]);

    if (!consultant) throw new NotFoundError('el consultor', id);

    const closed = assignments.filter((item) => item.case.closedAt !== null).length;
    const averages =
      evaluations.length === 0
        ? null
        : {
            overall: avg(evaluations.map((item) => Number(item.overallScore))),
            scopeCompliance: avg(evaluations.map((item) => item.scopeCompliance)),
            timeCompliance: avg(evaluations.map((item) => item.timeCompliance)),
            documentationOrder: avg(evaluations.map((item) => item.documentationOrder)),
            processConsistency: avg(evaluations.map((item) => item.processConsistency)),
            qaOutcome: avg(evaluations.map((item) => item.qaOutcome)),
          };

    return {
      consultant: { id: consultant.id, code: consultant.code, fullName: consultant.user.fullName },
      totals: {
        assignedCases: assignments.length,
        activeCases: assignments.filter((item) => item.isActive && !item.case.closedAt).length,
        closedCases: closed,
        evaluations: evaluations.length,
      },
      complexityBreakdown: countBy(
        assignments.map((item) => item.case.complexityCode ?? 'SIN_CLASIFICAR'),
      ),
      averages,
      evaluations,
      cases: assignments.map((item) => item.case),
      note:
        'Datos capturados para el futuro sistema de reputación. El MVP no calcula ni expone ' +
        'puntuaciones públicas (ver docs/architecture/source-discrepancies.md).',
    };
  }

  /** TC3 — clasificación y habilitación del consultor. */
  async classify(id: string, dto: ClassifyConsultantDto, actor: AuditActor) {
    const consultant = await this.prisma.consultant.findUnique({
      where: { id },
      select: {
        id: true,
        code: true,
        experienceLevelCode: true,
        maxComplexityCode: true,
        tier: true,
      },
    });
    if (!consultant) throw new NotFoundError('el consultor', id);

    return this.prisma.$transaction(async (tx) => {
      await this.lookups.assertValidCodes(tx, [
        {
          listCode: 'NIVEL_CONSULTOR',
          value: dto.experienceLevelCode,
          fieldLabel: 'nivel de experiencia',
        },
        {
          listCode: 'COMPLEJIDAD',
          value: dto.maxComplexityCode,
          fieldLabel: 'complejidad máxima habilitada',
        },
        ...dto.specialties.map((item) => ({
          listCode: 'ESPECIALIDAD',
          value: item.specialtyCode,
          fieldLabel: 'especialidad',
        })),
        ...dto.interventionTypeCodes.map((code) => ({
          listCode: 'TIPO_INTERVENCION',
          value: code,
          fieldLabel: 'tipo de intervención',
        })),
        ...(dto.sectorCodes ?? []).map((code) => ({
          listCode: 'SECTOR',
          value: code,
          fieldLabel: 'sector',
        })),
      ]);

      await tx.consultant.update({
        where: { id },
        data: {
          experienceLevelCode: dto.experienceLevelCode,
          maxComplexityCode: dto.maxComplexityCode,
          tier: dto.tier,
        },
      });

      // Las especialidades se reemplazan en bloque: es una reclasificación
      // completa, no un parche incremental.
      await tx.consultantSpecialty.deleteMany({ where: { consultantId: id } });
      await tx.consultantSpecialty.createMany({
        data: dto.specialties.map((item) => ({
          consultantId: id,
          specialtyCode: item.specialtyCode,
          subSpecialtyCode: item.subSpecialtyCode ?? null,
          yearsOfExperience: item.yearsOfExperience,
          isPrimary: item.isPrimary ?? false,
        })),
      });

      await tx.consultantScope.upsert({
        where: { consultantId: id },
        create: {
          consultantId: id,
          interventionTypeCodes: dto.interventionTypeCodes,
          sectorCodes: dto.sectorCodes ?? [],
          canBeLeadConsultant: dto.canBeLeadConsultant ?? true,
          canBeReviewer: dto.canBeReviewer ?? false,
          notes: dto.notes ?? null,
        },
        update: {
          interventionTypeCodes: dto.interventionTypeCodes,
          sectorCodes: dto.sectorCodes ?? [],
          canBeLeadConsultant: dto.canBeLeadConsultant ?? true,
          canBeReviewer: dto.canBeReviewer ?? false,
          notes: dto.notes ?? null,
        },
      });

      await this.audit.record(tx, actor, {
        action: 'CONSULTANT_CLASSIFIED',
        entity: 'Consultant',
        entityId: id,
        previousValue: {
          experienceLevelCode: consultant.experienceLevelCode,
          maxComplexityCode: consultant.maxComplexityCode,
          tier: consultant.tier,
        },
        newValue: {
          experienceLevelCode: dto.experienceLevelCode,
          maxComplexityCode: dto.maxComplexityCode,
          tier: dto.tier,
          specialties: dto.specialties.map((item) => item.specialtyCode),
        },
        metadata: { template: 'TC3' },
      });

      return this.findById(id);
    });
  }

  /** Cambio de estado del ciclo de vida (TC2 / TC7). */
  async changeStatus(id: string, dto: ChangeConsultantStatusDto, actor: AuditActor) {
    const consultant = await this.prisma.consultant.findUnique({
      where: { id },
      select: { id: true, code: true, status: true, maxComplexityCode: true },
    });
    if (!consultant) throw new NotFoundError('el consultor', id);

    if (consultant.status === dto.status) {
      throw new BusinessRuleError(
        'CONSULTANT_STATUS_UNCHANGED',
        `El consultor ya está en estado ${dto.status}.`,
      );
    }

    const allowed = STATUS_TRANSITIONS[consultant.status];
    if (!allowed.includes(dto.status)) {
      throw new BusinessRuleError(
        'INVALID_CONSULTANT_TRANSITION',
        `No se puede pasar de ${consultant.status} a ${dto.status}. Transiciones permitidas: ${allowed.join(', ')}.`,
        { from: consultant.status, allowed },
      );
    }

    // Habilitar exige haber clasificado: sin complejidad máxima no hay forma de
    // decidir a qué casos puede postularse.
    if (dto.status === ConsultantStatus.HABILITADO && !consultant.maxComplexityCode) {
      throw new BusinessRuleError(
        'CONSULTANT_NOT_CLASSIFIED',
        'Clasifique al consultor (TC3) antes de habilitarlo: falta la complejidad máxima habilitada.',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.consultant.update({
        where: { id },
        data: {
          status: dto.status,
          dueDiligenceNotes:
            dto.status === ConsultantStatus.HABILITADO ||
            dto.status === ConsultantStatus.CONDICIONADO
              ? dto.reason
              : undefined,
          dueDiligenceDecidedAt:
            dto.status === ConsultantStatus.HABILITADO ||
            dto.status === ConsultantStatus.CONDICIONADO
              ? new Date()
              : undefined,
        },
        select: { id: true, code: true, status: true },
      });

      await tx.consultantStatusHistory.create({
        data: {
          consultantId: id,
          previousStatus: consultant.status,
          newStatus: dto.status,
          reason: dto.reason,
          changedById: actor.id,
        },
      });

      await this.audit.record(tx, actor, {
        action: 'CONSULTANT_STATUS_CHANGED',
        entity: 'Consultant',
        entityId: id,
        previousValue: { status: consultant.status },
        newValue: { status: dto.status, reason: dto.reason },
        metadata: { template: dto.status === ConsultantStatus.HABILITADO ? 'TC2' : 'TC7' },
      });

      return updated;
    });
  }

  /** Perfil del consultor autenticado. */
  async me(user: AuthenticatedUser) {
    if (!user.consultantId) {
      throw new NotFoundError('el perfil de consultor del usuario');
    }
    return this.findById(user.consultantId);
  }

  async listSponsors() {
    return this.prisma.sponsor.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        code: true,
        name: true,
        country: true,
        city: true,
        contactName: true,
        _count: { select: { consultants: true } },
      },
    });
  }
}

export interface ConsultantListItem {
  id: string;
  code: string;
  fullName: string;
  email: string;
  status: ConsultantStatus;
  tier: string | null;
  engagementMode: string;
  experienceLevelCode: string | null;
  maxComplexityCode: string | null;
  yearsOfExperience: number;
  availability: string;
  sponsorName: string | null;
  specialties: { specialtyCode: string; isPrimary: boolean }[];
  assignedCases: number;
  applications: number;
  evaluations: number;
  createdAt: Date;
}

function avg(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 100) / 100;
}

function countBy(values: string[]): Record<string, number> {
  return values.reduce<Record<string, number>>((accumulator, value) => {
    accumulator[value] = (accumulator[value] ?? 0) + 1;
    return accumulator;
  }, {});
}
