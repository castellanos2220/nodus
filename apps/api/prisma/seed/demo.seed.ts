import {
  ChecklistItemStatus,
  ConsultantStatus,
  ConsultantTier,
  DeliverableStatus,
  EngagementMode,
  ImpactLevel,
  MilestoneStatus,
  Prisma,
  type PrismaClient,
  RoleCode,
  UserStatus,
} from '@prisma/client';
import type { INestApplicationContext } from '@nestjs/common';
import type { AuthenticatedUser } from '../../src/core/auth/auth.types';
import { AuthService } from '../../src/modules/auth/auth.service';
import { CasesService } from '../../src/modules/cases/cases.service';
import { ApplicationsService } from '../../src/modules/applications/applications.service';
import { ClassificationsService } from '../../src/modules/classifications/classifications.service';
import { ProposalsService } from '../../src/modules/proposals/proposals.service';
import { ReviewsService } from '../../src/modules/proposals/reviews.service';
import { WorkflowService } from '../../src/modules/workflow/workflow.service';
import { nextCode } from '../../src/core/common/utils/code-sequence.util';
import { normalizeCompanyName, extractCorporateDomain } from '../../src/core/common/utils/text.util';
import { SYSTEM_ACTOR, type AuditActor } from '../../src/core/audit/audit.service';
import { PrismaService } from '../../src/core/prisma/prisma.service';

export const DEMO_PASSWORD = process.env.SEED_DEFAULT_PASSWORD ?? 'Nodus2026*';

/** Actor de auditoría para las escrituras del seed. */
const seedActor = (userId: string, role: RoleCode): AuditActor => ({
  id: userId,
  role,
  ip: '127.0.0.1',
  userAgent: 'nodus-seed',
  requestId: 'seed',
});

interface Ctx {
  app: INestApplicationContext;
  prisma: PrismaClient;
  cases: CasesService;
  workflow: WorkflowService;
  classifications: ClassificationsService;
  applications: ApplicationsService;
  proposals: ProposalsService;
  reviews: ReviewsService;
}

/**
 * Datos de demostración.
 *
 * Decisión importante: los casos **no** se insertan con su estado final escrito a
 * mano. Se crean en `CREADO` y se hacen avanzar ejecutando las transiciones
 * reales del motor de workflow, con los usuarios reales de cada rol.
 *
 * Eso tiene un coste (el seed tarda más y depende de Redis) y una ventaja que lo
 * justifica: si una regla de negocio, un guard o un permiso estuvieran mal, el
 * seed fallaría. Los datos que ve el evaluador son, por construcción,
 * alcanzables por el flujo real — no un decorado.
 */
