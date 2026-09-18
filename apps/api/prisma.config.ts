import path from 'node:path';
import { config as loadEnv } from 'dotenv';
import { defineConfig } from 'prisma/config';

/**
 * El monorepo mantiene **un solo** `.env`, en la raíz. Prisma CLI, por defecto, lo
 * buscaría junto al esquema (`apps/api/.env`), lo que obligaría a duplicar secretos
 * en dos archivos. Aquí se carga explícitamente el de la raíz antes de que Prisma
 * resuelva `env("DATABASE_URL")`.
 */
loadEnv({ path: path.resolve(__dirname, '../../.env') });

export default defineConfig({
  schema: path.join('prisma', 'schema.prisma'),
  migrations: {
    path: path.join('prisma', 'migrations'),
    seed: 'tsx prisma/seed/index.ts',
  },
});
