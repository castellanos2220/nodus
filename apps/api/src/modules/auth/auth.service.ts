import { createHash, randomBytes } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, type JwtSignOptions } from '@nestjs/jwt';
import { UserStatus } from '@prisma/client';
import * as argon2 from 'argon2';
import { AuditService, type AuditActor } from '../../core/audit/audit.service';
import type { AuthenticatedUser, JwtPayload } from '../../core/auth/auth.types';
import { UnauthorizedError, ValidationError } from '../../core/common/errors/domain.errors';
import type { AppConfig } from '../../core/config/configuration';
import { PrismaService } from '../../core/prisma/prisma.service';

const MAX_FAILED_LOGINS = 5;
const LOCK_MINUTES = 15;

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: AuthenticatedUser & { mustChangePassword: boolean };
}

/**
 * Autenticación.
 *
 * Decisiones que merecen justificarse:
 *
 *  · **Argon2id** y no bcrypt: es el ganador del Password Hashing Competition y
 *    el recomendado actual de OWASP; resiste mejor el crackeo con GPU.
 *  · **Refresh tokens rotativos con detección de reutilización**: cada refresco
 *    revoca el token usado y emite uno nuevo. Si llega un token ya rotado, se
 *    asume robo y se revoca toda la cadena del usuario.
 *  · **Sólo se guarda el SHA-256 del refresh token**: quien lea la tabla no
 *    puede suplantar a nadie.
 *  · **Bloqueo temporal tras 5 intentos**: frena la fuerza bruta sin dejar la
 *    cuenta inutilizable de forma permanente, que sería una vía de denegación
 *    de servicio contra un usuario legítimo.
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<AppConfig, true>,
    private readonly audit: AuditService,
  ) {}

  static hashPassword(plain: string): Promise<string> {
    return argon2.hash(plain, {
      type: argon2.argon2id,
      memoryCost: 19_456,
      timeCost: 2,
      parallelism: 1,
    });
  }

  async login(
    email: string,
    password: string,
    actor: Pick<AuditActor, 'ip' | 'userAgent' | 'requestId'>,
  ): Promise<LoginResult> {
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        fullName: true,
        passwordHash: true,
        status: true,
        companyId: true,
        mustChangePassword: true,
        failedLoginCount: true,
        lockedUntil: true,
        role: {
          select: {
            code: true,
            permissions: { select: { permission: { select: { code: true } } } },
          },
        },
        consultant: { select: { id: true } },
      },
    });

    // Mismo mensaje para usuario inexistente y contraseña incorrecta: distinguirlos
    // permitiría enumerar cuentas válidas.
    const invalid = new UnauthorizedError('Correo o contraseña incorrectos', 'INVALID_CREDENTIALS');

    if (!user) {
      // Se gasta tiempo igualmente para no filtrar por diferencia de latencia.
      await argon2.hash(password).catch(() => undefined);
      throw invalid;
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new UnauthorizedError(
        `Cuenta bloqueada temporalmente por intentos fallidos. Intente de nuevo después de ${user.lockedUntil.toLocaleTimeString('es-CO')}.`,
        'ACCOUNT_LOCKED',
      );
    }

    const valid = await argon2.verify(user.passwordHash, password).catch(() => false);

    if (!valid) {
      await this.registerFailedAttempt(user.id, user.failedLoginCount);
      throw invalid;
    }

    if (user.status !== UserStatus.ACTIVO) {
      throw new UnauthorizedError('La cuenta no está activa', 'ACCOUNT_INACTIVE');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() },
    });

    const authenticated: AuthenticatedUser = {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role.code,
      permissions: user.role.permissions.map((rp) => rp.permission.code),
      companyId: user.companyId,
      consultantId: user.consultant?.id ?? null,
    };

    const tokens = await this.issueTokens(authenticated, actor);

    await this.audit.recordStandalone(
      { id: user.id, role: user.role.code, ...actor },
      { action: 'AUTH_LOGIN', entity: 'User', entityId: user.id },
    );

    return {
      ...tokens,
      user: { ...authenticated, mustChangePassword: user.mustChangePassword },
    };
  }

  /**
   * Rotación de refresh token. El token presentado se revoca y se enlaza al
   * nuevo; si se presenta un token ya revocado, se revoca la cadena completa.
   */
  async refresh(
    refreshToken: string,
    actor: Pick<AuditActor, 'ip' | 'userAgent' | 'requestId'>,
  ): Promise<LoginResult> {
    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(refreshToken, {
        secret: this.config.get('jwt', { infer: true }).refreshSecret,
      });
    } catch {
      throw new UnauthorizedError('Refresh token inválido o expirado', 'INVALID_REFRESH_TOKEN');
    }

    if (payload.typ !== 'refresh') {
      throw new UnauthorizedError('El token proporcionado no es un refresh token', 'INVALID_REFRESH_TOKEN');
    }

    const tokenHash = hashToken(refreshToken);
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      select: { id: true, userId: true, revokedAt: true, expiresAt: true },
    });

    if (!stored) {
      throw new UnauthorizedError('Refresh token desconocido', 'INVALID_REFRESH_TOKEN');
    }

    if (stored.revokedAt) {
      // Reutilización de un token ya rotado: se asume compromiso.
      await this.revokeAllForUser(stored.userId);
      this.logger.warn(
        `Reutilización de refresh token para el usuario ${stored.userId}: se revocó toda la cadena`,
      );
      throw new UnauthorizedError(
        'Se detectó reutilización del refresh token; vuelva a iniciar sesión',
        'REFRESH_TOKEN_REUSED',
      );
    }

    if (stored.expiresAt < new Date()) {
      throw new UnauthorizedError('Refresh token expirado', 'REFRESH_TOKEN_EXPIRED');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: stored.userId },
      select: {
        id: true,
        email: true,
        fullName: true,
        status: true,
        companyId: true,
        mustChangePassword: true,
        role: {
          select: {
            code: true,
            permissions: { select: { permission: { select: { code: true } } } },
          },
        },
        consultant: { select: { id: true } },
      },
    });

    if (!user || user.status !== UserStatus.ACTIVO) {
      throw new UnauthorizedError('La cuenta no está activa', 'ACCOUNT_INACTIVE');
    }

    const authenticated: AuthenticatedUser = {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role.code,
      permissions: user.role.permissions.map((rp) => rp.permission.code),
      companyId: user.companyId,
      consultantId: user.consultant?.id ?? null,
    };

    const tokens = await this.issueTokens(authenticated, actor);

    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date(), replacedById: tokens.refreshTokenId },
    });

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: tokens.expiresIn,
      user: { ...authenticated, mustChangePassword: user.mustChangePassword },
    };
  }

  async logout(
    userId: string,
    refreshToken: string | undefined,
    actor: AuditActor,
  ): Promise<void> {
    if (refreshToken) {
      await this.prisma.refreshToken.updateMany({
        where: { tokenHash: hashToken(refreshToken), userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    } else {
      await this.revokeAllForUser(userId);
    }

    await this.audit.recordStandalone(actor, {
      action: 'AUTH_LOGOUT',
      entity: 'User',
      entityId: userId,
    });
  }

  async changePassword(
    user: AuthenticatedUser,
    currentPassword: string,
    newPassword: string,
    actor: AuditActor,
  ): Promise<void> {
    const record = await this.prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      select: { passwordHash: true },
    });

    const valid = await argon2.verify(record.passwordHash, currentPassword).catch(() => false);
    if (!valid) {
      throw new UnauthorizedError('La contraseña actual no es correcta', 'INVALID_CREDENTIALS');
    }
    if (currentPassword === newPassword) {
      throw new ValidationError('La nueva contraseña debe ser distinta de la actual');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await AuthService.hashPassword(newPassword),
        mustChangePassword: false,
      },
    });

    // Cambiar la contraseña invalida todas las sesiones abiertas.
    await this.revokeAllForUser(user.id);

    await this.audit.recordStandalone(actor, {
      action: 'AUTH_PASSWORD_CHANGED',
      entity: 'User',
      entityId: user.id,
    });
  }

  // ------------------------------------------------------------------ interno --

  private async issueTokens(
    user: AuthenticatedUser,
    actor: Pick<AuditActor, 'ip' | 'userAgent'>,
  ): Promise<{
    accessToken: string;
    refreshToken: string;
    refreshTokenId: string;
    expiresIn: number;
  }> {
    const jwtConfig = this.config.get('jwt', { infer: true });

    const basePayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      companyId: user.companyId,
      consultantId: user.consultantId,
    };

    const accessToken = await this.jwt.signAsync(
      { ...basePayload, typ: 'access' },
      {
        secret: jwtConfig.secret,
        expiresIn: jwtConfig.expiresIn as JwtSignOptions['expiresIn'],
      },
    );

    // `jti` aleatorio: dos refrescos en el mismo segundo producen tokens
    // distintos, y por tanto hashes distintos.
    const refreshToken = await this.jwt.signAsync(
      { ...basePayload, typ: 'refresh', jti: randomBytes(16).toString('hex') },
      {
        secret: jwtConfig.refreshSecret,
        expiresIn: jwtConfig.refreshExpiresIn as JwtSignOptions['expiresIn'],
      },
    );

    const decoded = this.jwt.decode(refreshToken) as { exp: number };

    const stored = await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(refreshToken),
        expiresAt: new Date(decoded.exp * 1000),
        userAgent: actor.userAgent?.slice(0, 400) ?? null,
        ip: actor.ip ?? null,
      },
      select: { id: true },
    });

    const accessDecoded = this.jwt.decode(accessToken) as { exp: number; iat: number };

    return {
      accessToken,
      refreshToken,
      refreshTokenId: stored.id,
      expiresIn: accessDecoded.exp - accessDecoded.iat,
    };
  }

  private async revokeAllForUser(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async registerFailedAttempt(userId: string, currentCount: number): Promise<void> {
    const failedLoginCount = currentCount + 1;
    const shouldLock = failedLoginCount >= MAX_FAILED_LOGINS;

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        failedLoginCount,
        lockedUntil: shouldLock ? new Date(Date.now() + LOCK_MINUTES * 60_000) : null,
      },
    });
  }
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