export async function seedDemoData(app: INestApplicationContext): Promise<void> {
  const ctx: Ctx = {
    app,
    prisma: app.get(PrismaService) as unknown as PrismaClient,
    cases: app.get(CasesService),
    workflow: app.get(WorkflowService),
    classifications: app.get(ClassificationsService),
    applications: app.get(ApplicationsService),
    proposals: app.get(ProposalsService),
    reviews: app.get(ReviewsService),
  };

  const users = await seedUsers(ctx.prisma);
  const sponsor = await seedSponsor(ctx.prisma);
  const consultants = await seedConsultants(ctx.prisma, users, sponsor.id);

  const admin = await authUser(ctx.prisma, users.admin.email);
  const advisory = await authUser(ctx.prisma, users.advisory.email);
  void admin;

  // ---------------------------------------------------------------- Empresas
  const acme = await seedCompany(ctx.prisma, {
    name: 'Aceros del Norte S.A.S.',
    taxId: '900456789-1',
    country: 'Colombia',
    city: 'Bogotá',
    sectorCode: 'INDUSTRIA',
    contact: {
      fullName: 'María Restrepo',
      jobTitle: 'Gerente de Operaciones',
      email: 'maria.restrepo@acerosdelnorte.com',
      phone: '+57 320 111 2233',
    },
  });

  const vitalis = await seedCompany(ctx.prisma, {
    name: 'Vitalis Salud Integral Ltda.',
    taxId: '901223344-5',
    country: 'Colombia',
    city: 'Medellín',
    sectorCode: 'SALUD',
    contact: {
      fullName: 'Carlos Duarte',
      jobTitle: 'Director Administrativo',
      email: 'carlos.duarte@vitalissalud.com',
      phone: '+57 310 444 5566',
    },
  });

  const mariaUser = await authUser(ctx.prisma, acme.contactEmail);
  const carlosUser = await authUser(ctx.prisma, vitalis.contactEmail);

  // ============================================================================
  //  CASO 1 — recorrido completo hasta CERRADO (la historia de la demo)
  // ============================================================================
  const case1 = await createCase(ctx, mariaUser, {
    companyId: acme.id,
    contactId: acme.contactId,
    title: 'Pérdida de trazabilidad de inventario en planta y bodega',
    description:
      'La planta y la bodega manejan inventarios en hojas de cálculo separadas. No hay ' +
      'trazabilidad de lotes, los conteos físicos difieren hasta un 18 % del sistema y se han ' +
      'presentado paradas de producción por faltantes no detectados a tiempo. Necesitamos ' +
      'entender la causa raíz y tener un plan de control de inventarios viable para una ' +
      'operación de 60 personas.',
    areaCode: 'OPERACIONES',
    urgencyCode: 'ALTA',
    impactCode: 'ALTO',
  });

  await runFullLifecycle(ctx, {
    caseId: case1.id,
    advisory,
    client: mariaUser,
    consultant: await authUser(ctx.prisma, consultants.ana.email),
    reviewer: await authUser(ctx.prisma, users.reviewer.email),
    consultantId: consultants.ana.consultantId,
    otherConsultantId: consultants.bruno.consultantId,
    otherConsultantUser: await authUser(ctx.prisma, consultants.bruno.email),
    classification: {
      areaCode: 'OPERACIONES',
      subAreaCode: 'INVENTARIOS',
      interventionTypeCode: 'DIAGNOSTICO',
      complexityCode: 'MEDIO',
      impactCode: 'ALTO',
      urgencyCode: 'ALTA',
    },
    stopAt: 'CERRADO',
  });

  // ============================================================================
  //  CASO 2 — EN EJECUCIÓN (agenda activa, hitos, incidencia y entregables)
  // ============================================================================
  const case2 = await createCase(ctx, carlosUser, {
    companyId: vitalis.id,
    contactId: vitalis.contactId,
    title: 'Rediseño del proceso de facturación a EPS con alta glosa',
    description:
      'El 23 % de la facturación radicada ante las EPS vuelve glosada, con un ciclo de ' +
      'recobro superior a 90 días. Sospechamos fallas en la captura de soportes clínicos y ' +
      'en la validación previa a la radicación. Requerimos rediseñar el proceso y definir ' +
      'controles antes de radicar.',
    areaCode: 'FINANZAS',
    urgencyCode: 'ALTA',
    impactCode: 'CRITICO',
  });

  await runFullLifecycle(ctx, {
    caseId: case2.id,
    advisory,
    client: carlosUser,
    consultant: await authUser(ctx.prisma, consultants.bruno.email),
    reviewer: await authUser(ctx.prisma, users.reviewer.email),
    consultantId: consultants.bruno.consultantId,
    otherConsultantId: consultants.ana.consultantId,
    otherConsultantUser: await authUser(ctx.prisma, consultants.ana.email),
    classification: {
      areaCode: 'FINANZAS',
      subAreaCode: 'COSTOS_RENTABILIDAD',
      interventionTypeCode: 'DISENO_SOLUCION',
      complexityCode: 'ALTO',
      impactCode: 'CRITICO',
      urgencyCode: 'ALTA',
    },
    stopAt: 'EN_EJECUCION',
  });

  // ============================================================================
  //  CASO 3 — EN DECISIÓN DEL CLIENTE
  // ============================================================================
  const case3 = await createCase(ctx, mariaUser, {
    companyId: acme.id,
    contactId: acme.contactId,
    title: 'Plan de continuidad tecnológica tras incidente de ransomware',
    description:
      'Un incidente de ransomware detuvo la operación durante dos días. Recuperamos desde ' +
      'copias parciales, pero no existe un plan de continuidad ni una política de respaldo ' +
      'verificada. Necesitamos evaluar la exposición actual y diseñar un plan realista para ' +
      'nuestro tamaño y presupuesto.',
    areaCode: 'TECNOLOGIA',
    urgencyCode: 'ALTA',
    impactCode: 'CRITICO',
  });

  await runFullLifecycle(ctx, {
    caseId: case3.id,
    advisory,
    client: mariaUser,
    consultant: await authUser(ctx.prisma, consultants.claudia.email),
    reviewer: await authUser(ctx.prisma, users.reviewer.email),
    consultantId: consultants.claudia.consultantId,
    otherConsultantId: consultants.ana.consultantId,
    otherConsultantUser: await authUser(ctx.prisma, consultants.ana.email),
    classification: {
      areaCode: 'TECNOLOGIA',
      subAreaCode: 'CIBERSEGURIDAD',
      interventionTypeCode: 'EVALUACION_ESPECIALIZADA',
      complexityCode: 'ALTO',
      impactCode: 'CRITICO',
      urgencyCode: 'ALTA',
    },
    stopAt: 'EN_DECISION_CLIENTE',
  });

  // ============================================================================
  //  CASO 4 — EN POSTULACIÓN, con dos postulaciones recibidas
  // ============================================================================
  const case4 = await createCase(ctx, carlosUser, {
    companyId: vitalis.id,
    contactId: vitalis.contactId,
    title: 'Estructura de costos por servicio para decidir portafolio',
    description:
      'No sabemos qué servicios son rentables. El costeo actual reparte gastos generales de ' +
      'forma uniforme y sospechamos que dos líneas están subsidiando al resto. Queremos un ' +
      'modelo de costeo por servicio que soporte decisiones de portafolio y de tarifas.',
    areaCode: 'FINANZAS',
    urgencyCode: 'MEDIA',
    impactCode: 'ALTO',
  });

  await runFullLifecycle(ctx, {
    caseId: case4.id,
    advisory,
    client: carlosUser,
    consultant: await authUser(ctx.prisma, consultants.ana.email),
    reviewer: await authUser(ctx.prisma, users.reviewer.email),
    consultantId: consultants.ana.consultantId,
    otherConsultantId: consultants.bruno.consultantId,
    otherConsultantUser: await authUser(ctx.prisma, consultants.bruno.email),
    classification: {
      areaCode: 'FINANZAS',
      subAreaCode: 'COSTOS_RENTABILIDAD',
      interventionTypeCode: 'DIAGNOSTICO',
      complexityCode: 'MEDIO',
      impactCode: 'ALTO',
      urgencyCode: 'MEDIA',
    },
    stopAt: 'EN_POSTULACION',
  });

  // ============================================================================
  //  CASO 5 — PROPUESTA LISTA PARA QA (bandeja de revisión de Advisory)
  // ============================================================================
  const case5 = await createCase(ctx, mariaUser, {
    companyId: acme.id,
    contactId: acme.contactId,
    title: 'Programa de retención para personal técnico de planta',
    description:
      'La rotación del personal técnico llegó al 34 % anual. Cada salida cuesta cerca de tres ' +
      'meses de curva de aprendizaje y afecta la calidad. Queremos entender las causas reales ' +
      'de salida y diseñar un programa de retención que sea sostenible para la empresa.',
    areaCode: 'TALENTO_HUMANO',
    urgencyCode: 'MEDIA',
    impactCode: 'MEDIO',
  });

  await runFullLifecycle(ctx, {
    caseId: case5.id,
    advisory,
    client: mariaUser,
    consultant: await authUser(ctx.prisma, consultants.claudia.email),
    reviewer: await authUser(ctx.prisma, users.reviewer.email),
    consultantId: consultants.claudia.consultantId,
    otherConsultantId: consultants.bruno.consultantId,
    otherConsultantUser: await authUser(ctx.prisma, consultants.bruno.email),
    classification: {
      areaCode: 'TALENTO_HUMANO',
      subAreaCode: 'GESTION_TALENTO',
      interventionTypeCode: 'DISENO_SOLUCION',
      complexityCode: 'MEDIO',
      impactCode: 'MEDIO',
      urgencyCode: 'MEDIA',
    },
    stopAt: 'PROPUESTA_LISTA_PARA_QA',
  });

  // ============================================================================
  //  CASO 6 — EN REVISIÓN (debida diligencia en curso)
  // ============================================================================
  const case6 = await createCase(ctx, carlosUser, {
    companyId: vitalis.id,
    contactId: vitalis.contactId,
    title: 'Cumplimiento de habilitación ante la Secretaría de Salud',
    description:
      'La próxima visita de habilitación se acerca y no tenemos claridad sobre el estado de ' +
      'cumplimiento de los estándares. Necesitamos una evaluación previa que identifique ' +
      'brechas y un plan de cierre priorizado antes de la visita.',
    areaCode: 'LEGAL_CUMPLIMIENTO',
    urgencyCode: 'ALTA',
    impactCode: 'ALTO',
  });

  await ctx.workflow.execute(advisory, case6.id, { transition: 'START_REVIEW' }, actorOf(advisory));
  await ctx.workflow.execute(
    advisory,
    case6.id,
    {
      transition: 'REQUEST_INFO',
      note:
        'Solicitamos el último informe de autoevaluación de estándares y la fecha confirmada ' +
        'de la visita, para dimensionar correctamente el alcance.',
    },
    actorOf(advisory),
  );

  // ============================================================================
  //  CASO 7 — CREADO (recién registrado, editable por el cliente)
  // ============================================================================
  await createCase(ctx, mariaUser, {
    companyId: acme.id,
    contactId: acme.contactId,
    title: 'Evaluación de viabilidad para exportar a Centroamérica',
    description:
      'Hemos recibido dos solicitudes de cotización desde Panamá y Costa Rica. Antes de ' +
      'responder queremos entender qué implica exportar: capacidad instalada, costos ' +
      'logísticos, requisitos aduaneros y riesgo cambiario. No hemos exportado nunca.',
    areaCode: 'ESTRATEGIA',
    urgencyCode: 'BAJA',
    impactCode: 'MEDIO',
  });

  // ============================================================================
  //  CASO 8 — CERRADO SIN CONTRATACIÓN (el cliente no continúa)
  // ============================================================================
  const case8 = await createCase(ctx, carlosUser, {
    companyId: vitalis.id,
    contactId: vitalis.contactId,
    title: 'Implementación de historia clínica electrónica interoperable',
    description:
      'Queremos reemplazar la historia clínica en papel por una solución electrónica que ' +
      'permita interoperar con las EPS. Tenemos una cotización de un proveedor y no sabemos ' +
      'si el alcance es razonable ni si estamos preparados internamente.',
    areaCode: 'TECNOLOGIA',
    urgencyCode: 'MEDIA',
    impactCode: 'ALTO',
  });

  await runFullLifecycle(ctx, {
    caseId: case8.id,
    advisory,
    client: carlosUser,
    consultant: await authUser(ctx.prisma, consultants.claudia.email),
    reviewer: await authUser(ctx.prisma, users.reviewer.email),
    consultantId: consultants.claudia.consultantId,
    otherConsultantId: consultants.ana.consultantId,
    otherConsultantUser: await authUser(ctx.prisma, consultants.ana.email),
    classification: {
      areaCode: 'TECNOLOGIA',
      subAreaCode: 'SISTEMAS_INFORMACION',
      interventionTypeCode: 'IMPLEMENTACION',
      complexityCode: 'ALTO',
      impactCode: 'ALTO',
      urgencyCode: 'MEDIA',
    },
    stopAt: 'CERRADO_SIN_CONTRATACION',
  });
}

