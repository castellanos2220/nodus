import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient, RoleCode, UserStatus } from '@prisma/client';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/core/prisma/prisma.service';
import { AuthService } from '../../src/modules/auth/auth.service';

export const TEST_PASSWORD = 'PruebasNodus2026*';

export interface TestContext {
  app: INestApplication;
  prisma: PrismaService;
  http: () => request.SuperTest<request.Test>;
}

/**
 * Levanta la aplicación real para las pruebas.
 *
 * Deliberadamente **no** se sustituyen los guards ni los servicios por dobles:
 * el objeto de estas pruebas es comprobar que la autorización y las reglas de
 * negocio funcionan de verdad. Un test que desactiva el guard que quiere probar
 * no prueba nada.
 */
export async function createTestApp(): Promise<TestContext> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();

  const app = moduleRef.createNestApplication();

  // La misma configuración que `main.ts`: si la validación difiere, las pruebas
  // dejan de representar al producto.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      validationError: { target: false, value: false },
    }),
  );
  app.setGlobalPrefix('api/v1');

  await app.init();

  const prisma = app.get(PrismaService);

  return {
    app,
    prisma,
    http: () => request(app.getHttpServer()) as unknown as request.SuperTest<request.Test>,
  };
}

/** Vacía los datos de negocio conservando la configuración de plataforma. */
export async function resetBusinessData(prisma: PrismaService): Promise<void> {
  // TRUNCATE ignora los triggers de inmutabilidad por fila, que es lo correcto
  // aquí: la inmutabilidad protege la operación, no la preparación de pruebas.
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "audit_logs", "notifications", "sla_alerts", "sla_escalations", "sla_instances",
      "deliverable_versions", "deliverables", "incidents", "milestones", "activities",
      "meetings", "communications", "advisory_reviews",
      "closure_checklist_items", "closure_checklists", "closure_declarations",
      "customer_closure_responses", "customer_evaluations", "consultant_evaluations",
      "contract_evidences", "contract_checklist_items", "contract_checklists",
      "operational_frameworks",
      "customer_decisions", "proposal_adjustments", "proposal_reviews",
      "proposal_versions", "proposals",
      "application_evaluations", "case_assignments", "applications",
      "case_status_history", "case_classifications", "cases",
      "document_accesses", "document_versions", "documents",
      "company_contacts", "companies",
      "consultant_status_history", "consultant_scopes", "consultant_specialties",
      "consultants", "sponsors",
      "refresh_tokens", "users",
      "code_sequences"
    RESTART IDENTITY CASCADE
  `);
}

export interface SeededUser {
  id: string;
  email: string;
  token: string;
}

/** Crea un usuario con el rol indicado y devuelve su token de acceso. */
export async function createUser(
  ctx: TestContext,
  input: {
    email: string;
    fullName: string;
    role: RoleCode;
    companyId?: string;
  },
): Promise<SeededUser> {
  const role = await ctx.prisma.role.findUniqueOrThrow({
    where: { code: input.role },
    select: { id: true },
  });

  const user = await ctx.prisma.user.create({
    data: {
      email: input.email,
      fullName: input.fullName,
      passwordHash: await AuthService.hashPassword(TEST_PASSWORD),
      roleId: role.id,
      companyId: input.companyId ?? null,
      status: UserStatus.ACTIVO,
    },
    select: { id: true, email: true },
  });

  const token = await login(ctx, input.email);
  return { id: user.id, email: user.email, token };
}

export async function login(ctx: TestContext, email: string): Promise<string> {
  const response = await ctx
    .http()
    .post('/api/v1/auth/login')
    .send({ email, password: TEST_PASSWORD })
    .expect(200);

  return (response.body as { accessToken: string }).accessToken;
}

export type { PrismaClient };
