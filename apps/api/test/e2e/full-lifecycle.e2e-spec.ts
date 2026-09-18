import {
  CaseStatusCode,
  ChecklistItemStatus,
  ConsultantStatus,
  DeliverableStatus,
  EngagementMode,
  MilestoneStatus,
  RoleCode,
} from '@prisma/client';
import {
  createTestApp,
  createUser,
  resetBusinessData,
  type SeededUser,
  type TestContext,
} from '../setup/test-app';

/**
 * Recorrido completo del ciclo de vida, de CREADO a CERRADO, **a través de la
 * API HTTP real** y con el usuario correcto en cada paso.
 *
 * Cubre la prioridad de E2E que fija el brief (§39): login, empresa, caso,
 * clasificación, publicación, postulación, asignación, propuesta, QA, decisión
 * del cliente, contratación, ejecución, entregable y cierre.
 *
 * El valor de esta prueba no es tocar muchos endpoints: es que **no se puede
 * saltar ningún paso**. Cada intento de atajo que hace la prueba recibe un 409
 * del guard correspondiente.
 */
describe('Ciclo de vida completo del caso (E2E)', () => {
  let ctx: TestContext;

  let advisory: SeededUser;
  let consultantUser: SeededUser;
  let client: SeededUser;
  let consultantId: string;
  let companyId: string;
  let caseId: string;
  let applicationId: string;

  const auth = (user: SeededUser) => ({ Authorization: `Bearer ${user.token}` });

  const transition = (user: SeededUser, body: Record<string, unknown>) =>
    ctx.http().post(`/api/v1/cases/${caseId}/transitions`).set(auth(user)).send(body);

  const statusOf = async (): Promise<CaseStatusCode> =>
    (await ctx.prisma.case.findUniqueOrThrow({ where: { id: caseId }, select: { status: true } }))
      .status;

  beforeAll(async () => {
    ctx = await createTestApp();
    await resetBusinessData(ctx.prisma);

    advisory = await createUser(ctx, {
      email: 'advisory-ciclo@test.local',
      fullName: 'Advisory Ciclo',
      role: RoleCode.ADVISORY,
    });

    const consultantAccount = await createUser(ctx, {
      email: 'consultor-ciclo@test.local',
      fullName: 'Consultor Ciclo',
      role: RoleCode.CONSULTOR,
    });
    consultantUser = consultantAccount;

    const consultant = await ctx.prisma.consultant.create({
      data: {
        code: 'CON-CICLO01',
        userId: consultantAccount.id,
        identityDocument: 'CC-CICLO-001',
        phone: '+57 300 111 2222',
        country: 'Colombia',
        city: 'Bogotá',
        professionalProfile:
          'Consultor de pruebas con experiencia en operaciones y control de inventarios.',
        yearsOfExperience: 12,
        availability: 'Disponible 20 horas semanales',
        engagementMode: EngagementMode.INDEPENDIENTE,
        status: ConsultantStatus.HABILITADO,
        maxComplexityCode: 'ALTO',
        experienceLevelCode: 'SENIOR',
        scope: {
          create: {
            interventionTypeCodes: ['DIAGNOSTICO', 'DISENO_SOLUCION'],
            sectorCodes: ['INDUSTRIA'],
            canBeLeadConsultant: true,
          },
        },
        specialties: {
          create: { specialtyCode: 'OPERACIONES', yearsOfExperience: 12, isPrimary: true },
        },
      },
      select: { id: true },
    });
    consultantId = consultant.id;
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  // ==========================================================================
  //  Punto 1 — Onboarding T1
  // ==========================================================================

  it('1. la Mipyme registra su necesidad por el intake público (T1)', async () => {
    const response = await ctx.http()
      .post('/api/v1/intake')
      .send({
        companyName: 'Manufacturas del Valle S.A.S.',
        taxId: '901555777-3',
        contactFullName: 'Elena Prada',
        contactJobTitle: 'Gerente de Planta',
        contactEmail: 'elena.prada@manufacturasdelvalle.com',
        contactPhone: '+57 315 888 9999',
        country: 'Colombia',
        city: 'Cali',
        acceptedTerms: true,
        title: 'Descuadres recurrentes de inventario entre planta y bodega',
        description:
          'Los conteos físicos difieren del sistema en más de un 15 % y se han producido ' +
          'paradas de línea por faltantes no detectados. Necesitamos entender la causa raíz.',
        areaCode: 'OPERACIONES',
        urgencyCode: 'ALTA',
        impactCode: 'ALTO',
      })
      .expect(201);

    caseId = response.body.case.id;
    companyId = response.body.company.id;

    expect(response.body.case.code).toMatch(/^CAS-\d{6}$/);
    expect(response.body.case.status).toBe(CaseStatusCode.CREADO);
    expect(response.body.company.wasCreated).toBe(true);
    expect(response.body.user.wasCreated).toBe(true);
    // La contraseña temporal se devuelve una sola vez, en la respuesta del alta.
    expect(response.body.user.temporaryPassword).toBeTruthy();

    // El intake dejó rastro completo: empresa, contacto, usuario, caso y bitácora.
    const audit = await ctx.prisma.auditLog.findMany({ where: { caseId } });
    expect(audit.map((entry) => entry.action)).toContain('CASE_CREATED');

    // Y abrió el reloj de SLA de la etapa CREADO.
    const sla = await ctx.prisma.slaInstance.findFirst({ where: { caseId } });
    expect(sla?.stage).toBe(CaseStatusCode.CREADO);
  });

  it('1b. el principio de Empresa Única evita duplicar la empresa en un segundo caso', async () => {
    const response = await ctx.http()
      .post('/api/v1/intake')
      .send({
        companyName: 'MANUFACTURAS DEL VALLE SAS',
        taxId: '901.555.777-3',
        contactFullName: 'Elena Prada',
        contactJobTitle: 'Gerente de Planta',
        contactEmail: 'elena.prada@manufacturasdelvalle.com',
        contactPhone: '+57 315 888 9999',
        country: 'Colombia',
        city: 'Cali',
        acceptedTerms: true,
        title: 'Segundo caso para la misma empresa registrada',
        description:
          'Necesitamos además revisar el proceso de compras, que creemos relacionado con los ' +
          'descuadres de inventario detectados en el caso anterior.',
        areaCode: 'OPERACIONES',
        urgencyCode: 'MEDIA',
        impactCode: 'MEDIO',
      })
      .expect(201);

    // Mismo NIT escrito distinto: se vincula, no se duplica.
    expect(response.body.company.id).toBe(companyId);
    expect(response.body.company.wasCreated).toBe(false);

    const companies = await ctx.prisma.company.count();
    expect(companies).toBe(1);
  });

  it('1c. el cliente de la empresa inicia sesión y ve sus casos', async () => {
    const contact = await ctx.prisma.user.findUniqueOrThrow({
      where: { email: 'elena.prada@manufacturasdelvalle.com' },
      select: { id: true },
    });

    // Se le fija una contraseña conocida para poder autenticar en la prueba.
    const { AuthService } = await import('../../src/modules/auth/auth.service');
    await ctx.prisma.user.update({
      where: { id: contact.id },
      data: {
        passwordHash: await AuthService.hashPassword('PruebasNodus2026*'),
        mustChangePassword: false,
      },
    });

    const login = await ctx.http()
      .post('/api/v1/auth/login')
      .send({ email: 'elena.prada@manufacturasdelvalle.com', password: 'PruebasNodus2026*' })
      .expect(200);

    client = {
      id: contact.id,
      email: 'elena.prada@manufacturasdelvalle.com',
      token: login.body.accessToken,
    };

    const cases = await ctx.http()
      .get('/api/v1/cases?pageSize=20')
      .set(auth(client))
      .expect(200);

    expect(cases.body.meta.total).toBe(2);
  });

  // ==========================================================================
  //  Punto 2 — Debida diligencia y clasificación
  // ==========================================================================

  it('2. no se puede publicar un caso sin clasificar (el atajo se rechaza)', async () => {
    const response = await transition(advisory, { transition: 'PUBLISH' }).expect(409);
    expect(response.body.code).toBe('INVALID_TRANSITION');
    expect(await statusOf()).toBe(CaseStatusCode.CREADO);
  });

  it('2a. advisory inicia la revisión', async () => {
    await transition(advisory, { transition: 'START_REVIEW' }).expect(201);
    expect(await statusOf()).toBe(CaseStatusCode.EN_REVISION);
  });

  it('2b. advisory registra la clasificación T2 y habilita el caso', async () => {
    await ctx.http()
      .post(`/api/v1/cases/${caseId}/classification`)
      .set(auth(advisory))
      .send({
        areaCode: 'OPERACIONES',
        subAreaCode: 'INVENTARIOS',
        interventionTypeCode: 'DIAGNOSTICO',
        complexityCode: 'MEDIO',
        impactCode: 'ALTO',
        urgencyCode: 'ALTA',
        eligibility: 'ELEGIBLE',
        reviewNotes:
          'Información suficiente y coherente. El caso encaja en el modelo de atención y hay ' +
          'consultores habilitados con el perfil requerido.',
        clarityScore: 4,
        completenessScore: 4,
      })
      .expect(201);

    await transition(advisory, { transition: 'CLASSIFY' }).expect(201);
    expect(await statusOf()).toBe(CaseStatusCode.CLASIFICADO);

    // La clasificación quedó denormalizada en el caso para poder filtrar por ella.
    const kase = await ctx.prisma.case.findUniqueOrThrow({
      where: { id: caseId },
      select: { complexityCode: true, interventionTypeCode: true },
    });
    expect(kase.complexityCode).toBe('MEDIO');
    expect(kase.interventionTypeCode).toBe('DIAGNOSTICO');
  });

  // ==========================================================================
  //  Punto 3 — Bolsa interna, postulación y asignación
  // ==========================================================================

  it('3a. advisory publica el caso en la bolsa interna', async () => {
    await transition(advisory, {
      transition: 'PUBLISH',
      payload: { applicationWindowDays: 7 },
    }).expect(201);

    expect(await statusOf()).toBe(CaseStatusCode.EN_POSTULACION);
  });

  it('3b. el consultor elegible ve el caso en la bolsa, con datos controlados', async () => {
    const response = await ctx.http()
      .get('/api/v1/consultants/opportunities')
      .set(auth(consultantUser))
      .expect(200);

    const opportunity = (response.body.data as Array<{ caseId: string; summary: string }>).find(
      (item) => item.caseId === caseId,
    );

    expect(opportunity).toBeDefined();
    // La bolsa no expone la descripción íntegra del cliente.
    expect(opportunity!.summary.length).toBeLessThan(500);
  });

  it('3c. el consultor se postula con la plantilla T3C', async () => {
    const response = await ctx.http()
      .post(`/api/v1/cases/${caseId}/applications`)
      .set(auth(consultantUser))
      .send({
        interestStatement:
          'Manifiesto interés en atender este caso porque corresponde directamente a mi ' +
          'especialidad principal en control de inventarios.',
        availability: 'Disponible desde la próxima semana, 20 horas semanales',
        relevantExperience:
          'He liderado diagnósticos de inventario en plantas de tamaño comparable, con ' +
          'resultados medibles en exactitud de conteo y reducción de faltantes.',
        fitJustification:
          'Mi especialidad, el tipo de intervención y la complejidad del caso coinciden con mi ' +
          'alcance habilitado, y conozco el sector industrial de la empresa.',
        preliminaryApproach:
          'Diagnóstico en tres fases: levantamiento con datos reales, análisis de causa raíz ' +
          'con los responsables de proceso y plan de acción priorizado.',
        acceptsConditions: true,
      })
      .expect(201);

    applicationId = response.body.id;
    expect(response.body.status).toBe('PRESENTADA');
  });

  it('3d. advisory asigna al consultor responsable y registra la evaluación T3D', async () => {
    await transition(advisory, {
      transition: 'ASSIGN_CONSULTANT',
      payload: {
        applicationId,
        decisionRationale:
          'Se asigna por afinidad plena de especialidad, experiencia comprobada en el sector y ' +
          'disponibilidad compatible con el cronograma.',
        evaluations: [
          {
            applicationId,
            specialtyFit: 5,
            experienceFit: 5,
            levelFit: 4,
            availabilityFit: 4,
            trackRecordFit: 4,
            notes: 'Afinidad plena con el área y el tipo de intervención.',
          },
        ],
      },
    }).expect(201);

    expect(await statusOf()).toBe(CaseStatusCode.ASIGNADO);

    const assignment = await ctx.prisma.caseAssignment.findFirstOrThrow({
      where: { caseId, isPrimary: true, isActive: true },
      select: { consultantId: true },
    });
    expect(assignment.consultantId).toBe(consultantId);
  });

  it('3e. la base de datos impide un segundo responsable principal activo', async () => {
    // El índice único parcial de la migración 002 es la garantía dura, por
    // encima del guard de aplicación.
    await expect(
      ctx.prisma.caseAssignment.create({
        data: {
          caseId,
          consultantId,
          isPrimary: true,
          isActive: true,
          decisionRationale: 'Intento de segunda asignación principal',
        },
      }),
    ).rejects.toThrow();
  });

  // ==========================================================================
  //  Puntos 4 y 5 — Propuesta y QA
  // ==========================================================================

  it('4a. el consultor abre el expediente de propuesta', async () => {
    await transition(consultantUser, { transition: 'OPEN_PROPOSAL' }).expect(201);
    expect(await statusOf()).toBe(CaseStatusCode.PROPUESTA_EN_DISENO);

    const version = await ctx.prisma.proposalVersion.findFirstOrThrow({
      where: { proposal: { caseId } },
      select: { versionNumber: true, status: true },
    });
    expect(version.versionNumber).toBe(1);
    expect(version.status).toBe('BORRADOR');
  });

  it('4b. no se puede enviar a QA una propuesta vacía', async () => {
    const response = await transition(consultantUser, { transition: 'SUBMIT_FOR_QA' }).expect(409);
    expect(response.body.code).toBe('GUARD_PROPOSAL_CONTENT_COMPLETE');
    expect(await statusOf()).toBe(CaseStatusCode.PROPUESTA_EN_DISENO);
  });

  it('4c. el consultor redacta la propuesta (TP4B + TP4C) y la envía a QA', async () => {
    const draft = await ctx.prisma.proposalVersion.findFirstOrThrow({
      where: { proposal: { caseId }, status: 'BORRADOR' },
      select: { id: true },
    });

    await ctx.http()
      .patch(`/api/v1/proposals/versions/${draft.id}`)
      .set(auth(consultantUser))
      .send(proposalPayload())
      .expect(200);

    await transition(consultantUser, { transition: 'SUBMIT_FOR_QA' }).expect(201);
    expect(await statusOf()).toBe(CaseStatusCode.PROPUESTA_LISTA_PARA_QA);

    // La versión quedó congelada: no admite más edición.
    const frozen = await ctx.prisma.proposalVersion.findUniqueOrThrow({
      where: { id: draft.id },
      select: { status: true, frozenAt: true },
    });
    expect(frozen.status).toBe('EN_QA');
    expect(frozen.frozenAt).not.toBeNull();
  });

  it('4d. una versión congelada no se puede editar', async () => {
    const frozen = await ctx.prisma.proposalVersion.findFirstOrThrow({
      where: { proposal: { caseId }, status: 'EN_QA' },
      select: { id: true },
    });

    const response = await ctx.http()
      .patch(`/api/v1/proposals/versions/${frozen.id}`)
      .set(auth(consultantUser))
      .send({ content: { scope: 'Intento de modificar una versión ya congelada' } })
      .expect(409);

    expect(response.body.code).toBe('PROPOSAL_VERSION_FROZEN');
  });

  it('5a. no se puede enviar al cliente sin QA aprobada', async () => {
    const response = await transition(advisory, { transition: 'APPROVE_AND_SEND' }).expect(409);
    expect(response.body.code).toBe('GUARD_REVIEW_APPROVED');
  });

  it('5b. advisory aprueba la revisión metodológica y autoriza el envío', async () => {
    await ctx.http()
      .post(`/api/v1/cases/${caseId}/proposal/reviews`)
      .set(auth(advisory))
      .send({
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
        observations: 'Propuesta completa y coherente. Se autoriza el envío al cliente.',
      })
      .expect(201);

    await transition(advisory, { transition: 'APPROVE_AND_SEND' }).expect(201);

    // Encadenó automáticamente a la ventana de decisión, atravesando
    // PROPUESTA_ENVIADA (que queda en el historial, no se salta).
    expect(await statusOf()).toBe(CaseStatusCode.EN_DECISION_CLIENTE);

    const history = await ctx.prisma.caseStatusHistory.findMany({
      where: { caseId },
      select: { newStatus: true, origin: true },
      orderBy: { createdAt: 'asc' },
    });
    const statuses = history.map((entry) => entry.newStatus);
    expect(statuses).toContain(CaseStatusCode.PROPUESTA_ENVIADA);
    expect(statuses).toContain(CaseStatusCode.EN_DECISION_CLIENTE);

    const chained = history.find(
      (entry) => entry.newStatus === CaseStatusCode.EN_DECISION_CLIENTE,
    );
    expect(chained?.origin).toBe('SYSTEM');
  });

  // ==========================================================================
  //  Punto 6 — Decisión del cliente
  // ==========================================================================

  it('6. el cliente acepta la propuesta y el caso pasa a contratación', async () => {
    await transition(client, {
      transition: 'CLIENT_ACCEPT',
      payload: { comments: 'Aceptamos la propuesta en los términos presentados.' },
    }).expect(201);

    // CLIENT_ACCEPT encadena automáticamente START_CONTRACTING.
    expect(await statusOf()).toBe(CaseStatusCode.PENDIENTE_CONTRATACION);

    // Y el checklist T7A se instanció desde la plantilla vigente.
    const checklist = await ctx.prisma.contractChecklist.findUniqueOrThrow({
      where: { caseId },
      select: { items: { select: { id: true } } },
    });
    expect(checklist.items.length).toBeGreaterThan(0);
  });

  // ==========================================================================
  //  Punto 7 — Contratación (veeduría)
  // ==========================================================================

  it('7a. no se autoriza la ejecución con el checklist incompleto', async () => {
    const response = await transition(advisory, { transition: 'AUTHORIZE_EXECUTION' }).expect(409);
    expect(response.body.code).toBe('GUARD_CONTRACT_CHECKLIST_COMPLETE');
    expect(await statusOf()).toBe(CaseStatusCode.PENDIENTE_CONTRATACION);
  });

  it('7b. advisory completa el checklist y el consultor carga el marco operativo', async () => {
    const checklist = await ctx.prisma.contractChecklist.findUniqueOrThrow({
      where: { caseId },
      select: { items: { select: { id: true, requiresEvidence: true } } },
    });

    for (const item of checklist.items) {
      if (item.requiresEvidence) {
        await ctx.http()
          .post(`/api/v1/cases/${caseId}/contract/evidences`)
          .set(auth(advisory))
          .send({
            title: 'Acuerdo de prestación firmado',
            description: 'Soporte aportado por las partes.',
            itemId: item.id,
          })
          .expect(201);
      }

      await ctx.http()
        .patch(`/api/v1/cases/${caseId}/contract/checklist/items/${item.id}`)
        .set(auth(advisory))
        .send({ status: ChecklistItemStatus.CUMPLIDO, notes: 'Verificado por veeduría.' })
        .expect(200);
    }

    await ctx.http()
      .put(`/api/v1/cases/${caseId}/contract/operational-framework`)
      .set(auth(consultantUser))
      .send({
        operatingConditions:
          'Servicio mixto: dos sesiones presenciales de levantamiento y el resto remoto, con una ' +
          'contraparte designada por la empresa.',
        estimatedDurationDays: 45,
        baselineSchedule:
          'Semanas 1-2 levantamiento, 3-4 análisis, 5-6 diseño del plan, 7 entrega formal.',
        committedDeliverables:
          'Informe de diagnóstico, plan de acción priorizado y tablero de indicadores.',
        clientDependencies:
          'Acceso a datos de los últimos 12 meses y disponibilidad de los responsables.',
        assumptions: 'Los datos históricos están disponibles en formato exportable.',
        primaryContact: 'Responsable de proceso designado',
      })
      .expect(200);

    await transition(advisory, { transition: 'AUTHORIZE_EXECUTION' }).expect(201);
    expect(await statusOf()).toBe(CaseStatusCode.AUTORIZADO_PARA_EJECUCION);
  });

  // ==========================================================================
  //  Punto 8 — Ejecución
  // ==========================================================================

  it('8a. no se inicia la ejecución sin agenda operativa', async () => {
    const response = await transition(consultantUser, { transition: 'START_EXECUTION' }).expect(409);
    expect(response.body.code).toBe('GUARD_AGENDA_ACTIVATED');
  });

  it('8b. el consultor carga la agenda (T8A) e inicia la ejecución', async () => {
    await ctx.http()
      .post(`/api/v1/cases/${caseId}/milestones`)
      .set(auth(consultantUser))
      .send({
        name: 'Levantamiento validado con la empresa',
        responsible: 'Consultor responsable',
        targetDate: new Date(Date.now() + 7 * 86_400_000).toISOString(),
        criticality: 'ALTO',
        expectedResult: 'Datos históricos validados con el responsable de proceso.',
      })
      .expect(201);

    await ctx.http()
      .post(`/api/v1/cases/${caseId}/activities`)
      .set(auth(consultantUser))
      .send({
        name: 'Levantamiento de datos históricos',
        responsible: 'Consultor responsable',
        targetDate: new Date(Date.now() + 5 * 86_400_000).toISOString(),
      })
      .expect(201);

    await transition(consultantUser, { transition: 'START_EXECUTION' }).expect(201);
    expect(await statusOf()).toBe(CaseStatusCode.EN_EJECUCION);
  });

  it('8c. un entregable no puede marcarse cargado sin versión (versionado obligatorio)', async () => {
    const created = await ctx.http()
      .post(`/api/v1/cases/${caseId}/deliverables`)
      .set(auth(consultantUser))
      .send({
        name: 'Informe de diagnóstico con causas raíz',
        typeCode: 'DIAGNOSTICO',
        responsible: 'Consultor responsable',
        targetDate: new Date(Date.now() + 20 * 86_400_000).toISOString(),
      })
      .expect(201);

    const response = await ctx.http()
      .patch(`/api/v1/cases/${caseId}/deliverables/${created.body.id}`)
      .set(auth(consultantUser))
      .send({ status: DeliverableStatus.CARGADO })
      .expect(409);

    expect(response.body.code).toBe('DELIVERABLE_VERSION_REQUIRED');
  });

  it('8d. el consultor carga dos versiones del entregable: la primera se conserva', async () => {
    const deliverable = await ctx.prisma.deliverable.findFirstOrThrow({
      where: { caseId },
      select: { id: true },
    });

    for (const note of ['Primera versión para revisión', 'Versión final tras observaciones']) {
      await ctx.http()
        .post(`/api/v1/cases/${caseId}/deliverables/${deliverable.id}/versions`)
        .set(auth(consultantUser))
        .send({ notes: note })
        .expect(201);
    }

    const versions = await ctx.prisma.deliverableVersion.findMany({
      where: { deliverableId: deliverable.id },
      orderBy: { versionNumber: 'asc' },
      select: { versionNumber: true, notes: true },
    });

    expect(versions).toHaveLength(2);
    expect(versions[0]!.notes).toBe('Primera versión para revisión');
  });

  // ==========================================================================
  //  Punto 9 — Cierre
  // ==========================================================================

  it('9a. no se declara el cierre técnico con entregables o hitos pendientes', async () => {
    const response = await transition(consultantUser, {
      transition: 'TECHNICAL_CLOSURE',
      payload: {
        statement:
          'Declaro concluidas las actividades comprometidas en el marco operativo del servicio.',
      },
    }).expect(409);

    expect(['GUARD_DELIVERABLES_READY', 'GUARD_MILESTONES_SETTLED']).toContain(response.body.code);
    expect(await statusOf()).toBe(CaseStatusCode.EN_EJECUCION);
  });

  it('9b. con todo cerrado, el consultor declara el cierre técnico (T9A)', async () => {
    const deliverable = await ctx.prisma.deliverable.findFirstOrThrow({
      where: { caseId },
      select: { id: true },
    });
    await ctx.http()
      .patch(`/api/v1/cases/${caseId}/deliverables/${deliverable.id}`)
      .set(auth(consultantUser))
      .send({ status: DeliverableStatus.LISTO_PARA_CIERRE })
      .expect(200);

    const milestone = await ctx.prisma.milestone.findFirstOrThrow({
      where: { caseId },
      select: { id: true },
    });
    await ctx.http()
      .patch(`/api/v1/cases/${caseId}/milestones/${milestone.id}`)
      .set(auth(consultantUser))
      .send({ status: MilestoneStatus.CUMPLIDO })
      .expect(200);

    await transition(consultantUser, {
      transition: 'TECHNICAL_CLOSURE',
      payload: {
        statement:
          'Declaro concluidas las actividades comprometidas en el marco operativo del servicio. ' +
          'Los entregables finales están cargados y versionados.',
        finalNotes: 'Se recomienda revisar los indicadores a los tres meses.',
      },
    }).expect(201);

    expect(await statusOf()).toBe(CaseStatusCode.LISTO_PARA_CIERRE);

    // El checklist T9C se instanció al declarar el cierre técnico.
    const checklist = await ctx.prisma.closureChecklist.findUnique({ where: { caseId } });
    expect(checklist).not.toBeNull();
  });

  it('9c. no se cierra el caso sin revisión final ni evaluaciones', async () => {
    const response = await transition(advisory, { transition: 'CLOSE_CASE' }).expect(409);
    expect([
      'GUARD_CLOSURE_CHECKLIST_COMPLETE',
      'GUARD_CLIENT_CLOSURE_RESPONSE',
      'GUARD_CUSTOMER_EVALUATION',
      'GUARD_CONSULTANT_EVALUATION',
    ]).toContain(response.body.code);
    expect(await statusOf()).toBe(CaseStatusCode.LISTO_PARA_CIERRE);
  });

  it('9d. se completa la revisión final, la aceptación y las evaluaciones', async () => {
    const checklist = await ctx.prisma.closureChecklist.findUniqueOrThrow({
      where: { caseId },
      select: { items: { select: { id: true } } },
    });

    for (const item of checklist.items) {
      await ctx.http()
        .patch(`/api/v1/cases/${caseId}/closure/checklist/items/${item.id}`)
        .set(auth(advisory))
        .send({ status: 'CUMPLIDO', notes: 'Verificado en la revisión final.' })
        .expect(200);
    }

    await ctx.http()
      .put(`/api/v1/cases/${caseId}/closure/client-response`)
      .set(auth(client))
      .send({
        response: 'ACEPTACION',
        observations: 'Recibimos los entregables y damos por concluido el servicio.',
      })
      .expect(200);

    await ctx.http()
      .put(`/api/v1/cases/${caseId}/closure/customer-evaluation`)
      .set(auth(client))
      .send({
        overallSatisfaction: 5,
        serviceClarity: 5,
        expectationFulfilment: 4,
        perceivedValue: 5,
        wouldReuse: true,
        comments: 'Buen acompañamiento y comunicación ordenada.',
      })
      .expect(200);

    await ctx.http()
      .put(`/api/v1/cases/${caseId}/closure/consultant-evaluation`)
      .set(auth(advisory))
      .send({
        scopeCompliance: 5,
        timeCompliance: 4,
        documentationOrder: 5,
        processConsistency: 5,
        qaOutcome: 5,
        comments: 'Cumplió el alcance con orden documental ejemplar.',
      })
      .expect(200);
  });

  it('9e. advisory cierra formalmente el caso', async () => {
    await transition(advisory, { transition: 'CLOSE_CASE' }).expect(201);
    expect(await statusOf()).toBe(CaseStatusCode.CERRADO);

    const kase = await ctx.prisma.case.findUniqueOrThrow({
      where: { id: caseId },
      select: { closedAt: true, closedById: true },
    });
    expect(kase.closedAt).not.toBeNull();
    expect(kase.closedById).toBe(advisory.id);
  });

  // ==========================================================================
  //  Verificación transversal del expediente
  // ==========================================================================

  it('el expediente quedó completo y trazable de principio a fin', async () => {
    const history = await ctx.prisma.caseStatusHistory.findMany({
      where: { caseId },
      orderBy: { createdAt: 'asc' },
      select: { newStatus: true },
    });

    const path = history.map((entry) => entry.newStatus);
    expect(path).toEqual([
      CaseStatusCode.CREADO,
      CaseStatusCode.EN_REVISION,
      CaseStatusCode.CLASIFICADO,
      CaseStatusCode.EN_POSTULACION,
      CaseStatusCode.ASIGNADO,
      CaseStatusCode.PROPUESTA_EN_DISENO,
      CaseStatusCode.PROPUESTA_LISTA_PARA_QA,
      CaseStatusCode.PROPUESTA_ENVIADA,
      CaseStatusCode.EN_DECISION_CLIENTE,
      CaseStatusCode.PROPUESTA_ACEPTADA,
      CaseStatusCode.PENDIENTE_CONTRATACION,
      CaseStatusCode.AUTORIZADO_PARA_EJECUCION,
      CaseStatusCode.EN_EJECUCION,
      CaseStatusCode.LISTO_PARA_CIERRE,
      CaseStatusCode.CERRADO,
    ]);
  });

  it('cada transición dejó su registro en la bitácora de auditoría', async () => {
    const transitions = await ctx.prisma.auditLog.findMany({
      where: { caseId, action: { startsWith: 'CASE_TRANSITION_' } },
      select: { action: true },
    });

    // 14 transiciones desde CREADO, incluidas las dos automáticas del sistema.
    expect(transitions.length).toBe(14);
  });

  it('la bitácora es inmutable: no admite modificación ni borrado', async () => {
    const entry = await ctx.prisma.auditLog.findFirstOrThrow({
      where: { caseId },
      select: { id: true },
    });

    await expect(
      ctx.prisma.auditLog.update({
        where: { id: entry.id },
        data: { action: 'ACCION_MANIPULADA' },
      }),
    ).rejects.toThrow();

    await expect(ctx.prisma.auditLog.delete({ where: { id: entry.id } })).rejects.toThrow();
  });

  it('el reloj de SLA se cerró al llegar a un estado terminal', async () => {
    const open = await ctx.prisma.slaInstance.count({
      where: { caseId, status: { in: ['ON_TRACK', 'AT_RISK', 'OVERDUE'] } },
    });
    expect(open).toBe(0);
  });

  it('el caso cerrado ya no admite más transiciones', async () => {
    const response = await ctx.http()
      .get(`/api/v1/cases/${caseId}/transitions`)
      .set(auth(advisory))
      .expect(200);

    expect(response.body).toHaveLength(0);
  });

  it('el caso cerrado aparece en los indicadores del dashboard', async () => {
    const response = await ctx.http()
      .get('/api/v1/dashboard/kpis')
      .set(auth(advisory))
      .expect(200);

    expect(response.body.closedCases).toBe(1);
    expect(response.body.proposalConversionPercent).toBe(100);
  });
});

function proposalPayload() {
  return {
    analysis: {
      problemSynthesis:
        'El descuadre de inventario se origina en la captura manual de movimientos y en la ' +
        'ausencia de conciliación entre planta y bodega.',
      workingHypothesis:
        'Más del 70 % de la desviación se concentra en tres puntos concretos del proceso.',
      criticalFactors: 'Calidad de los datos históricos y participación de los responsables.',
      risks: 'Datos incompletos; resistencia al cambio en los equipos operativos.',
      assumptions: 'La empresa dispone de los datos de los últimos 12 meses.',
      constraints: 'No incluye la adquisición ni implantación de herramientas.',
    },
    content: {
      executiveSummary:
        'Proponemos un diagnóstico estructurado que identifique las causas raíz del descuadre ' +
        'de inventario y entregue un plan de acción priorizado y ejecutable.',
      objective:
        'Entregar a la dirección un diagnóstico verificable y un plan de acción ejecutable con ' +
        'los recursos actuales de la empresa.',
      scope:
        'Levantamiento y validación de datos de 12 meses, entrevistas con responsables, ' +
        'análisis de causa raíz, plan de acción y tablero de indicadores.',
      exclusions:
        'No incluye la ejecución del plan, la adquisición de software ni la capacitación masiva.',
      activities:
        'Levantamiento, entrevistas estructuradas, análisis de causa raíz, taller de contraste, ' +
        'diseño del plan y sesión de transferencia.',
      deliverables:
        'Informe de diagnóstico, plan de acción con responsables y fechas, y tablero de control.',
      schedule: 'Siete semanas distribuidas en cuatro fases con validación intermedia.',
      valuation: 'Ciento veinte horas de dedicación profesional distribuidas en siete semanas.',
      conditions:
        'La empresa designa una contraparte con cuatro horas semanales y facilita el acceso a ' +
        'los datos históricos en la primera semana.',
    },
    changeNote: 'Versión inicial consolidada para revisión metodológica',
  };
}