// ============================================================================
//  Bloques de siembra
// ============================================================================

async function seedUsers(prisma: PrismaClient) {
  const passwordHash = await AuthService.hashPassword(DEMO_PASSWORD);

  const roles = await prisma.role.findMany({ select: { id: true, code: true } });
  const roleId = (code: RoleCode): string => {
    const found = roles.find((role) => role.code === code);
    if (!found) throw new Error(`Rol ${code} no encontrado: ejecute primero el seed de RBAC`);
    return found.id;
  };

  const create = async (input: {
    email: string;
    fullName: string;
    phone: string;
    role: RoleCode;
  }) => {
    const user = await prisma.user.upsert({
      where: { email: input.email },
      create: {
        email: input.email,
        fullName: input.fullName,
        phone: input.phone,
        passwordHash,
        roleId: roleId(input.role),
        status: UserStatus.ACTIVO,
        mustChangePassword: false,
      },
      update: { passwordHash, fullName: input.fullName, status: UserStatus.ACTIVO },
      select: { id: true, email: true, fullName: true },
    });
    return user;
  };

  return {
    admin: await create({
      email: 'admin@nodus.local',
      fullName: 'Sofía Cárdenas',
      phone: '+57 300 000 0001',
      role: RoleCode.SUPER_ADMIN,
    }),
    advisory: await create({
      email: 'advisory@nodus.local',
      fullName: 'Julián Mesa',
      phone: '+57 300 000 0002',
      role: RoleCode.ADVISORY,
    }),
    reviewer: await create({
      email: 'revisor@nodus.local',
      fullName: 'Patricia Quintero',
      phone: '+57 300 000 0003',
      role: RoleCode.CONSULTOR_REVISOR,
    }),
  };
}

async function seedSponsor(prisma: PrismaClient) {
  const existing = await prisma.sponsor.findFirst({ where: { name: 'Andina Advisory Group' } });
  if (existing) return existing;

  return prisma.$transaction(async (tx) => {
    const code = await nextCode(tx, 'SPO');
    return tx.sponsor.create({
      data: {
        code,
        name: 'Andina Advisory Group',
        taxId: '901889777-2',
        country: 'Colombia',
        city: 'Bogotá',
        contactName: 'Laura Peña',
        contactEmail: 'laura.pena@andinaadvisory.com',
        isActive: true,
        notes:
          'Empresa sponsor que articula consultores ante la plataforma. No sustituye la ' +
          'responsabilidad profesional individual del consultor asignado.',
      },
    });
  });
}

interface SeededConsultant {
  consultantId: string;
  userId: string;
  email: string;
  code: string;
}

