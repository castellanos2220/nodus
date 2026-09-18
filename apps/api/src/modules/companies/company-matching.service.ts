import { Injectable } from '@nestjs/common';
import type { TxClient } from '../../core/prisma/prisma.service';
import {
  extractCorporateDomain,
  normalizeCompanyName,
  normalizeTaxId,
} from '../../core/common/utils/text.util';

/** Fuerza de la coincidencia. `EXACT` bloquea la creación; el resto sugiere. */
export type MatchConfidence = 'EXACT' | 'STRONG' | 'LIKELY';

export interface CompanyMatch {
  companyId: string;
  code: string;
  name: string;
  taxId: string | null;
  emailDomain: string | null;
  country: string;
  city: string;
  confidence: MatchConfidence;
  matchedOn: 'taxId' | 'contactEmail' | 'emailDomain' | 'name';
  reason: string;
  similarity?: number;
  existingCases: number;
}

export interface MatchQuery {
  name: string;
  taxId?: string | null;
  contactEmail?: string | null;
}

/** Umbral de similitud de trigramas para considerar dos nombres "el mismo". */
const NAME_SIMILARITY_THRESHOLD = 0.6;

/**
 * Principio **Empresa Única – Casos Múltiples** (RF-002, RF-003).
 *
 * Antes de crear una empresa, se busca si ya existe. El orden de los criterios
 * es el orden de confianza con que identifican a una organización:
 *
 *  1. **NIT/RUT normalizado** — identifica sin ambigüedad. Coincidencia ⇒ bloquea.
 *  2. **Correo del contacto** — el mismo correo ya está registrado. ⇒ bloquea.
 *  3. **Dominio corporativo** — `@acerosdelnorte.com` identifica a la empresa,
 *     pero `@gmail.com` no identifica a nadie: los dominios genéricos se
 *     descartan explícitamente. ⇒ sugiere con fuerza.
 *  4. **Nombre normalizado por similitud de trigramas** — "Aceros del Norte
 *     S.A.S." y "ACEROS DEL NORTE" son la misma empresa. ⇒ sugiere.
 *
 * Cambiar de contacto **nunca** crea una empresa nueva: ése es exactamente el
 * error que el principio existe para evitar.
 */
@Injectable()
export class CompanyMatchingService {
  async findMatches(tx: TxClient, query: MatchQuery): Promise<CompanyMatch[]> {
    const normalizedName = normalizeCompanyName(query.name);
    const taxId = normalizeTaxId(query.taxId);
    const email = query.contactEmail?.trim().toLowerCase() ?? null;
    const domain = email ? extractCorporateDomain(email) : null;

    const matches = new Map<string, CompanyMatch>();

    const add = (match: CompanyMatch): void => {
      const existing = matches.get(match.companyId);
      if (!existing || rank(match.confidence) > rank(existing.confidence)) {
        matches.set(match.companyId, match);
      }
    };

    // ---------------------------------------------------- 1. NIT / RUT exacto
    if (taxId) {
      const rows = await tx.$queryRaw<CompanyRow[]>`
        SELECT c."id", c."code", c."name", c."taxId", c."emailDomain", c."country", c."city",
               (SELECT COUNT(*)::int FROM "cases" k WHERE k."companyId" = c."id") AS "existingCases"
        FROM "companies" c
        WHERE regexp_replace(upper(coalesce(c."taxId", '')), '[^A-Z0-9]', '', 'g') = ${taxId}
        LIMIT 5
      `;
      for (const row of rows) {
        add({
          ...toBase(row),
          confidence: 'EXACT',
          matchedOn: 'taxId',
          reason: `Ya existe una empresa registrada con el mismo número de identificación (${row.taxId}).`,
        });
      }
    }

    // ------------------------------------------- 2. Correo de contacto exacto
    if (email) {
      const contacts = await tx.companyContact.findMany({
        where: { email },
        select: {
          company: {
            select: {
              id: true,
              code: true,
              name: true,
              taxId: true,
              emailDomain: true,
              country: true,
              city: true,
              _count: { select: { cases: true } },
            },
          },
        },
        take: 5,
      });

      for (const contact of contacts) {
        const company = contact.company;
        add({
          companyId: company.id,
          code: company.code,
          name: company.name,
          taxId: company.taxId,
          emailDomain: company.emailDomain,
          country: company.country,
          city: company.city,
          existingCases: company._count.cases,
          confidence: 'EXACT',
          matchedOn: 'contactEmail',
          reason: `El correo ${email} ya está registrado como contacto de esta empresa.`,
        });
      }
    }

    // ------------------------------------------------ 3. Dominio corporativo
    if (domain) {
      const companies = await tx.company.findMany({
        where: { emailDomain: domain },
        select: {
          id: true,
          code: true,
          name: true,
          taxId: true,
          emailDomain: true,
          country: true,
          city: true,
          _count: { select: { cases: true } },
        },
        take: 5,
      });

      for (const company of companies) {
        add({
          companyId: company.id,
          code: company.code,
          name: company.name,
          taxId: company.taxId,
          emailDomain: company.emailDomain,
          country: company.country,
          city: company.city,
          existingCases: company._count.cases,
          confidence: 'STRONG',
          matchedOn: 'emailDomain',
          reason: `Ya hay una empresa registrada con el dominio corporativo @${domain}.`,
        });
      }
    }

    // ------------------------------------------ 4. Nombre por similitud (pg_trgm)
    if (normalizedName.length >= 3) {
      const rows = await tx.$queryRaw<Array<CompanyRow & { similarity: number }>>`
        SELECT c."id", c."code", c."name", c."taxId", c."emailDomain", c."country", c."city",
               similarity(c."normalizedName", ${normalizedName}) AS "similarity",
               (SELECT COUNT(*)::int FROM "cases" k WHERE k."companyId" = c."id") AS "existingCases"
        FROM "companies" c
        WHERE similarity(c."normalizedName", ${normalizedName}) >= ${NAME_SIMILARITY_THRESHOLD}
        ORDER BY "similarity" DESC
        LIMIT 5
      `;

      for (const row of rows) {
        add({
          ...toBase(row),
          similarity: Number(row.similarity),
          confidence: row.similarity >= 0.95 ? 'STRONG' : 'LIKELY',
          matchedOn: 'name',
          reason:
            row.similarity >= 0.95
              ? `El nombre coincide casi exactamente con "${row.name}".`
              : `El nombre se parece a "${row.name}" (${Math.round(Number(row.similarity) * 100)} % de similitud).`,
        });
      }
    }

    return [...matches.values()].sort((a, b) => rank(b.confidence) - rank(a.confidence));
  }

  /** Coincidencias que impiden crear una empresa nueva sin decisión explícita. */
  blocking(matches: CompanyMatch[]): CompanyMatch[] {
    return matches.filter((match) => match.confidence === 'EXACT');
  }
}

interface CompanyRow {
  id: string;
  code: string;
  name: string;
  taxId: string | null;
  emailDomain: string | null;
  country: string;
  city: string;
  existingCases: number;
}

function toBase(row: CompanyRow): Omit<CompanyMatch, 'confidence' | 'matchedOn' | 'reason'> {
  return {
    companyId: row.id,
    code: row.code,
    name: row.name,
    taxId: row.taxId,
    emailDomain: row.emailDomain,
    country: row.country,
    city: row.city,
    existingCases: Number(row.existingCases),
  };
}

function rank(confidence: MatchConfidence): number {
  return confidence === 'EXACT' ? 3 : confidence === 'STRONG' ? 2 : 1;
}
