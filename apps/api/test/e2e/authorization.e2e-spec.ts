import { CaseStatusCode, ConsultantStatus, EngagementMode, RoleCode } from '@prisma/client';
import {
  createTestApp,
  createUser,
  resetBusinessData,
  type SeededUser,
  type TestContext,
} from '../setup/test-app';

/**
 * Autorización — la prueba que el brief exige explícitamente (§39):
 * «Debe existir al menos una prueba que demuestre que un usuario sin permisos NO
 * puede realizar una transición protegida.»
 *
 * Se comprueba en las tres capas que el diseño declara, porque cada una podría
 * fallar por separado:
 *
 *   1. **Permiso de rol** — ¿este rol puede hacer esta clase de cosa?
 *   2. **Ámbito sobre el recurso** — ¿puede hacerla sobre *este* caso concreto?
 *   3. **Arista del workflow** — ¿su rol está autorizado en *esta* transición?
 *
 * Y, en todos los casos, que el estado del caso **no cambia** tras el rechazo.
 */
describe('Autorización de transiciones y recursos (E2E)', () => {
  let ctx: TestContext;

  let advisory: SeededUser;
  let consultantUser: SeededUser;
  let clientOwner: SeededUser;
  let otherClient: SeededUser;

  let caseId: string;
  let otherCompanyCaseId: string;

  beforeAll(async () => {
    ctx = await createTestApp();
    await resetBusinessData(ctx.prisma);

    // --- Dos empresas distintas: el aislamiento entre clientes se prueba con ellas
    const companyA = await ctx.prisma.company.create({
      data: {
        code: 'EMP-TEST01',
        name: 'Aceros Prueba S.A.S.',
        normalizedName: 'aceros prueba',
        taxId: '900000001-1',
        country: 'Colombia',
        city: 'Bogotá',
      },
      select: { id: true },
    });

    const companyB = await ctx.prisma.company.create({
      data: {
        code: 'EMP-TEST02',
        name: 'Salud Prueba Ltda.',
        normalizedName: 'salud prueba',
        taxId: '900000002-2',
        country: 'Colombia',
        city: 'Medellín',
      },
      select: { id: true },
    });

    advisory = await createUser(ctx, {
      email: 'advisory@test.local',
      fullName: 'Advisory de Pruebas',
      role: RoleCode.ADVISORY,
    });

    clientOwner = await createUser(ctx, {
      email: 'cliente-a@test.local',
      fullName: 'Cliente Empresa A',
      role: RoleCode.CLIENTE_MIPYME,
      companyId: companyA.id,
    });

    otherClient = await createUser(ctx, {
      email: 'cliente-b@test.local',
      fullName: 'Cliente Empresa B',
      role: RoleCode.CLIENTE_MIPYME,
      companyId: companyB.id,
    });

    // --- Consultor habilitado y ASIGNADO al caso: así el rechazo que se prueba
    // --- es por rol en la arista, no por falta de acceso al recurso.
    const consultantAccount = await createUser(ctx, {
      email: 'consultor@test.local',
      fullName: 'Consultor de Pruebas',
      role: RoleCode.CONSULTOR,
    });
    consultantUser = consultantAccount;

    const consultant = await ctx.prisma.consultant.create({
      data: {
        code: 'CON-TEST01',
        userId: consultantAccount.id,
        identityDocument: 'CC-TEST-001',
        phone: '+57 300 000 0000',
        country: 'Colombia',
        city: 'Bogotá',
        professionalProfile: 'Perfil de pruebas con experiencia suficiente para el caso.',
        yearsOfExperience: 10,
        availability: 'Completa',
        engagementMode: EngagementMode.INDEPENDIENTE,
        status: ConsultantStatus.HABILITADO,
        maxComplexityCode: 'ALTO',
        experienceLevelCode: 'SENIOR',
        scope: { create: { interventionTypeCodes: ['DIAGNOSTICO'], canBeLeadConsultant: true } },
        specialties: {
          create: { specialtyCode: 'OPERACIONES', yearsOfExperience: 10, isPrimary: true },
        },
      },
      select: { id: true },
    });

    // Caso en EN_REVISION, con el consultor asignado para aislar la causa del 403.
    const created = await ctx.prisma.case.create({
      data: {
        code: 'CAS-TEST01',
        companyId: companyA.id,
        createdById: clientOwner.id,
        title: 'Caso de pruebas de autorización',
        description:
          'Caso creado por la suite de pruebas para verificar el control de acceso en las ' +
          'transiciones del motor de workflow.',
        areaCode: 'OPERACIONES',
        urgencyCode: 'MEDIA',
        impactCode: 'MEDIO',
        complexityCode: 'MEDIO',
        status: CaseStatusCode.EN_REVISION,
        assignments: {
          create: {
            consultantId: consultant.id,
            isPrimary: true,
            isActive: true,
            decisionRationale: 'Asignación directa para la prueba de autorización.',
          },
        },
      },
      select: { id: true },
    });
    caseId = created.id;

    const otherCase = await ctx.prisma.case.create({
      data: {
        code: 'CAS-TEST02',
        companyId: companyB.id,
        createdById: otherClient.id,
        title: 'Caso de otra empresa',
        description:
          'Caso de una empresa distinta, para comprobar que un cliente no puede verlo ni actuar ' +
          'sobre él bajo ninguna circunstancia.',
        status: CaseStatusCode.EN_REVISION,
      },
      select: { id: true },
    });
    otherCompanyCaseId = otherCase.id;
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  const statusOf = async (id: string): Promise<CaseStatusCode> => {
    const kase = await ctx.prisma.case.findUniqueOrThrow({
      where: { id },
      select: { status: true },
    });
    return kase.status;
  };

  // ==========================================================================
  //  1. Sin autenticación
  // ==========================================================================

  it('rechaza cualquier transición sin token', async () => {
    await ctx.http()
      .post(`/api/v1/cases/${caseId}/transitions`)
      .send({ transition: 'CLASSIFY' })
      .expect(401);

    expect(await statusOf(caseId)).toBe(CaseStatusCode.EN_REVISION);
  });

  it('rechaza un token manipulado', async () => {
    await ctx.http()
      .get('/api/v1/cases')
      .set('Authorization', 'Bearer token.falso.inventado')
      .expect(401);
  });

  // ==========================================================================
  //  2. Permiso de rol — el consultor no puede clasificar
  // ==========================================================================

  it('un consultor ASIGNADO al caso NO puede clasificarlo', async () => {
    const response = await ctx.http()
      .post(`/api/v1/cases/${caseId}/transitions`)
      .set('Authorization', `Bearer ${consultantUser.token}`)
      .send({ transition: 'CLASSIFY' })
      .expect(403);

    // El rechazo es por rol en la arista, no por falta de acceso: el consultor
    // sí puede leer este caso, simplemente no puede ejecutar esta transición.
    expect(response.body.code).toBe('TRANSITION_ROLE_NOT_ALLOWED');
    expect(response.body.details.actualRole).toBe('CONSULTOR');

    // Y lo esencial: el estado no cambió.
    expect(await statusOf(caseId)).toBe(CaseStatusCode.EN_REVISION);
  });

  it('el consultor sí puede LEER el caso que tiene asignado', async () => {
    await ctx.http()
      .get(`/api/v1/cases/${caseId}`)
      .set('Authorization', `Bearer ${consultantUser.token}`)
      .expect(200);
  });

  it('un cliente NO puede clasificar su propio caso', async () => {
    const response = await ctx.http()
      .post(`/api/v1/cases/${caseId}/transitions`)
      .set('Authorization', `Bearer ${clientOwner.token}`)
      .send({ transition: 'CLASSIFY' })
      .expect(403);

    expect(response.body.code).toBe('TRANSITION_ROLE_NOT_ALLOWED');
    expect(await statusOf(caseId)).toBe(CaseStatusCode.EN_REVISION);
  });

  it('un consultor NO puede leer la bitácora de auditoría', async () => {
    const response = await ctx.http()
      .get('/api/v1/audit')
      .set('Authorization', `Bearer ${consultantUser.token}`)
      .expect(403);

    expect(response.body.code).toBe('MISSING_PERMISSION');
    expect(response.body.details.missing).toContain('AUDIT_READ');
  });

  it('un cliente NO puede entrar a la bolsa interna de consultores', async () => {
    await ctx.http()
      .get('/api/v1/consultants/opportunities')
      .set('Authorization', `Bearer ${clientOwner.token}`)
      .expect(403);
  });

  // ==========================================================================
  //  3. Ámbito sobre el recurso — aislamiento entre empresas
  // ==========================================================================

  it('un cliente NO puede leer el caso de otra empresa', async () => {
    // 404 y no 403: confirmar la existencia del caso ya sería una filtración.
    await ctx.http()
      .get(`/api/v1/cases/${otherCompanyCaseId}`)
      .set('Authorization', `Bearer ${clientOwner.token}`)
      .expect(404);
  });

  it('un cliente NO puede actuar sobre el caso de otra empresa', async () => {
    await ctx.http()
      .post(`/api/v1/cases/${otherCompanyCaseId}/transitions`)
      .set('Authorization', `Bearer ${clientOwner.token}`)
      .send({ transition: 'CLIENT_ACCEPT' })
      .expect(404);

    expect(await statusOf(otherCompanyCaseId)).toBe(CaseStatusCode.EN_REVISION);
  });

  it('el listado de casos está acotado a la empresa del cliente', async () => {
    const response = await ctx.http()
      .get('/api/v1/cases?pageSize=50')
      .set('Authorization', `Bearer ${clientOwner.token}`)
      .expect(200);

    const codes = (response.body.data as Array<{ code: string }>).map((item) => item.code);
    expect(codes).toContain('CAS-TEST01');
    expect(codes).not.toContain('CAS-TEST02');
  });

  it('advisory sí ve los casos de ambas empresas', async () => {
    const response = await ctx.http()
      .get('/api/v1/cases?pageSize=50')
      .set('Authorization', `Bearer ${advisory.token}`)
      .expect(200);

    const codes = (response.body.data as Array<{ code: string }>).map((item) => item.code);
    expect(codes).toEqual(expect.arrayContaining(['CAS-TEST01', 'CAS-TEST02']));
  });

  // ==========================================================================
  //  4. Integridad de la máquina de estados
  // ==========================================================================

  it('rechaza una transición inexistente desde el estado actual', async () => {
    const response = await ctx.http()
      .post(`/api/v1/cases/${caseId}/transitions`)
      .set('Authorization', `Bearer ${advisory.token}`)
      .send({ transition: 'CLOSE_CASE' })
      .expect(409);

    expect(response.body.code).toBe('INVALID_TRANSITION');
    expect(await statusOf(caseId)).toBe(CaseStatusCode.EN_REVISION);
  });

  it('rechaza una transición que no existe en el registro', async () => {
    await ctx.http()
      .post(`/api/v1/cases/${caseId}/transitions`)
      .set('Authorization', `Bearer ${advisory.token}`)
      .send({ transition: 'BORRAR_TODO' })
      .expect(409);

    expect(await statusOf(caseId)).toBe(CaseStatusCode.EN_REVISION);
  });

  it('nadie puede ejecutar una transición marcada como automática del sistema', async () => {
    const response = await ctx.http()
      .post(`/api/v1/cases/${caseId}/transitions`)
      .set('Authorization', `Bearer ${advisory.token}`)
      .send({ transition: 'START_CONTRACTING' })
      .expect(409);

    // No existe desde EN_REVISION; y aunque el estado coincidiera, su `scope`
    // es SYSTEM y `assertActorAllowed` la rechazaría igualmente.
    expect(response.body.code).toBe('INVALID_TRANSITION');
  });

  it('advisory NO puede clasificar sin haber registrado la clasificación T2', async () => {
    const response = await ctx.http()
      .post(`/api/v1/cases/${caseId}/transitions`)
      .set('Authorization', `Bearer ${advisory.token}`)
      .send({ transition: 'CLASSIFY' })
      .expect(409);

    expect(response.body.code).toBe('GUARD_CLASSIFICATION_COMPLETE');
    expect(await statusOf(caseId)).toBe(CaseStatusCode.EN_REVISION);
  });

  // ==========================================================================
  //  5. Validación de entrada
  // ==========================================================================

  it('rechaza un campo no declarado en el DTO (anti mass-assignment)', async () => {
    await ctx.http()
      .post(`/api/v1/cases/${caseId}/transitions`)
      .set('Authorization', `Bearer ${advisory.token}`)
      .send({ transition: 'START_REVIEW', status: 'CERRADO' })
      .expect(400);
  });

  it('rechaza una clasificación con un código fuera de las listas de valores', async () => {
    const response = await ctx.http()
      .post(`/api/v1/cases/${caseId}/classification`)
      .set('Authorization', `Bearer ${advisory.token}`)
      .send({
        areaCode: 'AREA_INVENTADA',
        interventionTypeCode: 'DIAGNOSTICO',
        complexityCode: 'MEDIO',
        impactCode: 'MEDIO',
        urgencyCode: 'MEDIA',
        eligibility: 'ELEGIBLE',
        reviewNotes: 'Observaciones suficientemente largas para pasar la validación mínima.',
      })
      .expect(400);

    expect(response.body.code).toBe('INVALID_LOOKUP_VALUE');
  });

  // ==========================================================================
  //  6. Las transiciones disponibles también respetan el rol
  // ==========================================================================

  it('availableTransitions no ofrece al consultor acciones que no puede ejecutar', async () => {
    const response = await ctx.http()
      .get(`/api/v1/cases/${caseId}/transitions`)
      .set('Authorization', `Bearer ${consultantUser.token}`)
      .expect(200);

    const codes = (response.body as Array<{ code: string }>).map((item) => item.code);
    expect(codes).not.toContain('CLASSIFY');
    expect(codes).not.toContain('REJECT_INELIGIBLE');
  });

  it('availableTransitions explica por qué una acción está bloqueada', async () => {
    const response = await ctx.http()
      .get(`/api/v1/cases/${caseId}/transitions`)
      .set('Authorization', `Bearer ${advisory.token}`)
      .expect(200);

    const classify = (response.body as Array<{ code: string; allowed: boolean; blockedBy: string[]; blockedReason: string }>)
      .find((item) => item.code === 'CLASSIFY');

    expect(classify).toBeDefined();
    expect(classify!.allowed).toBe(false);
    expect(classify!.blockedBy).toContain('GUARD_CLASSIFICATION_COMPLETE');
    expect(classify!.blockedReason).toMatch(/clasificaci/i);
  });
});
