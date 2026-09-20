#!/usr/bin/env node
/**
 * Capturas de pantalla autenticadas para la revisión visual de NODUS
 * (skill `nodus-ui-review`).
 *
 * Usa Chrome/Edge en modo headless a través del protocolo DevTools, con el
 * WebSocket nativo de Node ≥ 22: no añade dependencias al proyecto.
 *
 *   node infra/scripts/ui-shots.mjs                 # todas las pantallas
 *   node infra/scripts/ui-shots.mjs cases detail    # sólo algunas
 *
 * Variables: WEB_URL (http://localhost:3000), UI_USER (advisory@nodus.local),
 * UI_PASSWORD (Nodus2026*), WAIT (ms de espera por página), CHROME (ruta).
 * Salida: .ui-shots/<nombre>.png (ignorado por git).
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const WEB = process.env.WEB_URL ?? 'http://localhost:3000';
const USER = process.env.UI_USER ?? 'advisory@nodus.local';
const PASSWORD = process.env.UI_PASSWORD ?? 'Nodus2026*';
const WAIT = Number(process.env.WAIT ?? 5000);
const OUT = resolve('.ui-shots');
const PORT = 9333;

const CHROME_CANDIDATES = [
  process.env.CHROME,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].filter(Boolean);

const chromePath = CHROME_CANDIDATES.find((path) => existsSync(path));
if (!chromePath) {
  console.error('No se encontró Chrome/Edge. Defina CHROME con la ruta del ejecutable.');
  process.exit(1);
}

mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

const chrome = spawn(chromePath, [
  '--headless=new',
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${join(OUT, '.profile')}`,
  '--hide-scrollbars',
  '--no-first-run',
  'about:blank',
]);

let target;
for (let attempt = 0; attempt < 40 && !target; attempt++) {
  await sleep(250);
  try {
    const targets = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
    target = targets.find((item) => item.type === 'page');
  } catch {
    // Chrome aún no escucha.
  }
}

const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((ready) => ws.addEventListener('open', ready));

let seq = 0;
const pending = new Map();
ws.addEventListener('message', (event) => {
  const msg = JSON.parse(event.data);
  if (msg.method === 'Runtime.exceptionThrown') {
    console.log('  excepción:', msg.params.exceptionDetails.text);
  }
  if (msg.method === 'Network.responseReceived' && msg.params.response.status >= 400) {
    const { status, url } = msg.params.response;
    if (!url.endsWith('favicon.ico')) console.log(`  HTTP ${status} ${url}`);
  }
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg);
    pending.delete(msg.id);
  }
});
const send = (method, params = {}) =>
  new Promise((done) => {
    const id = ++seq;
    pending.set(id, done);
    ws.send(JSON.stringify({ id, method, params }));
  });

await send('Page.enable');
await send('Network.enable');
await send('Runtime.enable');

async function shot(name, path, { width = 1440, height = 900, full = true } = {}) {
  await send('Emulation.setDeviceMetricsOverride', {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: width < 700,
  });
  await send('Page.navigate', { url: `${WEB}${path}` });
  await sleep(WAIT);
  let clip;
  if (full) {
    const metrics = await send('Page.getLayoutMetrics');
    const contentHeight = Math.min(Math.ceil(metrics.result.cssContentSize.height), 6000);
    clip = { x: 0, y: 0, width, height: contentHeight, scale: 1 };
  }
  const result = await send('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: full,
    ...(clip ? { clip } : {}),
  });
  writeFileSync(join(OUT, `${name}.png`), Buffer.from(result.result.data, 'base64'));
  console.log(`✓ ${name}`);
}

async function login() {
  const response = await fetch(`${WEB}/api/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: USER, password: PASSWORD }),
  });
  if (!response.ok) throw new Error(`Login fallido (${response.status})`);
  await send('Network.clearBrowserCookies');
  for (const raw of response.headers.getSetCookie()) {
    const [pair] = raw.split(';');
    const [name, value] = pair.split(/=(.*)/s);
    await send('Network.setCookie', { name, value, domain: new URL(WEB).hostname, path: '/', httpOnly: true });
  }
}

const wanted = new Set(process.argv.slice(2));
const want = (name) => wanted.size === 0 || wanted.has(name);

try {
  if (want('login')) await shot('login', '/login', { full: false });
  if (want('intake')) await shot('intake', '/intake', { full: false });

  await login();

  const pages = [
    ['dashboard', '/dashboard'],
    ['cases', '/cases'],
    ['new-case', '/cases/new'],
    ['companies', '/companies'],
    ['consultants', '/consultants'],
    ['proposals', '/proposals'],
    ['sla', '/sla'],
    ['audit', '/audit'],
    ['settings', '/settings'],
  ];
  for (const [name, path] of pages) if (want(name)) await shot(name, path);

  if (want('detail')) {
    // Un caso por etapa representativa, resuelto con la sesión del navegador.
    await send('Page.navigate', { url: `${WEB}/dashboard` });
    await sleep(1500);
    const evaluated = await send('Runtime.evaluate', {
      expression:
        "fetch('/api/proxy/cases?pageSize=50').then(r=>r.json()).then(d=>JSON.stringify(d.data.map(c=>[c.status,c.id])))",
      awaitPromise: true,
    });
    const byStatus = Object.fromEntries(JSON.parse(evaluated.result.result.value));
    for (const status of ['CERRADO', 'EN_EJECUCION', 'EN_DECISION_CLIENTE', 'CERRADO_SIN_CONTRATACION']) {
      if (byStatus[status]) await shot(`detail-${status.toLowerCase()}`, `/cases/${byStatus[status]}`);
    }
  }

  if (want('mobile')) {
    await shot('mobile-dashboard', '/dashboard', { width: 390, height: 844 });
    await shot('mobile-cases', '/cases', { width: 390, height: 844 });
  }
} finally {
  ws.close();
  chrome.kill();
}

console.log(`\nCapturas en ${OUT}`);
process.exit(0);
