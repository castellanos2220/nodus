import { PrismaClient } from '@prisma/client';
import { seedLookups } from '../../prisma/seed/lookups.seed';
import {
  seedCaseStatuses,
  seedChecklistTemplates,
  seedSlaRules,
} from '../../prisma/seed/platform.seed';
import { seedRbac } from '../../prisma/seed/rbac.seed';
import { seedNotificationTemplates } from '../../prisma/seed/templates.seed';

/** Siembra sólo la configuración de plataforma en la base de pruebas. */
async function main(): Promise<void> {
  const prisma = new PrismaClient();
  try {
    await seedLookups(prisma);
    await seedRbac(prisma);
    await seedCaseStatuses(prisma);
    await seedChecklistTemplates(prisma);
    await seedSlaRules(prisma);
    await seedNotificationTemplates(prisma);
  } finally {
    await prisma.$disconnect();
  }
}

void main();
