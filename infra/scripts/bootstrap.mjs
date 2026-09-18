#!/usr/bin/env node
/**
 * Bootstrap del entorno.
 *
 * Deja el proyecto listo desde cero, en orden y comprobando cada paso:
 * copia `.env`, levanta la infraestructura, espera a que esté sana, compila los
 * contratos compartidos, aplica las migraciones y siembra los datos.
 *
 *   node infra/scripts/bootstrap.mjs
 */

import { execSync } from 'node:child_process';
import { copyFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import net from 'node:net';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

const green = (t) => `\x1b[32m${t}\x1b[0m`;
const red = (t) => `\x1b[31m${t}\x1b[0m`;
const dim = (t) => `\x1b[2m${t}\x1b[0m`;
const bold = (t) => `\x1b[1m${t}\x1b[0m`;

let step = 0;
const total = 6;

function announce(text) {
  step += 1;
  console.log(`\n${bold(`[${step}/${total}]`)} ${text}`);
}

function run(command, options = {}) {
  console.log(dim(`      $ ${command}`));
  execSync(command, { cwd: ROOT, stdio: 'inherit', ...options });
}

function waitForPort(host, port, label, timeoutMs = 120_000) {
  return new Promise((resolvePromise, rejectPromise) => {
    const deadline = Date.now() + timeoutMs;

    const attempt = () => {
      const socket = net.createConnection({ host, port });
      socket.setTimeout(2000);

      socket.on('connect', () => {
        socket.destroy();
        console.log(`      ${green('✓')} ${label} responde en ${host}:${port}`);
        resolvePromise();
      });

      const retry = () => {
        socket.destroy();
        if (Date.now() > deadline) {
          rejectPromise(new Error(`${label} no respondió en ${host}:${port}`));
          return;
        }
        setTimeout(attempt, 1500);
      };

      socket.on('error', retry);
      socket.on('timeout', retry);
    };

    attempt();
  });
}

async function main() {
  console.log(bold('\nNODUS — preparación del entorno\n'));

  // ------------------------------------------------------------------ 1
  announce('Configuración de entorno');
  const envPath = resolve(ROOT, '.env');
  if (existsSync(envPath)) {
    console.log(`      ${green('✓')} .env ya existe; se conserva`);
  } else {
    copyFileSync(resolve(ROOT, '.env.example'), envPath);
    console.log(`      ${green('✓')} .env creado a partir de .env.example`);
  }

  // ------------------------------------------------------------------ 2
  announce('Infraestructura (PostgreSQL, Redis, MinIO, Mailpit)');
  run('docker compose up -d postgres redis minio mailpit minio-init');

  // ------------------------------------------------------------------ 3
  announce('Esperando a que los servicios estén listos');
  await waitForPort('127.0.0.1', 5432, 'PostgreSQL');
  await waitForPort('127.0.0.1', 6379, 'Redis');
  await waitForPort('127.0.0.1', 9000, 'MinIO');
  await waitForPort('127.0.0.1', 1025, 'Mailpit (SMTP)');

  // ------------------------------------------------------------------ 4
  announce('Contratos compartidos');
  run('pnpm --filter @nodus/types build');

  // ------------------------------------------------------------------ 5
  announce('Migraciones de base de datos');
  run('pnpm --filter @nodus/api exec prisma generate');
  run('pnpm --filter @nodus/api exec prisma migrate deploy');

  // ------------------------------------------------------------------ 6
  announce('Datos de demostración');
  run('pnpm --filter @nodus/api db:seed');

  console.log(`\n${green(bold('Entorno listo.'))}\n`);
  console.log('  Arrancar:        pnpm dev');
  console.log('  Worker:          pnpm dev:worker');
  console.log('  Aplicación:      http://localhost:3000');
  console.log('  Swagger:         http://localhost:4000/api/v1/docs');
  console.log('  Correos:         http://localhost:8025');
  console.log('  Verificación:    node infra/scripts/smoke.mjs');
  console.log(`\n  Credenciales en ${dim('docs/demo/credentials.md')}\n`);
}

main().catch((error) => {
  console.error(red(`\n  Falló la preparación: ${error.message}\n`));
  process.exit(1);
});