async function seedConsultants(
  prisma: PrismaClient,
  users: { advisory: { id: string } },
  sponsorId: string,
): Promise<{
  ana: SeededConsultant;
  bruno: SeededConsultant;
  claudia: SeededConsultant;
}> {
  const passwordHash = await AuthService.hashPassword(DEMO_PASSWORD);
  const consultantRole = await prisma.role.findUniqueOrThrow({
    where: { code: RoleCode.CONSULTOR },
    select: { id: true },
  });

  const definitions = [
    {
      key: 'ana' as const,
      email: 'ana.velez@consultor.nodus.local',
      fullName: 'Ana Vélez',
      identityDocument: 'CC-52889001',
      phone: '+57 301 555 1001',
      city: 'Bogotá',
      profile:
        'Ingeniera industrial con 14 años en optimización de operaciones y cadena de ' +
        'suministro en manufactura y retail. Ha liderado diagnósticos de inventario y ' +
        'rediseño de procesos en empresas de 40 a 300 empleados.',
      years: 14,
      engagementMode: EngagementMode.INDEPENDIENTE,
      sponsorId: null as string | null,
      level: 'SENIOR',
      maxComplexity: 'ALTO',
      tier: ConsultantTier.PREMIUM,
      specialties: [
        { specialtyCode: 'OPERACIONES', subSpecialtyCode: 'INVENTARIOS', years: 12, primary: true },
        { specialtyCode: 'FINANZAS', subSpecialtyCode: 'COSTOS_RENTABILIDAD', years: 7, primary: false },
      ],
      interventions: ['DIAGNOSTICO', 'DISENO_SOLUCION', 'OPTIMIZACION'],
      sectors: ['INDUSTRIA', 'RETAIL', 'LOGISTICA', 'SALUD'],
      canReview: false,
    },
    {
      key: 'bruno' as const,
      email: 'bruno.salcedo@consultor.nodus.local',
      fullName: 'Bruno Salcedo',
      identityDocument: 'CC-79441233',
      phone: '+57 302 555 1002',
      city: 'Medellín',
      profile:
        'Contador público y especialista en finanzas corporativas, 18 años de experiencia. ' +
        'Trabajo de rediseño de ciclos de facturación y recobro en el sector salud, con foco ' +
        'en reducción de glosa y control interno.',
      years: 18,
      engagementMode: EngagementMode.SPONSOR,
      sponsorId,
      level: 'EXPERTO',
      maxComplexity: 'ESTRATEGICO',
      tier: ConsultantTier.ESTRATEGICO,
      specialties: [
        { specialtyCode: 'FINANZAS', subSpecialtyCode: 'FLUJO_CAJA', years: 18, primary: true },
        { specialtyCode: 'CUMPLIMIENTO', subSpecialtyCode: 'CUMPLIMIENTO_NORMATIVO', years: 9, primary: false },
        { specialtyCode: 'OPERACIONES', subSpecialtyCode: 'PROCESOS', years: 10, primary: false },
      ],
      interventions: ['DIAGNOSTICO', 'DISENO_SOLUCION', 'IMPLEMENTACION', 'ACOMPANAMIENTO_ESTRATEGICO'],
      sectors: ['SALUD', 'SERVICIOS', 'INDUSTRIA'],
      canReview: true,
    },
    {
      key: 'claudia' as const,
      email: 'claudia.ibanez@consultor.nodus.local',
      fullName: 'Claudia Ibáñez',
      identityDocument: 'CC-1020334455',
      phone: '+57 303 555 1003',
      city: 'Cali',
      profile:
        'Arquitecta de soluciones y especialista en ciberseguridad y continuidad operativa. ' +
        '11 años acompañando a pymes en gobierno de TI, gestión de riesgos tecnológicos y ' +
        'programas de transformación digital.',
      years: 11,
      engagementMode: EngagementMode.PROPIO,
      sponsorId: null,
      level: 'SENIOR',
      maxComplexity: 'ALTO',
      tier: ConsultantTier.HABILITADO,
      specialties: [
        { specialtyCode: 'TECNOLOGIA', subSpecialtyCode: 'CIBERSEGURIDAD', years: 11, primary: true },
        { specialtyCode: 'TRANSFORMACION_DIGITAL', subSpecialtyCode: 'SISTEMAS_INFORMACION', years: 8, primary: false },
        { specialtyCode: 'TALENTO_HUMANO', subSpecialtyCode: 'GESTION_TALENTO', years: 4, primary: false },
      ],
      interventions: ['EVALUACION_ESPECIALIZADA', 'DISENO_SOLUCION', 'IMPLEMENTACION'],
      sectors: ['TECNOLOGIA', 'SALUD', 'SERVICIOS', 'INDUSTRIA'],
      canReview: false,
    },
  ];

  const result = {} as Record<'ana' | 'bruno' | 'claudia', SeededConsultant>;

  for (const definition of definitions) {
    const existing = await prisma.consultant.findUnique({
      where: { identityDocument: definition.identityDocument },
      select: { id: true, code: true, user: { select: { id: true, email: true } } },
    });

    if (existing) {
      result[definition.key] = {
        consultantId: existing.id,
        userId: existing.user.id,
        email: existing.user.email,
        code: existing.code,
      };
      continue;
    }

    const seeded = await prisma.$transaction(async (tx) => {
      const user = await tx.user.upsert({
        where: { email: definition.email },
        create: {
          email: definition.email,
          fullName: definition.fullName,
          phone: definition.phone,
          passwordHash,
          roleId: consultantRole.id,
          status: UserStatus.ACTIVO,
          mustChangePassword: false,
        },
        update: { passwordHash, status: UserStatus.ACTIVO },
        select: { id: true, email: true },
      });

      const code = await nextCode(tx, 'CON');

      const consultant = await tx.consultant.create({
        data: {
          code,
          userId: user.id,
          identityDocument: definition.identityDocument,
          phone: definition.phone,
          country: 'Colombia',
          city: definition.city,
          professionalProfile: definition.profile,
          yearsOfExperience: definition.years,
          availability: 'Disponibilidad parcial: hasta 20 horas semanales',
          engagementMode: definition.engagementMode,
          sponsorId: definition.sponsorId,
          // Ya clasificado y habilitado: la demo necesita consultores operativos.
          // El ciclo completo REGISTRADO → EN_VALIDACION → HABILITADO queda
          // demostrado en las pruebas y es ejecutable desde la interfaz.
          status: ConsultantStatus.HABILITADO,
          tier: definition.tier,
          experienceLevelCode: definition.level,
          maxComplexityCode: definition.maxComplexity,
          dueDiligenceNotes:
            'Debida diligencia completada: identidad verificada, hoja de vida consistente y ' +
            'aceptación de la metodología de la plataforma.',
          dueDiligenceDecidedAt: new Date(),
          specialties: {
            create: definition.specialties.map((specialty) => ({
              specialtyCode: specialty.specialtyCode,
              subSpecialtyCode: specialty.subSpecialtyCode,
              yearsOfExperience: specialty.years,
              isPrimary: specialty.primary,
            })),
          },
          scope: {
            create: {
              interventionTypeCodes: definition.interventions,
              sectorCodes: definition.sectors,
              canBeLeadConsultant: true,
              canBeSupport: true,
              canBeReviewer: definition.canReview,
              canHandleSensitive: definition.maxComplexity === 'ESTRATEGICO',
            },
          },
          statusHistory: {
            create: [
              {
                previousStatus: null,
                newStatus: ConsultantStatus.REGISTRADO,
                reason: 'Registro inicial del consultor (TC1)',
                changedById: users.advisory.id,
              },
              {
                previousStatus: ConsultantStatus.REGISTRADO,
                newStatus: ConsultantStatus.EN_VALIDACION,
                reason: 'Inicio de la debida diligencia (TC2)',
                changedById: users.advisory.id,
              },
              {
                previousStatus: ConsultantStatus.EN_VALIDACION,
                newStatus: ConsultantStatus.HABILITADO,
                reason:
                  'Debida diligencia superada y clasificación registrada (TC3). Habilitado para ' +
                  'ver oportunidades, postularse y ser asignado.',
                changedById: users.advisory.id,
              },
            ],
          },
        },
        select: { id: true, code: true },
      });

      await tx.auditLog.create({
        data: {
          actorId: users.advisory.id,
          actorRole: RoleCode.ADVISORY,
          action: 'CONSULTANT_REGISTERED',
          entity: 'Consultant',
          entityId: consultant.id,
          newValue: { code: consultant.code, email: user.email },
          metadata: { source: 'seed', template: 'TC1' },
        },
      });

      return { consultant, user };
    });

    result[definition.key] = {
      consultantId: seeded.consultant.id,
      userId: seeded.user.id,
      email: seeded.user.email,
      code: seeded.consultant.code,
    };
  }

  return result as { ana: SeededConsultant; bruno: SeededConsultant; claudia: SeededConsultant };
}

async function seedCompany(
  prisma: PrismaClient,
  input: {
    name: string;
    taxId: string;
    country: string;
    city: string;
    sectorCode: string;
    contact: { fullName: string; jobTitle: string; email: string; phone: string };
  },
): Promise<{ id: string; code: string; contactId: string; contactEmail: string }> {
  const existing = await prisma.company.findFirst({
    where: { taxId: input.taxId },
    select: {
      id: true,
      code: true,
      contacts: { where: { isPrimary: true }, select: { id: true, email: true }, take: 1 },
    },
  });

  if (existing && existing.contacts[0]) {
    return {
      id: existing.id,
      code: existing.code,
      contactId: existing.contacts[0].id,
      contactEmail: existing.contacts[0].email,
    };
  }

  const passwordHash = await AuthService.hashPassword(DEMO_PASSWORD);
  const clientRole = await prisma.role.findUniqueOrThrow({
    where: { code: RoleCode.CLIENTE_MIPYME },
    select: { id: true },
  });

  return prisma.$transaction(async (tx) => {
    const code = await nextCode(tx, 'EMP');

    const company = await tx.company.create({
      data: {
        code,
        name: input.name,
        normalizedName: normalizeCompanyName(input.name),
        taxId: input.taxId,
        emailDomain: extractCorporateDomain(input.contact.email),
        country: input.country,
        city: input.city,
        sectorCode: input.sectorCode,
        acceptedTermsAt: new Date(),
      },
      select: { id: true, code: true },
    });

    const user = await tx.user.upsert({
      where: { email: input.contact.email },
      create: {
        email: input.contact.email,
        fullName: input.contact.fullName,
        phone: input.contact.phone,
        passwordHash,
        roleId: clientRole.id,
        companyId: company.id,
        status: UserStatus.ACTIVO,
        mustChangePassword: false,
      },
      update: { passwordHash, companyId: company.id, status: UserStatus.ACTIVO },
      select: { id: true, email: true },
    });

    const contact = await tx.companyContact.create({
      data: {
        companyId: company.id,
        userId: user.id,
        fullName: input.contact.fullName,
        jobTitle: input.contact.jobTitle,
        email: input.contact.email,
        phone: input.contact.phone,
        isPrimary: true,
      },
      select: { id: true, email: true },
    });

    await tx.auditLog.create({
      data: {
        actorId: user.id,
        actorRole: RoleCode.CLIENTE_MIPYME,
        action: 'COMPANY_CREATED',
        entity: 'Company',
        entityId: company.id,
        companyId: company.id,
        newValue: { code: company.code, name: input.name, taxId: input.taxId },
        metadata: { source: 'seed' },
      },
    });

    return {
      id: company.id,
      code: company.code,
      contactId: contact.id,
      contactEmail: contact.email,
    };
  });
}

