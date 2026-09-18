#!/usr/bin/env node
/**
 * Smoke test del entorno.
 *
 * Comprueba, contra la API en ejecución, que lo esencial funciona: salud de las
 * dependencias, autenticación, alcance por rol, cálculo de transiciones y — lo
 * más importante — que un actor sin autorización **no** puede mover un caso.
 *
 *   node infra/scripts/smoke.mjs
 */

const API = process.env.API_URL ?? 'http://localhost:4000';
const BASE = `${API}/api/v1`;
const PASSWORD = process.env.SEED_DEFAULT_PASSWORD ?? 'Nodus2026*';

let passed = 0;
let failed = 0;

const green = (text) => `\x1b[32m${text}\x1b[0m`;
const red = (text) => `\x1b[31m${text}\x1b[0m`;
const dim = (text) => `\x1b[2m${text}\x1b[0m`;

function check(label, condition, detail = '') {
  if (condition) {
    passed += 1;
    console.log(`  ${green('✓')} ${label}${detail ? dim(` — ${detail}`) : ''}`);
  } else {
    failed += 1;
    console.log(`  ${red('✗')} ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

async function request(path, options = {}) {
  const response = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      ...options.headers,
    },
  });

  let body = null;
  const text = await response.text();
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }

  return { status: response.status, body };
}

async function login(email) {
  const result = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  if (result.status !== 200) {
    throw new Error(`No se pudo iniciar sesión como ${email}: ${JSON.stringify(result.body)}`);
  }
  return result.body;
}

async function main() {
  console.log('\nNODUS — smoke test\n');

  // ---------------------------------------------------------------- Salud
  console.log('Infraestructura');
  const health = await request('/health/ready');
  check('La API responde', health.status === 200);
  check('PostgreSQL disponible', health.body?.checks?.database === true);
  check('Redis disponible', health.body?.checks?.redis === true);
  check('Storage (MinIO/S3) disponible', health.body?.checks?.storage === true);
  check('SMTP (Mailpit) disponible', health.body?.checks?.smtp === true);

  // ------------------------------------------------------------ Autenticación
  console.log('\nAutenticación y RBAC');
  const advisory = await login('advisory@nodus.local');
  check('Login de Advisory', Boolean(advisory.accessToken), advisory.user?.role);

  const consultant = await login('ana.velez@consultor.nodus.local');
  check('Login de consultor', Boolean(consultant.accessToken), consultant.user?.role);

  const client = await login('maria.restrepo@acerosdelnorte.com');
  check('Login de cliente', Boolean(client.accessToken), client.user?.role);

  const otherClient = await login('carlos.duarte@vitalissalud.com');
  check('Login de segundo cliente', Boolean(otherClient.accessToken));

  const badLogin = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'advisory@nodus.local', password: 'contraseña-incorrecta' }),
  });
  check('Contraseña incorrecta rechazada', badLogin.status === 401);

  const noToken = await request('/cases');
  check('Endpoint protegido exige token', noToken.status === 401);

  // -------------------------------------------------------- Alcance por rol
  console.log('\nAlcance de datos por rol');
  const advisoryCases = await request('/cases?pageSize=50', { token: advisory.accessToken });
  check('Advisory ve todos los casos', advisoryCases.body?.meta?.total === 8, `${advisoryCases.body?.meta?.total} casos`);

  const clientCases = await request('/cases?pageSize=50', { token: client.accessToken });
  const clientTotal = clientCases.body?.meta?.total ?? 0;
  check(
    'El cliente sólo ve los casos de su empresa',
    clientTotal > 0 && clientTotal < 8,
    `${clientTotal} de 8`,
  );

  const consultantCases = await request('/cases?pageSize=50', { token: consultant.accessToken });
  check(
    'El consultor sólo ve sus casos',
    (consultantCases.body?.meta?.total ?? 0) < 8,
    `${consultantCases.body?.meta?.total} de 8`,
  );

  // El caso de la otra empresa debe ser invisible para este cliente.
  const foreignCase = advisoryCases.body.data.find(
    (item) => item.company.id !== client.user.companyId,
  );
  const foreignAccess = await request(`/cases/${foreignCase.id}`, { token: client.accessToken });
  check(
    'Un cliente no puede leer el caso de otra empresa',
    foreignAccess.status === 404,
    `HTTP ${foreignAccess.status}`,
  );

  // ------------------------------------------------- Workflow y autorización
  console.log('\nMotor de workflow');
  const inReview = advisoryCases.body.data.find((item) => item.status === 'EN_REVISION');
  check('Existe un caso EN_REVISION para probar', Boolean(inReview), inReview?.code);

  const transitions = await request(`/cases/${inReview.id}/transitions`, {
    token: advisory.accessToken,
  });
  check(
    'Advisory recibe transiciones disponibles',
    Array.isArray(transitions.body) && transitions.body.length > 0,
    transitions.body?.map((t) => t.code).join(', '),
  );

  const classify = transitions.body.find((t) => t.code === 'CLASSIFY');
  check(
    'CLASSIFY aparece bloqueada con su motivo',
    classify && classify.allowed === false && classify.blockedBy.length > 0,
    classify?.blockedReason?.slice(0, 60),
  );

  // *** La prueba de seguridad que exige el brief (§39) ***
  const forbidden = await request(`/cases/${inReview.id}/transitions`, {
    method: 'POST',
    token: consultant.accessToken,
    body: JSON.stringify({ transition: 'CLASSIFY' }),
  });
  check(
    'Un consultor NO puede clasificar un caso',
    forbidden.status === 403 || forbidden.status === 404,
    `HTTP ${forbidden.status} · ${forbidden.body?.code}`,
  );

  const stateUnchanged = await request(`/cases/${inReview.id}`, { token: advisory.accessToken });
  check(
    'El estado del caso no cambió tras el intento',
    stateUnchanged.body?.status === 'EN_REVISION',
    stateUnchanged.body?.status,
  );

  const invalidTransition = await request(`/cases/${inReview.id}/transitions`, {
    method: 'POST',
    token: advisory.accessToken,
    body: JSON.stringify({ transition: 'CLOSE_CASE' }),
  });
  check(
    'Una transición inexistente desde el estado actual se rechaza',
    invalidTransition.status === 409,
    invalidTransition.body?.code,
  );

  // ------------------------------------------------------------- Trazabilidad
  console.log('\nTrazabilidad y gobierno');
  const closed = advisoryCases.body.data.find((item) => item.status === 'CERRADO');
  const timeline = await request(`/cases/${closed.id}/timeline`, { token: advisory.accessToken });
  check(
    'El caso cerrado tiene línea de tiempo completa',
    Array.isArray(timeline.body) && timeline.body.length >= 10,
    `${timeline.body?.length} eventos`,
  );

  const history = await request(`/cases/${closed.id}/status-history`, {
    token: advisory.accessToken,
  });
  check(
    'El historial recorre todos los estados del ciclo',
    Array.isArray(history.body) && history.body.length >= 14,
    `${history.body?.length} transiciones`,
  );

  const audit = await request('/audit?pageSize=1', { token: advisory.accessToken });
  check('La bitácora es consultable', audit.status === 200, `${audit.body?.meta?.total} registros`);

  const auditForbidden = await request('/audit', { token: consultant.accessToken });
  check('Un consultor no puede leer la bitácora', auditForbidden.status === 403);

  const lookups = await request('/lookups', { token: advisory.accessToken });
  check(
    'Las listas de valores están cargadas',
    Array.isArray(lookups.body) && lookups.body.length >= 12,
    `${lookups.body?.length} listas`,
  );

  // ------------------------------------------------------------------- SLA
  console.log('\nSLA, notificaciones e indicadores');
  const sla = await request('/sla?pageSize=1', { token: advisory.accessToken });
  check('Hay instancias de SLA registradas', (sla.body?.meta?.total ?? 0) > 0, `${sla.body?.meta?.total}`);

  const rules = await request('/sla/rules', { token: advisory.accessToken });
  check('Las reglas de SLA están parametrizadas en base de datos', (rules.body?.length ?? 0) >= 15, `${rules.body?.length} reglas`);

  const notifications = await request('/notifications?pageSize=1', { token: advisory.accessToken });
  check(
    'Se generaron notificaciones desde eventos',
    (notifications.body?.meta?.total ?? 0) > 0,
    `${notifications.body?.meta?.total}`,
  );

  const kpis = await request('/dashboard/kpis', { token: advisory.accessToken });
  check('El dashboard calcula KPIs', kpis.status === 200, `${kpis.body?.activeCases} casos activos`);
  check(
    'Los KPIs incluyen el desglose por estado',
    Array.isArray(kpis.body?.casesByStatus) && kpis.body.casesByStatus.length === 17,
  );

  // --------------------------------------------------------------- Bolsa
  console.log('\nBolsa interna');
  const opportunities = await request('/consultants/opportunities', {
    token: consultant.accessToken,
  });
  check(
    'El consultor ve oportunidades elegibles',
    opportunities.status === 200,
    `${opportunities.body?.meta?.total} oportunidad(es)`,
  );

  const clientOpportunities = await request('/consultants/opportunities', {
    token: client.accessToken,
  });
  check('Un cliente no accede a la bolsa interna', clientOpportunities.status === 403);

  // ------------------------------------------------------------- Empresa única
  console.log('\nPrincipio de empresa única');
  const duplicate = await request('/companies/match', {
    method: 'POST',
    token: advisory.accessToken,
    body: JSON.stringify({ name: 'ACEROS DEL NORTE', taxId: '900456789-1' }),
  });
  check(
    'Detecta la empresa existente por NIT',
    duplicate.body?.canCreate === false && duplicate.body?.blocking?.length > 0,
    duplicate.body?.blocking?.[0]?.reason?.slice(0, 60),
  );

  const similar = await request('/companies/match', {
    method: 'POST',
    token: advisory.accessToken,
    body: JSON.stringify({ name: 'Aceros del Norte SAS' }),
  });
  check(
    'Detecta similitud por nombre normalizado',
    (similar.body?.matches?.length ?? 0) > 0,
    `${similar.body?.matches?.length} coincidencia(s)`,
  );

  // ------------------------------------------------------------------ Resumen
  console.log(`\n${passed} comprobaciones superadas, ${failed} fallidas\n`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(red(`\nEl smoke test falló: ${error.message}\n`));
  process.exit(1);
});
