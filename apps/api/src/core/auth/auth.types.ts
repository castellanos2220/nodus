import type { RoleCode } from '@prisma/client';

/**
 * Identidad del usuario autenticado, adjuntada a `request.user` por
 * `JwtStrategy`. Los guards y los servicios trabajan siempre con este objeto:
 * nadie vuelve a consultar la base para saber quién es el actor.
 */
export interface AuthenticatedUser {
  id: string;
  email: string;
  fullName: string;
  role: RoleCode;
  permissions: string[];
  /** Sólo para CLIENTE_MIPYME: acota el acceso a los casos de su empresa. */
  companyId: string | null;
  /** Sólo para CONSULTOR / CONSULTOR_REVISOR. */
  consultantId: string | null;
}

export interface JwtPayload {
  sub: string;
  email: string;
  role: RoleCode;
  companyId: string | null;
  consultantId: string | null;
  /** `access` o `refresh`: un token de refresco no sirve para autenticar. */
  typ: 'access' | 'refresh';
  iat?: number;
  exp?: number;
}

export interface RequestWithUser extends Request {
  user: AuthenticatedUser;
}
