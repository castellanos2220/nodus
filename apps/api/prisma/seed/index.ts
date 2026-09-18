import path from 'node:path';
import { config as loadEnv } from 'dotenv';

// El monorepo mantiene un único .env en la raíz.
loadEnv({ path: path.resolve(__dirname, '../../../../.env') });

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { PrismaClient } from '@prisma/client';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/core/prisma/prisma.service';
import { seedDemoData, DEMO_PASSWORD } from './demo.seed';
import { seedLookups } from './lookups.seed';
import { seedCaseStatuses, seedChecklistTemplates, seedSlaRules } from './platform.seed';
import { seedRbac } from './rbac.seed';
import { seedNotificationTemplates } from './templates.seed';

/**
 * Seed reproducible.
 *
 * Dos fases con naturalezas distintas:
 *
 *  1. **Configuración de plataforma** (LOV, RBAC, estados, checklists, SLA,
 *     plantillas TCOM). Es idempotente: se puede volver a ejecutar sobre una
 *     base existente sin duplicar nada, porque todo va por `upsert` sobre claves
 *     naturales. Se siembra con un cliente Prisma simple.
 *
 *  2. **Datos de demostración**. Se siembran levantando la aplicación completa y
 *     ejecutando las transiciones **reales** del motor de workflow con los
 *     usuarios reales de cada rol. Es más lento y depende de Redis, y a cambio
 *     garantiza que ningún dato de la demo sea inalcanzable por el flujo de
 *     producto: si un guard o un permiso estuvieran mal, el seed fallaría aquí.
 */
async function main(): Promise<void> {
  const logger = new Logger('Seed');
  const started = Date.now();

  // ---------------------------------------------------- Fase 1: plataforma
  const prisma = new PrismaClient();

  try {
    logger.log('Sembrando configuración de plataforma…');

    await seedLookups(prisma);
    logger.log('  · Listas de valores (LOV)');

    await seedRbac(prisma);
    logger.log('  · Roles y permisos');

    await seedCaseStatuses(prisma);
    logger.log('  · Catálogo de estados del caso');

    await seedChecklistTemplates(prisma);
    logger.log('  · Plantillas de checklist T7A y T9C');

    await seedSlaRules(prisma);
    logger.log('  · Reglas de SLA');

    await seedNotificationTemplates(prisma);
    logger.log('  · Plantillas de comunicación TCOM');
  } finally {
    await prisma.$disconnect();
  }

  // -------------------------------------------- Fase 2: datos de demostración
  const existingCases = await countCases();

  if (existingCases > 0) {
    logger.warn(
      `Ya existen ${existingCases} casos: se omiten los datos de demostración. ` +
        'Use `pnpm db:reset` para regenerarlos desde cero.',
    );
    logger.log(`Seed completado en ${Math.round((Date.now() - started) / 1000)} s`);
    return;
  }

  logger.log('Sembrando datos de demostración mediante el motor de workflow real…');

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  try {
    await seedDemoData(app);

    const summary = await summarize(app.get(PrismaService));
    logger.log('Datos de demostración creados:');
    for (const [label, value] of Object.entries(summary)) {
      logger.log(`  · ${label}: ${value}`);
    }

    logger.log('');
    logger.log('Credenciales de demostración (todas con la misma contraseña):');
    logger.log(`  contraseña: ${DEMO_PASSWORD}`);
    logger.log('  admin@nodus.local                      — Super administrador');
    logger.log('  advisory@nodus.local                   — Advisory / PMO');
    logger.log('  revisor@nodus.local                    — Consultor revisor');
    logger.log('  ana.velez@consultor.nodus.local        — Consultora (operaciones)');
    logger.log('  bruno.salcedo@consultor.nodus.local    — Consultor (finanzas, sponsor)');
    logger.log('  claudia.ibanez@consultor.nodus.local   — Consultora (tecnología)');
    logger.log('  maria.restrepo@acerosdelnorte.com      — Cliente Mipyme (Aceros del Norte)');
    logger.log('  carlos.duarte@vitalissalud.com         — Cliente Mipyme (Vitalis Salud)');
    logger.log('');
    logger.log('Detalle completo en docs/demo/credentials.md');
  } finally {
    await app.close();
  }

  logger.log(`Seed completado en ${Math.round((Date.now() - started) / 1000)} s`);
}

async function countCases(): Promise<number> {
  const prisma = new PrismaClient();
  try {
    return await prisma.case.count();
  } finally {
    await prisma.$disconnect();
  }
}

async function summarize(prisma: PrismaService): Promise<Record<string, string>> {
  const [companies, users, consultants, cases, byStatus, applications, proposals, documents, audits, slas, notifications] =
    await Promise.all([
      prisma.company.count(),
      prisma.user.count(),
      prisma.consultant.count(),
      prisma.case.count(),
      prisma.case.groupBy({ by: ['status'], _count: { _all: true } }),
      prisma.application.count(),
      prisma.proposalVersion.count(),
      prisma.document.count(),
      prisma.auditLog.count(),
      prisma.slaInstance.count(),
      prisma.notification.count(),
    ]);

  return {
    Empresas: String(companies),
    Usuarios: String(users),
    Consultores: String(consultants),
    Casos: `${cases} (${byStatus
      .map((row) => `${row.status}: ${row._count._all}`)
      .join(', ')})`,
    Postulaciones: String(applications),
    'Versiones de propuesta': String(proposals),
    Documentos: String(documents),
    'Registros de auditoría': String(audits),
    'Instancias de SLA': String(slas),
    Notificaciones: String(notifications),
  };
}

main()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    // eslint-disable-next-line no-console
    console.error('\nEl seed falló:\n', error);
    process.exit(1);
  });
