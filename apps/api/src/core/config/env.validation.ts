import { z } from 'zod';

/**
 * Validación de entorno al arrancar. Si falta o es inválida una variable crítica,
 * el proceso muere aquí con un mensaje que dice exactamente cuál — en vez de
 * fallar más tarde con un `undefined` difícil de rastrear.
 */
const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

    DATABASE_URL: z
      .string({ required_error: 'DATABASE_URL es obligatoria' })
      .url('DATABASE_URL debe ser una URL de conexión válida'),

    JWT_SECRET: z.string().min(32, 'JWT_SECRET debe tener al menos 32 caracteres'),
    JWT_REFRESH_SECRET: z
      .string()
      .min(32, 'JWT_REFRESH_SECRET debe tener al menos 32 caracteres'),

    REDIS_HOST: z.string().default('localhost'),
    REDIS_PORT: z.coerce.number().int().positive().default(6379),

    S3_ENDPOINT: z.string().url('S3_ENDPOINT debe ser una URL'),
    S3_ACCESS_KEY: z.string().min(1, 'S3_ACCESS_KEY es obligatoria'),
    S3_SECRET_KEY: z.string().min(1, 'S3_SECRET_KEY es obligatoria'),
    S3_BUCKET: z.string().min(1, 'S3_BUCKET es obligatorio'),

    SMTP_HOST: z.string().min(1),
    SMTP_PORT: z.coerce.number().int().positive(),

    API_PORT: z.coerce.number().int().positive().default(4000),
  })
  .passthrough()
  .superRefine((env, ctx) => {
    if (env.NODE_ENV !== 'production') return;

    // En producción los secretos de ejemplo son un fallo de despliegue, no un aviso.
    const weak = ['dev_only', 'change_me', 'changeme', 'secret', 'password'];
    for (const key of ['JWT_SECRET', 'JWT_REFRESH_SECRET'] as const) {
      const value = String(env[key] ?? '').toLowerCase();
      if (weak.some((needle) => value.includes(needle))) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [key],
          message: `${key} conserva un valor de ejemplo; genere un secreto real antes de desplegar en producción`,
        });
      }
    }
    if (env.JWT_SECRET === env.JWT_REFRESH_SECRET) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['JWT_REFRESH_SECRET'],
        message: 'JWT_REFRESH_SECRET debe ser distinto de JWT_SECRET',
      });
    }
  });

export function validateEnv(raw: Record<string, unknown>): Record<string, unknown> {
  const result = envSchema.safeParse(raw);

  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `  · ${issue.path.join('.') || '(raíz)'}: ${issue.message}`)
      .join('\n');
    throw new Error(
      `Configuración de entorno inválida.\n${details}\n\n` +
        'Revise el archivo .env (parta de .env.example).',
    );
  }

  return result.data;
}
