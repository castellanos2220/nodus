/**
 * Configuración tipada de la aplicación.
 *
 * Nada lee `process.env` fuera de este archivo: el resto del código inyecta
 * `ConfigService<AppConfig, true>` y obtiene valores ya validados y con el tipo
 * correcto. Eso convierte un error de despliegue (variable olvidada) en un fallo
 * al arrancar con mensaje claro, en vez de un `undefined` que revienta a las
 * tres horas dentro de un job.
 */
export interface AppConfig {
  nodeEnv: 'development' | 'test' | 'production';
  appName: string;
  isProduction: boolean;
  logLevel: string;

  http: {
    port: number;
    globalPrefix: string;
    corsOrigins: string[];
    appUrl: string;
    apiUrl: string;
    maxRequestBodyMb: number;
  };

  database: {
    url: string;
  };

  jwt: {
    secret: string;
    refreshSecret: string;
    expiresIn: string;
    refreshExpiresIn: string;
  };

  redis: {
    host: string;
    port: number;
    password?: string;
    url: string;
    cacheTtlSeconds: number;
  };

  storage: {
    endpoint: string;
    region: string;
    accessKey: string;
    secretKey: string;
    bucket: string;
    forcePathStyle: boolean;
    signedUrlTtlSeconds: number;
    maxFileSizeMb: number;
  };

  mail: {
    host: string;
    port: number;
    user?: string;
    password?: string;
    secure: boolean;
    from: string;
  };

  sla: {
    evaluationCron: string;
    atRiskThresholdPercent: number;
  };

  throttle: {
    ttlSeconds: number;
    limit: number;
    authTtlSeconds: number;
    authLimit: number;
  };

  workerMode: boolean;
}

const bool = (value: string | undefined, fallback: boolean): boolean => {
  if (value === undefined || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
};

const int = (value: string | undefined, fallback: number): number => {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const list = (value: string | undefined, fallback: string[]): string[] => {
  if (!value) return fallback;
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
};

export const configuration = (): AppConfig => {
  const nodeEnv = (process.env.NODE_ENV ?? 'development') as AppConfig['nodeEnv'];

  return {
    nodeEnv,
    appName: process.env.APP_NAME ?? 'NODUS',
    isProduction: nodeEnv === 'production',
    logLevel: process.env.LOG_LEVEL ?? (nodeEnv === 'production' ? 'info' : 'debug'),

    http: {
      port: int(process.env.API_PORT, 4000),
      globalPrefix: process.env.API_PREFIX ?? 'api/v1',
      corsOrigins: list(process.env.CORS_ORIGINS, ['http://localhost:3000']),
      appUrl: process.env.APP_URL ?? 'http://localhost:3000',
      apiUrl: process.env.API_URL ?? 'http://localhost:4000',
      maxRequestBodyMb: int(process.env.MAX_REQUEST_BODY_MB, 2),
    },

    database: {
      url: process.env.DATABASE_URL ?? '',
    },

    jwt: {
      secret: process.env.JWT_SECRET ?? '',
      refreshSecret: process.env.JWT_REFRESH_SECRET ?? '',
      expiresIn: process.env.JWT_EXPIRES_IN ?? '15m',
      refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',
    },

    redis: {
      host: process.env.REDIS_HOST ?? 'localhost',
      port: int(process.env.REDIS_PORT, 6379),
      password: process.env.REDIS_PASSWORD || undefined,
      url: process.env.REDIS_URL ?? 'redis://localhost:6379',
      cacheTtlSeconds: int(process.env.CACHE_TTL_SECONDS, 60),
    },

    storage: {
      endpoint: process.env.S3_ENDPOINT ?? 'http://localhost:9000',
      region: process.env.S3_REGION ?? 'us-east-1',
      accessKey: process.env.S3_ACCESS_KEY ?? '',
      secretKey: process.env.S3_SECRET_KEY ?? '',
      bucket: process.env.S3_BUCKET ?? 'nodus-documents',
      forcePathStyle: bool(process.env.S3_FORCE_PATH_STYLE, true),
      signedUrlTtlSeconds: int(process.env.S3_SIGNED_URL_TTL_SECONDS, 300),
      maxFileSizeMb: int(process.env.MAX_FILE_SIZE_MB, 25),
    },

    mail: {
      host: process.env.SMTP_HOST ?? 'localhost',
      port: int(process.env.SMTP_PORT, 1025),
      user: process.env.SMTP_USER || undefined,
      password: process.env.SMTP_PASSWORD || undefined,
      secure: bool(process.env.SMTP_SECURE, false),
      from: process.env.MAIL_FROM ?? 'NODUS <no-reply@nodus.local>',
    },

    sla: {
      evaluationCron: process.env.SLA_EVALUATION_CRON ?? '*/5 * * * *',
      atRiskThresholdPercent: int(process.env.SLA_AT_RISK_THRESHOLD_PERCENT, 75),
    },

    // El límite de tasa protege de abuso en producción. Una suite E2E recorre el
    // ciclo completo desde una sola dirección y lo dispararía: en `test` se eleva
    // el techo en lugar de desactivar el guard, para que el middleware siga
    // siendo el mismo que corre en producción.
    throttle: {
      ttlSeconds: int(process.env.THROTTLE_TTL_SECONDS, 60),
      limit: nodeEnv === 'test' ? 100_000 : int(process.env.THROTTLE_LIMIT, 120),
      authTtlSeconds: int(process.env.THROTTLE_AUTH_TTL_SECONDS, 300),
      authLimit: nodeEnv === 'test' ? 100_000 : int(process.env.THROTTLE_AUTH_LIMIT, 10),
    },

    workerMode: bool(process.env.WORKER_MODE, false),
  };
};
