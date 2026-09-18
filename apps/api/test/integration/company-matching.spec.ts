import { PrismaClient } from '@prisma/client';
import { CompanyMatchingService } from '../../src/modules/companies/company-matching.service';
import { normalizeCompanyName } from '../../src/core/common/utils/text.util';

/**
 * Principio **Empresa Única – Casos Múltiples** (RF-002, RF-003).
 *
 * Estas pruebas corren contra PostgreSQL de verdad porque el matching por
 * nombre usa `similarity()` de pg_trgm: probarlo con un doble sería probar el
 * doble, no el producto. Si el índice o la extensión faltaran, aquí se vería.
 */
describe('CompanyMatchingService (integración)', () => {
  const prisma = new PrismaClient();
  const matching = new CompanyMatchingService();

  beforeAll(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "company_contacts", "companies" RESTART IDENTITY CASCADE',
    );

    await prisma.company.create({
      data: {
        code: 'EMP-MATCH01',
        name: 'Aceros del Norte S.A.S.',
        normalizedName: normalizeCompanyName('Aceros del Norte S.A.S.'),
        taxId: '900456789-1',
        emailDomain: 'acerosdelnorte.com',
        country: 'Colombia',
        city: 'Bogotá',
        contacts: {
          create: {
            fullName: 'María Restrepo',
            jobTitle: 'Gerente',
            email: 'maria.restrepo@acerosdelnorte.com',
            phone: '+57 320 111 2233',
            isPrimary: true,
          },
        },
      },
    });

    await prisma.company.create({
      data: {
        code: 'EMP-MATCH02',
        name: 'Vitalis Salud Integral Ltda.',
        normalizedName: normalizeCompanyName('Vitalis Salud Integral Ltda.'),
        taxId: '901223344-5',
        emailDomain: 'vitalissalud.com',
        country: 'Colombia',
        city: 'Medellín',
      },
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('coincidencia exacta (bloquea la creación)', () => {
    it('detecta el mismo NIT aunque se escriba con puntos y guiones', async () => {
      const matches = await matching.findMatches(prisma, {
        name: 'Otra Razón Social Completamente Distinta',
        taxId: '900.456.789-1',
      });

      const blocking = matching.blocking(matches);
      expect(blocking).toHaveLength(1);
      expect(blocking[0]!.code).toBe('EMP-MATCH01');
      expect(blocking[0]!.matchedOn).toBe('taxId');
    });

    it('detecta un correo de contacto ya registrado', async () => {
      const matches = await matching.findMatches(prisma, {
        name: 'Empresa Nueva',
        contactEmail: 'maria.restrepo@acerosdelnorte.com',
      });

      const blocking = matching.blocking(matches);
      expect(blocking).toHaveLength(1);
      expect(blocking[0]!.matchedOn).toBe('contactEmail');
    });
  });

  describe('coincidencia fuerte (sugiere, no bloquea)', () => {
    it('reconoce el dominio corporativo', async () => {
      const matches = await matching.findMatches(prisma, {
        name: 'Departamento de Compras',
        contactEmail: 'compras@acerosdelnorte.com',
      });

      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0]!.code).toBe('EMP-MATCH01');
      expect(matching.blocking(matches)).toHaveLength(0);
    });

    it('ignora los dominios genéricos: no identifican a una empresa', async () => {
      const matches = await matching.findMatches(prisma, {
        name: 'Startup Sin Relación',
        contactEmail: 'fundador@gmail.com',
      });

      expect(matches).toHaveLength(0);
    });
  });

  describe('coincidencia por similitud de nombre (pg_trgm)', () => {
    it('reconoce la misma empresa escrita sin sufijo societario', async () => {
      const matches = await matching.findMatches(prisma, { name: 'Aceros del Norte' });

      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0]!.code).toBe('EMP-MATCH01');
      expect(matches[0]!.matchedOn).toBe('name');
      expect(matches[0]!.similarity).toBeGreaterThanOrEqual(0.6);
    });

    it('reconoce la misma empresa en mayúsculas y con otra forma societaria', async () => {
      const matches = await matching.findMatches(prisma, { name: 'ACEROS DEL NORTE SAS' });
      expect(matches.map((item) => item.code)).toContain('EMP-MATCH01');
    });

    it('no confunde empresas con nombres parecidos pero distintos', async () => {
      const matches = await matching.findMatches(prisma, { name: 'Maderas del Sur' });
      expect(matches).toHaveLength(0);
    });

    it('no mezcla las dos empresas registradas', async () => {
      const matches = await matching.findMatches(prisma, { name: 'Vitalis Salud Integral' });
      expect(matches.map((item) => item.code)).toEqual(['EMP-MATCH02']);
    });
  });

  describe('agregación de coincidencias', () => {
    it('devuelve una sola entrada por empresa, con la confianza más alta', async () => {
      const matches = await matching.findMatches(prisma, {
        name: 'Aceros del Norte',
        taxId: '900456789-1',
        contactEmail: 'maria.restrepo@acerosdelnorte.com',
      });

      // Tres criterios apuntan a la misma empresa: una entrada, confianza EXACT.
      expect(matches).toHaveLength(1);
      expect(matches[0]!.confidence).toBe('EXACT');
    });

    it('informa cuántos casos tiene ya la empresa encontrada', async () => {
      const matches = await matching.findMatches(prisma, { taxId: '900456789-1', name: 'x' });
      expect(matches[0]!.existingCases).toBe(0);
    });
  });
});
