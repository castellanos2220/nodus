import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { RoleCode } from '@prisma/client';
import { ForbiddenError } from '../../common/errors/domain.errors';
import type { AuthenticatedUser } from '../auth.types';
import { IS_PUBLIC_KEY, PERMISSIONS_KEY, ROLES_KEY } from '../decorators';

/**
 * Autorización por rol y por permiso.
 *
 * Éste es el nivel "¿puede este rol hacer esta clase de cosa?". El nivel
 * "¿puede este usuario hacerlo sobre **este** recurso?" lo resuelve
 * `CaseAccessGuard`. Ambos son necesarios: tener `CASE_READ` no da derecho a
 * leer el caso de otra empresa.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const required = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const requiredRoles = this.reflector.getAllAndOverride<RoleCode[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!required?.length && !requiredRoles?.length) return true;

    const user = context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>().user;
    if (!user) {
      throw new ForbiddenError('No autenticado');
    }

    if (requiredRoles?.length && !requiredRoles.includes(user.role)) {
      throw new ForbiddenError(
        `Esta acción está restringida a: ${requiredRoles.join(', ')}`,
        'ROLE_NOT_ALLOWED',
        { requiredRoles, actualRole: user.role },
      );
    }

    if (required?.length) {
      const missing = required.filter((permission) => !user.permissions.includes(permission));
      if (missing.length > 0) {
        throw new ForbiddenError(
          `Le faltan permisos para esta acción: ${missing.join(', ')}`,
          'MISSING_PERMISSION',
          { missing },
        );
      }
    }

    return true;
  }
}
