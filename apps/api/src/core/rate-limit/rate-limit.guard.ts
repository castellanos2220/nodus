import { Injectable } from '@nestjs/common';
import { ThrottlerGuard, type ThrottlerRequest } from '@nestjs/throttler';
import type { AuthenticatedUser } from '../auth/auth.types';
import {
  PER_ROUTE_POLICIES,
  RateLimitPolicy,
  USER_TRACKED_POLICIES,
  resolveRateLimitPolicy,
} from './rate-limit.policy';

interface TrackedRequest {
  ip?: string;
  socket?: { remoteAddress?: string };
  user?: AuthenticatedUser;
  body?: unknown;
}

/**
 * Guard de límite de tasa con políticas por tipo de ruta.
 *
 * El módulo registra un throttler con nombre por política; este guard deja
 * pasar sin contar todos los que no corresponden a la política de la ruta, de
 * modo que cada petición consume exactamente **un** cupo.
 *
 * Se registra después de `JwtAuthGuard`: cuando llega aquí, `req.user` ya está
 * resuelto y las políticas de lectura/escritura pueden contar por usuario. Eso
 * importa porque toda la navegación llega a través del proxy de Next: contar
 * por IP metería a todos los usuarios en el mismo cupo.
 */
@Injectable()
export class RateLimitGuard extends ThrottlerGuard {
  protected override async handleRequest(request: ThrottlerRequest): Promise<boolean> {
    const policy = resolveRateLimitPolicy(this.reflector, request.context);

    if (request.throttler.name !== policy) return true;

    return super.handleRequest({
      ...request,
      getTracker: (req) => this.trackerFor(policy, req as TrackedRequest),
      generateKey: (context, tracker, name) =>
        PER_ROUTE_POLICIES.has(policy)
          ? this.generateKey(context, tracker, name)
          : `nodus-rl:${name}:${tracker}`,
    });
  }

  private trackerFor(policy: RateLimitPolicy, req: TrackedRequest): string {
    if (USER_TRACKED_POLICIES.has(policy) && req.user?.id) {
      return `user:${req.user.id}`;
    }

    const ip = req.ip ?? req.socket?.remoteAddress ?? 'unknown';

    // En autenticación el cupo es por IP **y** cuenta: una persona que se
    // equivoca de contraseña no bloquea el login de todos los que comparten
    // salida a internet (una oficina, o el propio proxy si la IP real no se
    // propagó). El bloqueo por intentos fallidos de cada cuenta sigue en
    // AuthService.
    if (policy === RateLimitPolicy.AUTH) {
      const email = (req.body as { email?: unknown } | undefined)?.email;
      if (typeof email === 'string' && email.length > 0) {
        return `ip:${ip}|account:${email.trim().toLowerCase()}`;
      }
    }

    return `ip:${ip}`;
  }
}