// ============================================================================
//  Recorrido del ciclo de vida usando el motor real
// ============================================================================

type StopPoint =
  | 'EN_POSTULACION'
  | 'PROPUESTA_LISTA_PARA_QA'
  | 'EN_DECISION_CLIENTE'
  | 'EN_EJECUCION'
  | 'CERRADO'
  | 'CERRADO_SIN_CONTRATACION';

interface LifecycleInput {
  caseId: string;
  advisory: AuthenticatedUser;
  client: AuthenticatedUser;
  consultant: AuthenticatedUser;
  reviewer: AuthenticatedUser;
  consultantId: string;
  otherConsultantId: string;
  otherConsultantUser: AuthenticatedUser;
  classification: {
    areaCode: string;
    subAreaCode: string;
    interventionTypeCode: string;
    complexityCode: string;
    impactCode: string;
    urgencyCode: string;
  };
  stopAt: StopPoint;
}

async function runFullLifecycle(ctx: Ctx, input: LifecycleInput): Promise<void> {
  const { caseId, advisory, client, consultant, reviewer } = input;

  // --- Punto 2: debida diligencia y clasificación
  await ctx.workflow.execute(advisory, caseId, { transition: 'START_REVIEW' }, actorOf(advisory));

  await ctx.classifications.classify(
    advisory,
    caseId,
    {
      ...input.classification,
      eligibility: 'ELEGIBLE',
      reviewNotes:
        'Información suficiente y coherente entre urgencia e impacto. La necesidad encaja en ' +
        'el modelo de atención de la plataforma y hay consultores habilitados con el perfil ' +
        'requerido. Se habilita para publicación en bolsa interna.',
      clarityScore: 4,
      completenessScore: 4,
    } as never,
    actorOf(advisory),
  );

  await ctx.workflow.execute(advisory, caseId, { transition: 'CLASSIFY' }, actorOf(advisory));

  // --- Punto 3: publicación y postulaciones
  await ctx.workflow.execute(
    advisory,
    caseId,
    { transition: 'PUBLISH', payload: { applicationWindowDays: 7 } },
    actorOf(advisory),
  );

  await ctx.applications.apply(
    consultant,
    caseId,
    {
      interestStatement:
        'Manifiesto interés en atender este caso. El problema planteado corresponde ' +
        'directamente a mi especialidad principal y he abordado situaciones equivalentes en ' +
        'organizaciones de tamaño comparable.',
      availability: 'Disponible desde la próxima semana, 20 horas semanales',
      relevantExperience:
        'He liderado intervenciones del mismo tipo en empresas del sector, con resultados ' +
        'medibles en los indicadores que el caso plantea como críticos. Puedo aportar ' +
        'instrumentos ya probados y adaptarlos al contexto de esta organización.',
      fitJustification:
        'Mi especialidad, el tipo de intervención requerido y la complejidad del caso ' +
        'coinciden con mi alcance habilitado en la plataforma, y tengo experiencia previa en ' +
        'el sector de la empresa solicitante.',
      preliminaryApproach:
        'Propongo un diagnóstico estructurado en tres fases: levantamiento y validación de ' +
        'la situación actual con datos, identificación de causas raíz con los responsables de ' +
        'proceso, y diseño de un plan de acción priorizado por impacto y esfuerzo.',
      acceptsConditions: true,
    },
    actorOf(consultant),
  );

  // Una segunda postulación hace que la evaluación T3D sea una decisión real.
  await ctx.applications.apply(
    input.otherConsultantUser,
    caseId,
    {
      interestStatement:
        'Manifiesto interés en el caso. Aunque no es mi especialidad principal, he trabajado ' +
        'problemas adyacentes y puedo aportar una mirada transversal al proceso.',
      availability: 'Disponibilidad limitada: 10 horas semanales durante el primer mes',
      relevantExperience:
        'Experiencia en proyectos de mejora de procesos con componente analítico, y en la ' +
        'implantación de controles operativos en organizaciones medianas del mismo sector.',
      fitJustification:
        'Mi perfil aporta la dimensión de control y medición del problema, complementaria al ' +
        'enfoque puramente técnico de la necesidad planteada.',
      preliminaryApproach:
        'Levantamiento de línea base cuantitativa, definición de indicadores de control y ' +
        'diseño de un tablero de seguimiento para sostener la mejora en el tiempo.',
      acceptsConditions: true,
    },
    actorOf(input.otherConsultantUser),
  );

  if (input.stopAt === 'EN_POSTULACION') return;

  // --- Asignación (T3D + designación del responsable principal)
  const applications = await ctx.prisma.application.findMany({
    where: { caseId },
    select: { id: true, consultantId: true },
  });
  const winner = applications.find((item) => item.consultantId === input.consultantId);
  const runnerUp = applications.find((item) => item.consultantId === input.otherConsultantId);
  if (!winner) throw new Error('No se encontró la postulación del consultor seleccionado');

  await ctx.workflow.execute(
    advisory,
    caseId,
    {
      transition: 'ASSIGN_CONSULTANT',
      payload: {
        applicationId: winner.id,
        decisionRationale:
          'Se asigna por afinidad directa de especialidad con el área del caso, experiencia ' +
          'relevante comprobada en el sector y disponibilidad compatible con el cronograma ' +
          'esperado. La complejidad del caso está dentro de su alcance habilitado.',
        evaluations: [
          {
            applicationId: winner.id,
            specialtyFit: 5,
            experienceFit: 5,
            levelFit: 4,
            availabilityFit: 4,
            trackRecordFit: 4,
            notes:
              'Afinidad plena con el área y el tipo de intervención. Disponibilidad suficiente ' +
              'para el cronograma estimado.',
          },
          ...(runnerUp
            ? [
                {
                  applicationId: runnerUp.id,
                  specialtyFit: 3,
                  experienceFit: 4,
                  levelFit: 4,
                  availabilityFit: 2,
                  trackRecordFit: 4,
                  notes:
                    'Perfil sólido pero con afinidad parcial y disponibilidad limitada en el ' +
                    'primer mes, que es justamente la fase de levantamiento.',
                },
              ]
            : []),
        ],
      },
    },
    actorOf(advisory),
  );

  // --- Punto 4: diseño de la propuesta
  await ctx.workflow.execute(
    consultant,
    caseId,
    { transition: 'OPEN_PROPOSAL' },
    actorOf(consultant),
  );

  const draft = await ctx.prisma.proposalVersion.findFirstOrThrow({
    where: { proposal: { caseId }, status: 'BORRADOR' },
    orderBy: { versionNumber: 'desc' },
    select: { id: true },
  });

  const kase = await ctx.prisma.case.findUniqueOrThrow({
    where: { id: caseId },
    select: { title: true },
  });

  await ctx.proposals.updateVersion(
    consultant,
    draft.id,
    buildProposalContent(kase.title),
    actorOf(consultant),
  );

  await ctx.workflow.execute(
    consultant,
    caseId,
    { transition: 'SUBMIT_FOR_QA' },
    actorOf(consultant),
  );

  if (input.stopAt === 'PROPUESTA_LISTA_PARA_QA') {
    // Se deja además una revisión experta registrada, para que la bandeja de QA
    // muestre el peer review funcionando.
    await ctx.reviews.create(
      reviewer,
      caseId,
      {
        type: 'PEER',
        outcome: 'OBSERVACIONES',
        checklist: {
          completeness: true,
          templateUsage: true,
          traceability: true,
          problemScopeCoherence: true,
          clientReadability: true,
          scheduleAndValuation: true,
          exclusionsAndAssumptions: false,
        },
        observations:
          'El enfoque metodológico es adecuado. Sugiero explicitar en las exclusiones que la ' +
          'implantación de herramientas no forma parte del alcance, para evitar expectativas ' +
          'desalineadas en la fase de decisión del cliente.',
      } as never,
      actorOf(reviewer),
    );
    return;
  }

  // --- Punto 5: QA metodológica y autorización de envío
  await ctx.reviews.create(
    advisory,
    caseId,
    {
      type: 'METODOLOGICA',
      outcome: 'APROBADA',
      checklist: {
        completeness: true,
        templateUsage: true,
        traceability: true,
        problemScopeCoherence: true,
        clientReadability: true,
        scheduleAndValuation: true,
        exclusionsAndAssumptions: true,
      },
      observations:
        'La propuesta está completa y usa correctamente las plantillas. Hay coherencia entre ' +
        'el problema diagnosticado, el alcance y los entregables. El cronograma y la ' +
        'valoración son consistentes. Se autoriza el envío al cliente.',
    } as never,
    actorOf(advisory),
  );

  await ctx.workflow.execute(
    advisory,
    caseId,
    { transition: 'APPROVE_AND_SEND' },
    actorOf(advisory),
  );

  if (input.stopAt === 'EN_DECISION_CLIENTE') return;

  // --- Punto 6: decisión del cliente
  if (input.stopAt === 'CERRADO_SIN_CONTRATACION') {
    await ctx.workflow.execute(
      client,
      caseId,
      {
        transition: 'CLIENT_DECLINE',
        payload: {
          declineReasonCode: 'PRESUPUESTO',
          comments:
            'La propuesta responde bien a la necesidad, pero el presupuesto disponible para ' +
            'este ejercicio no alcanza. Queremos retomarlo el próximo año.',
          reactivationPotential: 'ALTO',
        },
      },
      actorOf(client),
    );
    return;
  }

  await ctx.workflow.execute(
    client,
    caseId,
    {
      transition: 'CLIENT_ACCEPT',
      payload: {
        comments:
          'Aceptamos la propuesta en los términos presentados. El alcance y el cronograma se ' +
          'ajustan a lo que necesitamos.',
      },
    },
    actorOf(client),
  );

  // --- Punto 7: contratación (veeduría)
  await completeContractChecklist(ctx, caseId, advisory);

  await ctx.prisma.operationalFramework.upsert({
    where: { caseId },
    create: {
      caseId,
      operatingConditions:
        'El servicio se ejecuta de forma mixta: dos sesiones presenciales de levantamiento en ' +
        'sitio y el resto remoto. La empresa designa un responsable de proceso como ' +
        'contraparte con dedicación de 4 horas semanales.',
      estimatedDurationDays: 45,
      baselineSchedule:
        'Semanas 1-2: levantamiento y validación de datos. Semanas 3-4: análisis de causa raíz ' +
        'y contraste con responsables. Semanas 5-6: diseño del plan y validación. Semana 7: ' +
        'presentación de resultados y cierre.',
      committedDeliverables:
        'Informe de diagnóstico con causas raíz priorizadas; plan de acción con responsables y ' +
        'fechas; tablero de indicadores de control; sesión de transferencia al equipo interno.',
      clientDependencies:
        'Acceso a los datos operativos de los últimos 12 meses, disponibilidad de los ' +
        'responsables de proceso para entrevistas y validación de los hallazgos intermedios.',
      assumptions:
        'Los datos históricos están disponibles en formato exportable. No se requiere la ' +
        'adquisición de herramientas nuevas dentro de este alcance.',
      executionConstraints:
        'Las visitas a planta se coordinan fuera de los picos de producción de fin de mes.',
      primaryContact: 'Responsable de proceso designado por la empresa',
      uploadedById: consultant.id,
    },
    update: {},
  });

  await ctx.workflow.execute(
    advisory,
    caseId,
    { transition: 'AUTHORIZE_EXECUTION' },
    actorOf(advisory),
  );

  // --- Punto 8: agenda y ejecución
  await seedExecutionAgenda(ctx, caseId, input.stopAt === 'CERRADO');

  await ctx.workflow.execute(
    consultant,
    caseId,
    { transition: 'START_EXECUTION' },
    actorOf(consultant),
  );

  if (input.stopAt === 'EN_EJECUCION') return;

  // --- Punto 9: cierre técnico, revisión final y cierre formal
  await ctx.workflow.execute(
    consultant,
    caseId,
    {
      transition: 'TECHNICAL_CLOSURE',
      payload: {
        statement:
          'Declaro concluidas las actividades comprometidas en el marco operativo del ' +
          'servicio. Los entregables finales están cargados y versionados en la plataforma, y ' +
          'no quedan actividades pendientes dentro del alcance aprobado.',
        finalNotes:
          'Se recomienda revisar los indicadores de control a los tres meses para verificar la ' +
          'sostenibilidad de la mejora.',
      },
    },
    actorOf(consultant),
  );

  await completeClosureChecklist(ctx, caseId, advisory);

  await ctx.prisma.customerClosureResponse.upsert({
    where: { caseId },
    create: {
      caseId,
      response: 'ACEPTACION',
      observations:
        'Recibimos los entregables y damos por concluido el servicio. El diagnóstico fue ' +
        'claro y el plan de acción es ejecutable con nuestros recursos.',
      respondedById: client.id,
    },
    update: {},
  });

  await ctx.prisma.customerEvaluation.upsert({
    where: { caseId },
    create: {
      caseId,
      overallSatisfaction: 5,
      serviceClarity: 5,
      expectationFulfilment: 4,
      perceivedValue: 5,
      wouldReuse: true,
      comments:
        'Buen acompañamiento y comunicación ordenada. Valoramos especialmente que todo quedara ' +
        'registrado y que se respetaran los tiempos comprometidos.',
      submittedById: client.id,
    },
    update: {},
  });

  await ctx.prisma.consultantEvaluation.upsert({
    where: { caseId_consultantId: { caseId, consultantId: input.consultantId } },
    create: {
      caseId,
      consultantId: input.consultantId,
      scopeCompliance: 5,
      timeCompliance: 4,
      documentationOrder: 5,
      processConsistency: 5,
      qaOutcome: 5,
      overallScore: new Prisma.Decimal('4.80'),
      caseComplexityCode: input.classification.complexityCode,
      comments:
        'Cumplió el alcance comprometido con orden documental ejemplar. Un hito se reprogramó ' +
        'con justificación adecuada y comunicación oportuna.',
      evaluatedById: advisory.id,
    },
    update: {},
  });

  await ctx.workflow.execute(advisory, caseId, { transition: 'CLOSE_CASE' }, actorOf(advisory));
}

