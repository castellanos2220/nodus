import {
  CanActivate,
  ExecutionContext,
  Injectable,
  SetMetadata,
  UseGuards,
  applyDecorators,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CaseAccessService } from '../case-access.service';
import type { AuthenticatedUser } from '../auth.types';
import { IS_PUBLIC_KEY } from '../decorators';

export const CASE_ACCESS_KEY = 'nodus:caseAccess';

/**
 * Nivel exigido por el endpoint:
 *  · `ANY`  — basta poder leer el caso (completo o en versión controlada).
 *  · `FULL` — exige acceso completo al expediente.
 */
export type RequiredCaseAccess = 'ANY' | 'FULL';

/**
 * Autorización a nivel de recurso para rutas con `:id` o `:caseId`.
 *
 * Se aplica **después** de `PermissionsGuard`: primero "¿este rol puede leer
 * casos?", luego "¿puede leer **este** caso?". Tener el permiso `CASE_READ` no
 * da derecho a leer el caso de otra empresa, y esa segunda pregunta es la que
 * responde este guard.
 *
 * El resultado queda en `request.caseAccess` para que el controlador no repita
 * la consulta.
 */
@Injectable()
export class CaseAccessGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly caseAccess: CaseAccessService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const required = this.reflector.getAllAndOverride<RequiredCaseAccess>(CASE_ACCESS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required) return true;

    const request = context.switchToHttp().getRequest<{
      user?: AuthenticatedUser;
      params: Record<string, string>;
      caseAccess?: unknown;
    }>();

    const caseId = request.params.caseId ?? request.params.id;
    if (!caseId || !request.user) return true;

    request.caseAccess =
      required === 'FULL'
        ? await this.caseAccess.assertFullAccess(request.user, caseId)
        : await this.caseAccess.assertCanRead(request.user, caseId);

    return true;
  }
}

/** Declara el nivel de acceso al caso exigido y activa el guard. */
export const CaseAccess = (level: RequiredCaseAccess): MethodDecorator & ClassDecorator =>
  applyDecorators(SetMetadata(CASE_ACCESS_KEY, level), UseGuards(CaseAccessGuard));
