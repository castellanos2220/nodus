import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { RatePolicy, RateLimitPolicy } from '../../core/rate-limit';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { actorFrom } from '../../core/audit/audit.service';
import type { AuthenticatedUser } from '../../core/auth/auth.types';
import { CurrentUser, Public } from '../../core/auth/decorators';
import { AuthService } from './auth.service';
import { ChangePasswordDto, LoginDto, RefreshDto } from './dto/auth.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  /**
   * Rate limit específico y más estricto que el global: el login es el endpoint
   * que un atacante martillea. 10 intentos por 5 minutos y dirección IP.
   */
  @Post('login')
  @Public()
  @HttpCode(HttpStatus.OK)
  @RatePolicy(RateLimitPolicy.AUTH)
  @ApiOperation({ summary: 'Iniciar sesión' })
  @ApiResponse({ status: 200, description: 'Tokens emitidos' })
  @ApiResponse({ status: 401, description: 'Credenciales inválidas o cuenta bloqueada' })
  @ApiResponse({ status: 429, description: 'Demasiados intentos' })
  login(@Body() dto: LoginDto, @Req() request: Request) {
    return this.auth.login(dto.email, dto.password, {
      ip: request.ip ?? null,
      userAgent: request.headers['user-agent'] ?? null,
      requestId: (request.headers['x-request-id'] as string) ?? null,
    });
  }

  @Post('refresh')
  @Public()
  @HttpCode(HttpStatus.OK)
  // El proxy rota el token de forma transparente: más margen que el login.
  @RatePolicy(RateLimitPolicy.AUTH)
  @Throttle({ auth: { limit: 60, ttl: 300_000 } })
  @ApiOperation({
    summary: 'Renovar el access token',
    description:
      'Rotación con detección de reutilización: el refresh token usado queda revocado. ' +
      'Presentar uno ya rotado revoca toda la cadena de sesiones del usuario.',
  })
  refresh(@Body() dto: RefreshDto, @Req() request: Request) {
    return this.auth.refresh(dto.refreshToken, {
      ip: request.ip ?? null,
      userAgent: request.headers['user-agent'] ?? null,
      requestId: (request.headers['x-request-id'] as string) ?? null,
    });
  }

  @Post('logout')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Cerrar sesión',
    description: 'Sin `refreshToken` en el cuerpo, cierra todas las sesiones del usuario.',
  })
  async logout(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: Partial<RefreshDto>,
    @Req() request: Request,
  ): Promise<void> {
    await this.auth.logout(user.id, body?.refreshToken, actorFrom(user, request));
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Usuario autenticado, con su rol y permisos efectivos' })
  me(@CurrentUser() user: AuthenticatedUser) {
    return user;
  }

  @Post('change-password')
  @RatePolicy(RateLimitPolicy.AUTH)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Cambiar la contraseña propia',
    description: 'Invalida todas las sesiones abiertas del usuario.',
  })
  async changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChangePasswordDto,
    @Req() request: Request,
  ): Promise<void> {
    await this.auth.changePassword(
      user,
      dto.currentPassword,
      dto.newPassword,
      actorFrom(user, request),
    );
  }
}