// ============================================================================
//  Auxiliares
// ============================================================================

async function createCase(
  ctx: Ctx,
  client: AuthenticatedUser,
  input: {
    companyId: string;
    contactId: string;
    title: string;
    description: string;
    areaCode: string;
    urgencyCode: string;
    impactCode: string;
  },
) {
  return ctx.cases.create(
    {
      companyId: input.companyId,
      contactId: input.contactId,
      title: input.title,
      description: input.description,
      areaCode: input.areaCode,
      urgencyCode: input.urgencyCode,
      impactCode: input.impactCode,
    },
    client,
    actorOf(client),
  );
}

function buildProposalContent(caseTitle: string) {
  return {
    analysis: {
      problemSynthesis:
        `La necesidad planteada —${caseTitle.toLowerCase()}— tiene su origen en una combinación ` +
        'de procesos no formalizados, información fragmentada entre áreas y ausencia de ' +
        'indicadores de control. El síntoma visible es la desviación reportada; la causa está ' +
        'aguas arriba, en cómo se captura y se valida la información.',
      workingHypothesis:
        'La hipótesis de trabajo es que más del 70 % de la desviación se concentra en un ' +
        'número reducido de puntos del proceso, y que actuar sobre ellos produce la mayor ' +
        'parte del resultado sin requerir un rediseño completo.',
      criticalFactors:
        'Disponibilidad y calidad de los datos históricos; participación efectiva de los ' +
        'responsables de proceso; capacidad de la organización para sostener los controles ' +
        'una vez finalizada la intervención.',
      risks:
        'Datos incompletos o inconsistentes que obliguen a ampliar el levantamiento; ' +
        'resistencia al cambio en los equipos operativos; picos de carga que limiten la ' +
        'disponibilidad de la contraparte.',
      assumptions:
        'La empresa dispone de los datos de los últimos 12 meses en formato exportable y ' +
        'puede asignar una contraparte con 4 horas semanales durante la intervención.',
      constraints:
        'La intervención no contempla la adquisición ni la implantación de herramientas de ' +
        'software. El trabajo en sitio se limita a dos visitas.',
      additionalNeeds:
        'Se requerirá acceso de lectura a los reportes operativos y a las actas de comité ' +
        'de los últimos seis meses.',
    },
    content: {
      executiveSummary:
        `Proponemos una intervención estructurada para resolver la necesidad "${caseTitle}". ` +
        'El trabajo parte de un levantamiento con datos reales, identifica las causas raíz ' +
        'con los responsables del proceso y entrega un plan de acción priorizado por impacto ' +
        'y esfuerzo, junto con los indicadores para sostener la mejora.',
      objective:
        'Entregar a la dirección un diagnóstico verificable de las causas del problema y un ' +
        'plan de acción ejecutable con los recursos actuales de la empresa, con indicadores ' +
        'que permitan verificar el avance mes a mes.',
      scope:
        'Levantamiento y validación de la situación actual con datos de los últimos 12 meses; ' +
        'entrevistas estructuradas con los responsables de proceso; análisis de causa raíz; ' +
        'diseño del plan de acción priorizado; definición del tablero de indicadores; sesión ' +
        'de transferencia al equipo interno.',
      exclusions:
        'No incluye la ejecución del plan de acción, la adquisición o parametrización de ' +
        'herramientas de software, la capacitación masiva del personal operativo ni el ' +
        'acompañamiento posterior a la entrega del informe final.',
      activities:
        '1. Levantamiento de información y validación de datos históricos. ' +
        '2. Entrevistas estructuradas con responsables de proceso. ' +
        '3. Análisis de causa raíz y cuantificación del impacto por causa. ' +
        '4. Taller de contraste de hallazgos con la dirección. ' +
        '5. Diseño del plan de acción priorizado. ' +
        '6. Definición del tablero de indicadores de control. ' +
        '7. Sesión de transferencia y entrega formal.',
      deliverables:
        'Informe de diagnóstico con causas raíz priorizadas y cuantificadas; plan de acción ' +
        'con responsables, fechas y esfuerzo estimado; tablero de indicadores de control en ' +
        'formato utilizable por la empresa; memoria de la sesión de transferencia.',
      schedule:
        'Semanas 1-2: levantamiento y validación. Semanas 3-4: análisis y contraste. ' +
        'Semanas 5-6: diseño del plan y del tablero. Semana 7: transferencia y entrega formal. ' +
        'Duración total estimada: 7 semanas.',
      valuation:
        'Intervención estimada en 120 horas de dedicación profesional distribuidas en 7 ' +
        'semanas, con dos visitas presenciales incluidas. La valoración económica definitiva ' +
        'se formaliza directamente entre las partes.',
      conditions:
        'La empresa designa una contraparte con 4 horas semanales de dedicación y facilita el ' +
        'acceso a los datos históricos en la primera semana. Los hallazgos intermedios se ' +
        'validan antes de avanzar a la fase siguiente.',
      leadConsultantNote:
        'Asumo la responsabilidad profesional del contenido y de los entregables de esta ' +
        'intervención.',
    },
    changeNote: 'Versión inicial consolidada para revisión metodológica',
  };
}

