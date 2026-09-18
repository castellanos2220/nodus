import { SetMetadata, createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { RoleCode } from '@prisma/client';
import type { AuthenticatedUser } from '../auth.types';

export const IS_PUBLIC_KEY = 'nodus:isPublic';
export const PERMISSIONS_KEY = 'nodus:permissions';
export const ROLES_KEY = 'nodus:roles';

/** Marca un endpoint como accesible sin token (login, health, refresh). */
export const Public = (): MethodDecorator & ClassDecorator => SetMetadata(IS_PUBLIC_KEY, true);

/**
 * Permisos requeridos. Se comprueban contra los permisos efectivos del rol del
 * usuario, cargados desde la base de datos al iniciar sesión.
 */
export const RequirePermissions = (
  ...permissions: string[]
): MethodDecorator & ClassDecorator => SetMetadata(PERMISSIONS_KEY, permissions);

/** Restricción por rol, cuando el permiso no captura bien la intención. */
export const RequireRoles = (...roles: RoleCode[]): MethodDecorator & ClassDecorator =>
  SetMetadata(ROLES_KEY, roles);

/** Inyecta el usuario autenticado en un parámetro del controlador. */
export const CurrentUser = createParamDecorator(
  (data: keyof AuthenticatedUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();
    const user = request.user;
    if (!user) return undefined;
    return data ? user[data] : user;
  },
);
