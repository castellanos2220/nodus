import { Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import type { AppConfig } from '../config/configuration';

/**
 * Caché de lecturas caras, con **invalidación por evento**, no por TTL corto.
 *
 * Qué se cachea y por qué:
 *  · LOV (`lookups:*`) — se leen en casi todas las pantallas y cambian rara vez.
 *  · KPIs del dashboard — agregados sobre miles de filas; 60 s de desfase es
 *    aceptable para un tablero de gestión y evita recalcular en cada visita.
 *
 * Qué **no** se cachea: nada relacionado con permisos o con el estado de un caso.
 * Servir un estado obsoleto en un sistema de workflow es peor que ser lento.
 */
@Injectable()
export class CacheService implements OnModuleDestroy {
  private readonly logger = new Logger(CacheService.name);
  private readonly redis: Redis;
  private readonly defaultTtl: number;
  private available = true;

  constructor(config: ConfigService<AppConfig, true>) {
    const redis = config.get('redis', { infer: true });
    this.defaultTtl = redis.cacheTtlSeconds;

    this.redis = new Redis({
      host: redis.host,
      port: redis.port,
      password: redis.password,
      lazyConnect: false,
      maxRetriesPerRequest: 2,
      retryStrategy: (times) => Math.min(times * 200, 3_000),
    });

    this.redis.on('error', (error) => {
      if (this.available) {
        this.available = false;
        this.logger.warn(`Redis no disponible: ${error.message}. La caché queda desactivada.`);
      }
    });
    this.redis.on('ready', () => {
      if (!this.available) this.logger.log('Redis disponible de nuevo');
      this.available = true;
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit().catch(() => undefined);
  }

  /**
   * Lee de caché o calcula. Si Redis está caído **no** falla: calcula y sigue.
   * Una caché que tumba el producto cuando se cae no es una optimización.
   */
  async remember<T>(key: string, ttlSeconds: number | undefined, factory: () => Promise<T>): Promise<T> {
    if (this.available) {
      try {
        const cached = await this.redis.get(key);
        if (cached !== null) return JSON.parse(cached) as T;
      } catch {
        /* se ignora y se calcula */
      }
    }

    const value = await factory();

    if (this.available) {
      try {
        await this.redis.set(key, JSON.stringify(value), 'EX', ttlSeconds ?? this.defaultTtl);
      } catch {
        /* se ignora: guardar en caché es best-effort */
      }
    }

    return value;
  }

  async del(...keys: string[]): Promise<void> {
    if (!this.available || keys.length === 0) return;
    try {
      await this.redis.del(...keys);
    } catch {
      /* best-effort */
    }
  }

  /** Invalida por prefijo usando SCAN (nunca KEYS, que bloquea el servidor). */
  async invalidatePrefix(prefix: string): Promise<void> {
    if (!this.available) return;
    try {
      let cursor = '0';
      do {
        const [next, keys] = await this.redis.scan(cursor, 'MATCH', `${prefix}*`, 'COUNT', 200);
        cursor = next;
        if (keys.length > 0) await this.redis.del(...keys);
      } while (cursor !== '0');
    } catch {
      /* best-effort */
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const pong = await this.redis.ping();
      return pong === 'PONG';
    } catch {
      return false;
    }
  }
}

export const CACHE_KEYS = {
  lookupList: (code: string) => `nodus:lookups:${code}`,
  lookupAll: () => 'nodus:lookups:__all__',
  dashboardKpis: (scope: string) => `nodus:dashboard:kpis:${scope}`,
  LOOKUPS_PREFIX: 'nodus:lookups:',
  DASHBOARD_PREFIX: 'nodus:dashboard:',
} as const;