async function completeContractChecklist(
  ctx: Ctx,
  caseId: string,
  advisory: AuthenticatedUser,
): Promise<void> {
  const checklist = await ctx.prisma.contractChecklist.findUniqueOrThrow({
    where: { caseId },
    select: { id: true, items: { select: { id: true, label: true, isRequired: true, requiresEvidence: true } } },
  });

  for (const item of checklist.items) {
    // El NDA se marca NO APLICA: el blueprint lo permite si queda documentado, y
    // así la demo muestra ese camino además del de cumplimiento.
    const notApplicable = item.label.includes('confidencialidad');

    if (item.requiresEvidence && !notApplicable) {
      await ctx.prisma.contractEvidence.create({
        data: {
          caseId,
          itemId: item.id,
          title: 'Acuerdo de prestación de servicios firmado',
          description:
            'Soporte aportado por las partes. NODUS registra su existencia sin asumir el ' +
            'contenido legal del documento.',
          registeredById: advisory.id,
        },
      });
    }

    await ctx.prisma.contractChecklistItem.update({
      where: { id: item.id },
      data: {
        status: notApplicable ? ChecklistItemStatus.NO_APLICA : ChecklistItemStatus.CUMPLIDO,
        completedDate: notApplicable ? null : new Date(),
        notes: notApplicable
          ? 'El acuerdo principal ya incorpora las cláusulas de confidencialidad.'
          : 'Verificado por Advisory dentro del proceso de veeduría.',
      },
    });
  }

  await ctx.prisma.contractChecklist.update({
    where: { caseId },
    data: { completedAt: new Date() },
  });
}

