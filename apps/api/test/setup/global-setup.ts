import { execSync } from 'node:child_process';
import path from 'node:path';
import { config as loadEnv } from 'dotenv';
import { Client } from 'pg';

/**
 * Preparación del entorno de pruebas.
 *
 * Las pruebas de integración y E2E corren contra una base **propia**
 * (`nodus_test`), no contra la de desarrollo: así se pueden truncar tablas entre
 * casos sin destruir los datos de demostración que el evaluador está mirando.
 *
 * El setup es idempotente: crea la base si no existe, aplica las migraciones y
 * siembra sólo la configuración de plataforma (LOV, RBAC, estados, checklists,
 * SLA y plantillas). Los datos de negocio los crea cada prueba.
 */
export default async function globalSetup(): Promise<void> {
  loadEnv({ path: path.resolve(__dirname, '../../../../.env') });

  const baseUrl = process.env.DATABASE_URL;
  if (!baseUrl) {
    throw new Error('DATABASE_URL no está definida: copie .env.example a .env');
  }

  const testUrl = toTestDatabaseUrl(baseUrl);
  process.env.DATABASE_URL = testUrl;
  process.env.NODE_ENV = 'test';

  await ensureDatabaseExists(baseUrl, databaseNameOf(testUrl));

  const apiDir = path.resolve(__dirname, '../..');

  // `inherit` a propósito: si las migraciones fallan, el mensaje debe verse.
  // Un setup que falla en silencio produce errores incomprensibles aguas abajo.
  execSync('npx prisma migrate deploy', {
    cwd: apiDir,
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: testUrl },
  });

  // Sólo la configuración de plataforma; los datos de demostración no hacen
  // falta y ralentizarían cada ejecución.
  execSync('npx ts-node --project tsconfig.json test/setup/seed-platform.ts', {
    cwd: apiDir,
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: testUrl },
  });
}

export function toTestDatabaseUrl(url: string): string {
  const parsed = new URL(url);
  const current = parsed.pathname.replace(/^\//, '');
  if (current.endsWith('_test')) return url;
  parsed.pathname = `/${current}_test`;
  return parsed.toString();
}

function databaseNameOf(url: string): string {
  return new URL(url).pathname.replace(/^\//, '');
}

async function ensureDatabaseExists(adminUrl: string, database: string): Promise<void> {
  const parsed = new URL(adminUrl);
  parsed.pathname = '/postgres';
  // `pg` no entiende los parámetros de pool de Prisma.
  parsed.search = '';

  const client = new Client({ connectionString: parsed.toString() });
  await client.connect();

  try {
    const existing = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [database]);
    if (existing.rowCount === 0) {
      // El nombre viene de nuestra propia configuración, no de entrada de usuario.
      await client.query(`CREATE DATABASE "${database}"`);
    }

    // Las extensiones se instalan en la base de pruebas igual que en la principal.
    const target = new URL(adminUrl);
    target.pathname = `/${database}`;
    target.search = '';
    const targetClient = new Client({ connectionString: target.toString() });
    await targetClient.connect();
    try {
      await targetClient.query('CREATE EXTENSION IF NOT EXISTS pg_trgm');
      await targetClient.query('CREATE EXTENSION IF NOT EXISTS unaccent');
    } finally {
      await targetClient.end();
    }
  } finally {
    await client.end();
  }
}
