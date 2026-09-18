import { Injectable } from '@nestjs/common';
import { Prisma, RoleCode } from '@prisma/client';
import { AuditService, type AuditActor } from '../../core/audit/audit.service';
import type { AuthenticatedUser } from '../../core/auth/auth.types';
import {
  BusinessRuleError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../../core/common/errors/domain.errors';
import { nextCode } from '../../core/common/utils/code-sequence.util';
import {
  extractCorporateDomain,
  normalizeCompanyName,
  normalizeTaxId,
} from '../../core/common/utils/text.util';
import { paginate, safeOrderBy, type PaginatedResult } from '../../core/common/dto/pagination.dto';
import { PrismaService, type TxClient } from '../../core/prisma/prisma.service';
import { CompanyMatchingService, type CompanyMatch } from './company-matching.service';
import type {
  CompanyListQueryDto,
  CreateCompanyContactDto,
  CreateCompanyDto,
} from './dto/companies.dto';

const SORTABLE = ['createdAt', 'name', 'code', 'country'] as const;

@Injectable()
export class CompaniesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly matching: CompanyMatchingService,
    private readonly audit: AuditService,
  ) {}

  /** Previsualización del matching; la usa el formulario de onboarding. */
  async preview(query: { name: string; taxId?: string; contactEmail?: string }) {
    const matches = await this.matching.findMatches(this.prisma, query);
    return {
      matches,
      blocking: this.matching.blocking(matches),
      canCreate: this.matching.blocking(matches).length === 0,
    };
  }

  /**
   * Crea una empresa aplicando el principio de empresa única.
   *
   * Tres caminos posibles:
   *  · `linkToCompanyId` — el usuario reconoció la coincidencia: se devuelve la
   *    empresa existente sin crear nada.
   *  · coincidencia EXACTA sin `linkToCompanyId` ni `forceCreate` — se rechaza
   *    con 409 y la lista de candidatas, para que el cliente decida.
   *  · sin coincidencia exacta — se crea.
   */
  async create(dto: CreateCompanyDto, user: AuthenticatedUser, actor: AuditActor) {
    if (dto.linkToCompanyId) {
      return this.findById(dto.linkToCompanyId);
    }

    const matches = await this.matching.findMatches(this.prisma, {
      name: dto.name,
      taxId: dto.taxId,
      contactEmail: dto.contactEmail,
    });
    const blocking = this.matching.blocking(matches);

    if (blocking.length > 0 && !dto.forceCreate) {
      throw new BusinessRuleError(
        'COMPANY_DUPLICATE_MATCH',
        'Ya existe una empresa que coincide con los datos suministrados. ' +
          'Vincule el caso a la empresa existente o justifique la creación de una nueva.',
        { matches, blocking },
      );
    }

    if (dto.forceCreate) {
      // Forzar la creación rompe el principio de empresa única: sólo advisory y
      // sólo con motivo, y queda en la bitácora para siempre.
      if (user.role !== RoleCode.ADVISORY && user.role !== RoleCode.SUPER_ADMIN) {
        throw new ForbiddenError(
          'Sólo Advisory puede crear una empresa a pesar de coincidencias exactas',
          'FORCE_CREATE_NOT_ALLOWED',
        );
      }
      if (!dto.forceCreateReason || dto.forceCreateReason.trim().length < 15) {
        throw new ValidationError(
          'Debe justificar (mínimo 15 caracteres) por qué se crea una empresa nueva pese a las coincidencias.',
        );
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const company = await this.createInTransaction(tx, dto, actor, {
        forced: Boolean(dto.forceCreate),
        forceReason: dto.forceCreateReason,
        matches,
      });
      return company;
    });
  }

  /**
   * Creación reutilizable desde el intake T1: forma parte de la misma
   * transacción que crea el usuario y el caso.
   */
  async createInTransaction(
    tx: TxClient,
    dto: CreateCompanyDto,
    actor: AuditActor,
    context?: { forced: boolean; forceReason?: string; matches?: CompanyMatch[] },
  ) {
    const code = await nextCode(tx, 'EMP');
    const taxId = dto.taxId?.trim() || null;

    const company = await tx.company.create({
      data: {
        code,
        name: dto.name.trim(),
        normalizedName: normalizeCompanyName(dto.name),
        taxId,
        emailDomain: dto.contactEmail ? extractCorporateDomain(dto.contactEmail) : null,
        country: dto.country.trim(),
        city: dto.city.trim(),
        sectorCode: dto.sectorCode ?? null,
        website: dto.website?.trim() || null,
        acceptedTermsAt: new Date(),
      },
      select: COMPANY_SELECT,
    });

    await this.audit.record(tx, actor, {
      action: 'COMPANY_CREATED',
      entity: 'Company',
      entityId: company.id,
      companyId: company.id,
      newValue: { code: company.code, name: company.name, taxId: company.taxId },
      metadata: context?.forced
        ? {
            forcedDespiteMatches: true,
            reason: context.forceReason,
            matchedCompanies: context.matches?.map((match) => match.code),
          }
        : undefined,
    });

    return company;
  }

  async findAll(query: CompanyListQueryDto): Promise<PaginatedResult<CompanyListItem>> {
    const where: Prisma.CompanyWhereInput = {};

    if (query.search) {
      const term = query.search.trim();
      where.OR = [
        { name: { contains: term, mode: 'insensitive' } },
        { code: { contains: term, mode: 'insensitive' } },
        { taxId: { contains: term, mode: 'insensitive' } },
        { normalizedName: { contains: normalizeCompanyName(term) } },
      ];
    }
    if (query.country) where.country = query.country;
    if (query.sectorCode) where.sectorCode = query.sectorCode;

    // Una sola ida a la base para datos y total.
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.company.findMany({
        where,
        select: {
          ...COMPANY_SELECT,
          _count: { select: { cases: true, contacts: true } },
        },
        orderBy: safeOrderBy(query, SORTABLE, 'createdAt'),
        skip: query.skip,
        take: query.take,
      }),
      this.prisma.company.count({ where }),
    ]);

    return paginate(
      rows.map((row) => ({
        ...row,
        casesCount: row._count.cases,
        contactsCount: row._count.contacts,
        _count: undefined,
      })) as CompanyListItem[],
      total,
      query,
    );
  }

  async findById(id: string) {
    const company = await this.prisma.company.findUnique({
      where: { id },
      select: {
        ...COMPANY_SELECT,
        contacts: {
          where: { isActive: true },
          orderBy: [{ isPrimary: 'desc' }, { fullName: 'asc' }],
          select: {
            id: true,
            fullName: true,
            jobTitle: true,
            email: true,
            phone: true,
            isPrimary: true,
          },
        },
        _count: { select: { cases: true } },
      },
    });

    if (!company) throw new NotFoundError('la empresa', id);
    return company;
  }

  /** Historial empresarial: todos los casos de la empresa (RF-004). */
  async findCases(id: string) {
    await this.assertExists(id);

    return this.prisma.case.findMany({
      where: { companyId: id },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        code: true,
        title: true,
        status: true,
        areaCode: true,
        complexityCode: true,
        createdAt: true,
        closedAt: true,
      },
    });
  }

  async addContact(companyId: string, dto: CreateCompanyContactDto, actor: AuditActor) {
    await this.assertExists(companyId);

    return this.prisma.$transaction(async (tx) => {
      if (dto.isPrimary) {
        // El índice único parcial `company_contacts_one_primary` sólo admite un
        // contacto principal activo: se degrada el anterior antes de insertar.
        await tx.companyContact.updateMany({
          where: { companyId, isPrimary: true, isActive: true },
          data: { isPrimary: false },
        });
      }

      const contact = await tx.companyContact.create({
        data: {
          companyId,
          fullName: dto.fullName,
          jobTitle: dto.jobTitle,
          email: dto.email,
          phone: dto.phone,
          isPrimary: dto.isPrimary ?? false,
        },
        select: {
          id: true,
          fullName: true,
          jobTitle: true,
          email: true,
          phone: true,
          isPrimary: true,
        },
      });

      await this.audit.record(tx, actor, {
        action: 'COMPANY_CONTACT_CREATED',
        entity: 'CompanyContact',
        entityId: contact.id,
        companyId,
        newValue: { fullName: contact.fullName, email: contact.email },
      });

      return contact;
    });
  }

  /** Comprueba que el usuario puede ver esta empresa. */
  assertCanRead(user: AuthenticatedUser, companyId: string): void {
    if (user.role === RoleCode.CLIENTE_MIPYME && user.companyId !== companyId) {
      throw new NotFoundError('la empresa', companyId);
    }
  }

  private async assertExists(id: string): Promise<void> {
    const exists = await this.prisma.company.findUnique({ where: { id }, select: { id: true } });
    if (!exists) throw new NotFoundError('la empresa', id);
  }

  /** Reutilizado por el intake: normaliza y prepara el dominio corporativo. */
  static buildNormalizedFields(input: { name: string; taxId?: string | null; email?: string | null }) {
    return {
      normalizedName: normalizeCompanyName(input.name),
      taxId: normalizeTaxId(input.taxId) ? (input.taxId?.trim() ?? null) : null,
      emailDomain: input.email ? extractCorporateDomain(input.email) : null,
    };
  }
}

const COMPANY_SELECT = {
  id: true,
  code: true,
  name: true,
  taxId: true,
  emailDomain: true,
  country: true,
  city: true,
  sectorCode: true,
  website: true,
  createdAt: true,
} as const;

export interface CompanyListItem {
  id: string;
  code: string;
  name: string;
  taxId: string | null;
  emailDomain: string | null;
  country: string;
  city: string;
  sectorCode: string | null;
  website: string | null;
  createdAt: Date;
  casesCount: number;
  contactsCount: number;
}