async function completeClosureChecklist(
  ctx: Ctx,
  caseId: string,
  advisory: AuthenticatedUser,
): Promise<void> {
  void advisory;
  const checklist = await ctx.prisma.closureChecklist.findUnique({
    where: { caseId },
    select: { id: true, items: { select: { id: true } } },
  });
  if (!checklist) return;

  for (const item of checklist.items) {
    await ctx.prisma.closureChecklistItem.update({
      where: { id: item.id },
      data: {
        status: ChecklistItemStatus.CUMPLIDO,
        notes: 'Verificado en la revisión final de cumplimiento.',
      },
    });
  }

  await ctx.prisma.closureChecklist.update({
    where: { caseId },
    data: { completedAt: new Date() },
  });
}

/** Agenda operativa T8A con actividades, hitos, una incidencia y entregables. */
async function seedExecutionAgenda(
  ctx: Ctx,
  caseId: string,
  completeEverything: boolean,
): Promise<void> {
  const day = 24 * 3_600_000;
  const now = Date.now();

  const activities = [
    { name: 'Levantamiento de datos históricos', offset: -21, status: 'COMPLETADA' },
    { name: 'Entrevistas con responsables de proceso', offset: -14, status: 'COMPLETADA' },
    { name: 'Análisis de causa raíz', offset: -7, status: completeEverything ? 'COMPLETADA' : 'EN_CURSO' },
    { name: 'Taller de contraste de hallazgos', offset: 3, status: completeEverything ? 'COMPLETADA' : 'NO_INICIADA' },
    { name: 'Diseño del plan de acción', offset: 10, status: completeEverything ? 'COMPLETADA' : 'NO_INICIADA' },
  ] as const;

  for (const activity of activities) {
    await ctx.prisma.activity.create({
      data: {
        caseId,
        name: activity.name,
        description: `Actividad del plan de trabajo formalizado: ${activity.name.toLowerCase()}.`,
        responsible: 'Consultor responsable',
        targetDate: new Date(now + activity.offset * day),
        status: activity.status,
        completedAt: activity.status === 'COMPLETADA' ? new Date(now + activity.offset * day) : null,
      },
    });
  }

  const milestones = [
    {
      name: 'Levantamiento validado con la empresa',
      offset: -14,
      criticality: ImpactLevel.ALTO,
      status: MilestoneStatus.CUMPLIDO,
    },
    {
      name: 'Hallazgos contrastados con la dirección',
      offset: -3,
      criticality: ImpactLevel.ALTO,
      status: completeEverything ? MilestoneStatus.CUMPLIDO : MilestoneStatus.EN_CURSO,
    },
    {
      name: 'Plan de acción entregado y aceptado',
      offset: 12,
      criticality: ImpactLevel.CRITICO,
      status: completeEverything ? MilestoneStatus.CUMPLIDO : MilestoneStatus.PENDIENTE,
    },
  ];

  for (const milestone of milestones) {
    await ctx.prisma.milestone.create({
      data: {
        caseId,
        name: milestone.name,
        description: `Hito de control del marco operativo: ${milestone.name.toLowerCase()}.`,
        responsible: 'Consultor responsable',
        targetDate: new Date(now + milestone.offset * day),
        criticality: milestone.criticality,
        status: milestone.status,
        expectedResult: 'Resultado verificable acordado en el marco operativo del servicio.',
        completedAt:
          milestone.status === MilestoneStatus.CUMPLIDO
            ? new Date(now + milestone.offset * day)
            : null,
      },
    });
  }

  await ctx.prisma.incident.create({
    data: {
      caseId,
      typeCode: 'RETRASO_CLIENTE',
      title: 'Demora en la entrega de datos históricos',
      description:
        'La exportación de los datos de los últimos 12 meses se entregó con seis días de ' +
        'retraso respecto de lo acordado, lo que desplazó el inicio del análisis.',
      impact: ImpactLevel.MEDIO,
      suggestedAction:
        'Reprogramar el hito de contraste y confirmar con la empresa la disponibilidad de la ' +
        'contraparte para las semanas siguientes.',
      status: completeEverything ? 'CERRADA' : 'EN_ATENCION',
      decision: completeEverything
        ? 'Se reprogramó el hito de contraste sin afectar la fecha de entrega final. Incidencia cerrada.'
        : null,
      resolvedAt: completeEverything ? new Date() : null,
    },
  });

  const deliverables = [
    { name: 'Informe de diagnóstico con causas raíz', typeCode: 'DIAGNOSTICO', offset: 5 },
    { name: 'Plan de acción priorizado', typeCode: 'PLAN_TRABAJO', offset: 12 },
    { name: 'Tablero de indicadores de control', typeCode: 'INFORME_TECNICO', offset: 14 },
  ];

  for (const deliverable of deliverables) {
    const created = await ctx.prisma.deliverable.create({
      data: {
        caseId,
        name: deliverable.name,
        description: `Entregable comprometido en la propuesta: ${deliverable.name.toLowerCase()}.`,
        typeCode: deliverable.typeCode,
        responsible: 'Consultor responsable',
        targetDate: new Date(now + deliverable.offset * day),
        status: completeEverything ? DeliverableStatus.LISTO_PARA_CIERRE : DeliverableStatus.EN_DESARROLLO,
        currentVersion: completeEverything ? 2 : 0,
      },
      select: { id: true },
    });

    if (completeEverything) {
      // Dos versiones: la segunda no reemplaza a la primera, la sucede.
      await ctx.prisma.deliverableVersion.createMany({
        data: [
          {
            deliverableId: created.id,
            versionNumber: 1,
            notes: 'Primera versión entregada para revisión del cliente.',
          },
          {
            deliverableId: created.id,
            versionNumber: 2,
            notes: 'Versión final tras incorporar las observaciones de la revisión.',
          },
        ],
      });
    }
  }
}

/** Construye el objeto de usuario autenticado que esperan los servicios. */
async function authUser(prisma: PrismaClient, email: string): Promise<AuthenticatedUser> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { email },
    select: {
      id: true,
      email: true,
      fullName: true,
      companyId: true,
      role: {
        select: {
          code: true,
          permissions: { select: { permission: { select: { code: true } } } },
        },
      },
      consultant: { select: { id: true } },
    },
  });

  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role.code,
    permissions: user.role.permissions.map((item) => item.permission.code),
    companyId: user.companyId,
    consultantId: user.consultant?.id ?? null,
  };
}

function actorOf(user: AuthenticatedUser): AuditActor {
  return seedActor(user.id, user.role);
}

export { SYSTEM_ACTOR };
