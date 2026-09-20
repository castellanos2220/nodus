import { SetMetadata, type ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../auth/decorators';

/**
 * Políticas de límite de tasa.
 *
 * Cada ruta pasa por **una sola** política. Antes se registraban dos throttlers
 * con nombre y `@nestjs/throttler` aplica todos los throttlers con nombre a
 * todas las rutas: el límite estricto pensado para el login (10 cada 5 min)
 * acababa limitando también cada GET de la navegación. Ver
 * `docs/adr/ADR-009-rate-limiting.md`.
 *
 *   AUTH      login, refresh, cambio de contraseña   estricto · por IP (+ cuenta)
 *   PUBLIC    endpoints sin sesión (intake, LOV)     estricto · por IP
 *   WRITE     POST/PATCH/PUT/DELETE autenticados     moderado · por usuario
 *   READ      GET autenticados                       alto     · por usuario
 *   INTERNAL  health/readiness de la infraestructura independiente · por IP
 */
export const RateLimitPolicy = {
  AUTH: 'auth',
  PUBLIC: 'public',
  WRITE: 'write',
  READ: 'read',
  INTERNAL: 'internal',
} as const;
export type RateLimitPolicy = (typeof RateLimitPolicy)[keyof typeof RateLimitPolicy];

export const ALL_RATE_LIMIT_POLICIES = Object.values(RateLimitPolicy);

const RATE_LIMIT_POLICY_KEY = 'nodus:rateLimitPolicy';

/** Fija la política de una ruta o de un controlador completo. */
export const RatePolicy = (policy: RateLimitPolicy): MethodDecorator & ClassDecorator =>
  SetMetadata(RATE_LIMIT_POLICY_KEY, policy);

const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Política efectiva de una petición:
 *   1. la declarada con `@RatePolicy` (ruta, luego controlador);
 *   2. si la ruta es `@Public()`, PUBLIC;
 *   3. si no, READ para métodos de lectura y WRITE para el resto.
 */
export function resolveRateLimitPolicy(
  reflector: Reflector,
  context: ExecutionContext,
): RateLimitPolicy {
  const targets = [context.getHandler(), context.getClass()];

  const declared = reflector.getAllAndOverride<RateLimitPolicy | undefined>(
    RATE_LIMIT_POLICY_KEY,
    targets,
  );
  if (declared) return declared;

  if (reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets)) {
    return RateLimitPolicy.PUBLIC;
  }

  const method = String(context.switchToHttp().getRequest<{ method?: string }>().method ?? 'GET');
  return READ_METHODS.has(method.toUpperCase()) ? RateLimitPolicy.READ : RateLimitPolicy.WRITE;
}

/**
 * Políticas cuyo contador es **por ruta** (cada endpoint su cupo). Las demás
 * usan un cupo **global por usuario**: lo que importa en la navegación es
 * cuántas peticiones hace una persona, no a qué endpoint.
 */
export const PER_ROUTE_POLICIES: ReadonlySet<RateLimitPolicy> = new Set([
  RateLimitPolicy.AUTH,
  RateLimitPolicy.PUBLIC,
  RateLimitPolicy.INTERNAL,
]);

/** Políticas que identifican al usuario autenticado en lugar de a la IP. */
export const USER_TRACKED_POLICIES: ReadonlySet<RateLimitPolicy> = new Set([
  RateLimitPolicy.READ,
  RateLimitPolicy.WRITE,
]);
