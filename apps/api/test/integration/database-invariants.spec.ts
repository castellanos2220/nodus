import {
  CaseStatusCode,
  ConsultantStatus,
  EngagementMode,
  PrismaClient,
  ProposalVersionStatus,
  RoleCode,
  UserStatus,
} from '@prisma/client';

/**
 * Invariantes que viven en la **base de datos**, no en el código de aplicación.
 *
 * El brief es explícito en un punto (§17): «Debe existir un único CONSULTOR
 * RESPONSABLE PRINCIPAL. La base de datos debe proteger esa regla.» Un check en
 * el servicio no basta — dos peticiones concurrentes pueden pasarlo a la vez.
 *
 * Estas pruebas escriben directamente con Prisma, **saltándose deliberadamente
 * todos los servicios y guards**, para comprobar que la última línea de defensa
 * aguanta aunque el código de aplicación fallara.
 */
describe('Invariantes de base de datos (integración)', () => {
  const prisma = new PrismaClient();

  let companyId: string;
  let userId: string;
  let consultantAId: string;
  let consultantBId: string;

  beforeAll(async () => {
    await prisma.$executeRawUnsafe(`
      TRUNCATE TABLE
        "audit_logs", "case_assignments", "applications", "case_classifications",
        "case_status_history", "proposal_versions", "proposals", "cases",
        "document_versions", "documents",
        "consultant_scopes", "consultant_specialties", "consultant_status_history",
        "consultants", "company_contacts", "companies", "users"
      RESTART IDENTITY CASCADE
    `);

    const company = await prisma.company.create({
      data: {
        code: 'EMP-INV01',
        name: 'Empresa Invariantes',
        normalizedName: 'empresa invariantes',
        country: 'Colombia',
        city: 'Bogotá',
      },
      select: { id: true },
    });
    companyId = company.id;

    const role = await prisma.role.findUniqueOrThrow({
      where: { code: RoleCode.CONSULTOR },
      select: { id: true },
    });

    const makeConsultant = async (suffix: string): Promise<string> => {
      const user = await prisma.user.create({
        data: {
          email: `consultor-inv-${suffix}@test.local`,
          fullName: `Consultor ${suffix}`,
          passwordHash: 'no-usado-en-esta-prueba',
          roleId: role.id,
          status: UserStatus.ACTIVO,
        },
        select: { id: true },
      });
      userId = user.id;

      const consultant = await prisma.consultant.create({
        data: {
          code: `CON-INV${suffix}`,
          userId: user.id,
          identityDocument: `CC-INV-${suffix}`,
          phone: '+57 300 000 0000',
          country: 'Colombia',
          city: 'Bogotá',
          professionalProfile: 'Perfil de pruebas de invariantes de base de datos.',
          yearsOfExperience: 5,
          availability: 'Completa',
          engagementMode: EngagementMode.INDEPENDIENTE,
          status: ConsultantStatus.HABILITADO,
        },
        select: { id: true },
      });
      return consultant.id;
    };

    consultantAId = await makeConsultant('A');
    consultantBId = await makeConsultant('B');
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  const createCase = async (code: string): Promise<string> => {
    const kase = await prisma.case.create({
      data: {
        code,
        companyId,
        createdById: userId,
        title: `Caso ${code}`,
        description: 'Caso creado por la suite de invariantes de base de datos.',
        status: CaseStatusCode.ASIGNADO,
      },
      select: { id: true },
    });
    return kase.id;
  };

  // ==========================================================================
  //  Responsable principal único
  // ==========================================================================

  describe('un único consultor responsable principal activo por caso', () => {
    it('rechaza una segunda asignación principal activa', async () => {
      const caseId = await createCase('CAS-INV01');

      await prisma.caseAssignment.create({
        data: {
          caseId,
          consultantId: consultantAId,
          isPrimary: true,
          isActive: true,
          decisionRationale: 'Primera asignación',
        },
      });

      await expect(
        prisma.caseAssignment.create({
          data: {
            caseId,
            consultantId: consultantBId,
            isPrimary: true,
            isActive: true,
            decisionRationale: 'Segunda asignación: debe rechazarse',
          },
        }),
      ).rejects.toThrow();
    });

    it('permite reasignar si la anterior se desactiva primero', async () => {
      const caseId = await createCase('CAS-INV02');

      const first = await prisma.caseAssignment.create({
        data: {
          caseId,
          consultantId: consultantAId,
          isPrimary: true,
          isActive: true,
          decisionRationale: 'Asignación inicial',
        },
        select: { id: true },
      });

      await prisma.caseAssignment.update({
        where: { id: first.id },
        data: { isActive: false, unassignedAt: new Date(), unassignedReason: 'Reasignación' },
      });

      // Con la anterior inactiva, la nueva sí entra: el historial se conserva.
      const second = await prisma.caseAssignment.create({
        data: {
          caseId,
          consultantId: consultantBId,
          isPrimary: true,
          isActive: true,
          decisionRationale: 'Nueva asignación tras reasignar',
        },
        select: { id: true },
      });

      expect(second.id).toBeTruthy();
      expect(await prisma.caseAssignment.count({ where: { caseId } })).toBe(2);
    });

    it('permite varios consultores de apoyo sin romper la regla', async () => {
      const caseId = await createCase('CAS-INV03');

      await prisma.caseAssignment.create({
        data: {
          caseId,
          consultantId: consultantAId,
          isPrimary: true,
          isActive: true,
          decisionRationale: 'Responsable principal',
        },
      });

      const support = await prisma.caseAssignment.create({
        data: {
          caseId,
          consultantId: consultantBId,
          isPrimary: false,
          isActive: true,
          decisionRationale: 'Consultor de apoyo',
        },
        select: { id: true },
      });

      expect(support.id).toBeTruthy();
    });
  });

  // ==========================================================================
  //  Una sola clasificación vigente
  // ==========================================================================

  it('sólo admite una clasificación vigente por caso', async () => {
    const caseId = await createCase('CAS-INV04');

    const data = {
      caseId,
      areaCode: 'OPERACIONES',
      interventionTypeCode: 'DIAGNOSTICO',
      complexityCode: 'MEDIO',
      impactCode: 'ALTO',
      urgencyCode: 'ALTA',
      eligibility: 'ELEGIBLE' as const,
      reviewNotes: 'Clasificación de prueba con observaciones suficientes.',
      isCurrent: true,
    };

    await prisma.caseClassification.create({ data });
    await expect(prisma.caseClassification.create({ data })).rejects.toThrow();
  });

  // ==========================================================================
  //  Bitácora append-only
  // ==========================================================================

  describe('bitácora de auditoría append-only', () => {
    it('permite insertar', async () => {
      const entry = await prisma.auditLog.create({
        data: {
          action: 'PRUEBA_INSERCION',
          entity: 'Test',
          companyId,
          newValue: { ok: true },
        },
        select: { id: true },
      });
      expect(entry.id).toBeTruthy();
    });

    it('rechaza cualquier modificación', async () => {
      const entry = await prisma.auditLog.findFirstOrThrow({ select: { id: true } });

      await expect(
        prisma.auditLog.update({
          where: { id: entry.id },
          data: { action: 'ACCION_MANIPULADA' },
        }),
      ).rejects.toThrow();
    });

    it('rechaza cualquier borrado', async () => {
      const entry = await prisma.auditLog.findFirstOrThrow({ select: { id: true } });
      await expect(prisma.auditLog.delete({ where: { id: entry.id } })).rejects.toThrow();
    });

    it('rechaza también el borrado masivo', async () => {
      await expect(prisma.auditLog.deleteMany({ where: { entity: 'Test' } })).rejects.toThrow();
    });
  });

  // ==========================================================================
  //  Versiones de propuesta congeladas
  // ==========================================================================

  describe('inmutabilidad de versiones de propuesta congeladas', () => {
    it('permite editar mientras está en borrador', async () => {
      const caseId = await createCase('CAS-INV05');
      const proposal = await prisma.proposal.create({
        data: { caseId, currentVersionNumber: 1 },
        select: { id: true },
      });

      const version = await prisma.proposalVersion.create({
        data: {
          proposalId: proposal.id,
          versionNumber: 1,
          status: ProposalVersionStatus.BORRADOR,
          content: { scope: 'alcance inicial' },
        },
        select: { id: true },
      });

      const updated = await prisma.proposalVersion.update({
        where: { id: version.id },
        data: { content: { scope: 'alcance revisado' } },
        select: { content: true },
      });

      expect((updated.content as { scope: string }).scope).toBe('alcance revisado');
    });

    it('rechaza modificar el contenido de una versión congelada', async () => {
      const version = await prisma.proposalVersion.findFirstOrThrow({ select: { id: true } });

      await prisma.proposalVersion.update({
        where: { id: version.id },
        data: { status: ProposalVersionStatus.EN_QA, frozenAt: new Date() },
      });

      await expect(
        prisma.proposalVersion.update({
          where: { id: version.id },
          data: { content: { scope: 'intento de sobrescritura' } },
        }),
      ).rejects.toThrow();
    });

    it('sí permite avanzar el estado de una versión congelada', async () => {
      const version = await prisma.proposalVersion.findFirstOrThrow({ select: { id: true } });

      const sent = await prisma.proposalVersion.update({
        where: { id: version.id },
        data: { status: ProposalVersionStatus.ENVIADA, sentAt: new Date() },
        select: { status: true },
      });

      expect(sent.status).toBe(ProposalVersionStatus.ENVIADA);
    });

    it('impide dos borradores simultáneos en la misma propuesta', async () => {
      const caseId = await createCase('CAS-INV06');
      const proposal = await prisma.proposal.create({
        data: { caseId, currentVersionNumber: 1 },
        select: { id: true },
      });

      await prisma.proposalVersion.create({
        data: { proposalId: proposal.id, versionNumber: 1, status: ProposalVersionStatus.BORRADOR },
      });

      await expect(
        prisma.proposalVersion.create({
          data: {
            proposalId: proposal.id,
            versionNumber: 2,
            status: ProposalVersionStatus.BORRADOR,
          },
        }),
      ).rejects.toThrow();
    });
  });

  // ==========================================================================
  //  Identidad única
  // ==========================================================================

  describe('identificadores únicos', () => {
    it('no permite dos consultores con el mismo documento de identidad', async () => {
      const role = await prisma.role.findUniqueOrThrow({
        where: { code: RoleCode.CONSULTOR },
        select: { id: true },
      });

      const user = await prisma.user.create({
        data: {
          email: 'duplicado@test.local',
          fullName: 'Consultor Duplicado',
          passwordHash: 'x',
          roleId: role.id,
        },
        select: { id: true },
      });

      await expect(
        prisma.consultant.create({
          data: {
            code: 'CON-INVDUP',
            userId: user.id,
            identityDocument: 'CC-INV-A', // ya usado por el consultor A
            phone: '+57 300 000 0000',
            country: 'Colombia',
            city: 'Bogotá',
            professionalProfile: 'Intento de duplicar el consultor por documento.',
            yearsOfExperience: 3,
            availability: 'Completa',
            engagementMode: EngagementMode.INDEPENDIENTE,
          },
        }),
      ).rejects.toThrow();
    });

    it('no permite dos usuarios con el mismo correo', async () => {
      const role = await prisma.role.findUniqueOrThrow({
        where: { code: RoleCode.CONSULTOR },
        select: { id: true },
      });

      await expect(
        prisma.user.create({
          data: {
            email: 'duplicado@test.local',
            fullName: 'Otro usuario',
            passwordHash: 'x',
            roleId: role.id,
          },
        }),
      ).rejects.toThrow();
    });

    it('no permite un consultor postulado dos veces al mismo caso', async () => {
      const caseId = await createCase('CAS-INV07');

      const application = {
        caseId,
        consultantId: consultantAId,
        interestStatement: 'Interés en el caso, con la extensión mínima requerida por el modelo.',
        availability: 'Disponible',
        relevantExperience: 'Experiencia relevante descrita con el detalle suficiente.',
        fitJustification: 'Justificación de pertinencia con el detalle suficiente.',
        preliminaryApproach: 'Enfoque preliminar con el detalle suficiente para la prueba.',
        acceptsConditions: true,
      };

      await prisma.application.create({ data: application });
      await expect(prisma.application.create({ data: application })).rejects.toThrow();
    });
  });
});
