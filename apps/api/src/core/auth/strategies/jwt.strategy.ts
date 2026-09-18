import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UserStatus } from '@prisma/client';
import type { AppConfig } from '../../config/configuration';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthenticatedUser, JwtPayload } from '../auth.types';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService<AppConfig, true>,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get('jwt', { infer: true }).secret,
    });
  }

  /**
   * Se consulta la base en cada petición en lugar de confiar sólo en el token.
   *
   * Es deliberado: un usuario suspendido, o cuyo rol cambió, debe perder el
   * acceso **de inmediato**, no cuando expire su access token. El coste es una
   * consulta por id con `select` acotado, que PostgreSQL resuelve por índice
   * primario; si algún día pesara, el sitio correcto para aliviarlo es una caché
   * en Redis invalidada por evento, no aflojar la comprobación.
   */
  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    if (payload.typ !== 'access') {
      throw new UnauthorizedException('El token proporcionado no es un token de acceso');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        fullName: true,
        status: true,
        companyId: true,
        role: {
          select: {
            code: true,
            permissions: { select: { permission: { select: { code: true } } } },
          },
        },
        consultant: { select: { id: true } },
      },
    });

    if (!user) {
      throw new UnauthorizedException('Usuario no encontrado');
    }
    if (user.status !== UserStatus.ACTIVO) {
      throw new UnauthorizedException('La cuenta no está activa');
    }

    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role.code,
      permissions: user.role.permissions.map((rp) => rp.permission.code),
      companyId: user.companyId,
      consultantId: user.consultant?.id ?? null,
    };
  }
}
