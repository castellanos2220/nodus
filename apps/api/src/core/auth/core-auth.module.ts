import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { CaseAccessService } from './case-access.service';
import { CaseAccessGuard } from './guards/case-access.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { PermissionsGuard } from './guards/permissions.guard';
import { JwtStrategy } from './strategies/jwt.strategy';

/**
 * Piezas de autenticación/autorización usadas por todos los módulos.
 * El módulo de negocio `modules/auth` (login, refresh, logout) depende de éste.
 */
@Global()
@Module({
  imports: [ConfigModule, PassportModule.register({ defaultStrategy: 'jwt' })],
  providers: [JwtStrategy, JwtAuthGuard, PermissionsGuard, CaseAccessGuard, CaseAccessService],
  exports: [
    PassportModule,
    JwtAuthGuard,
    PermissionsGuard,
    CaseAccessGuard,
    CaseAccessService,
  ],
})
export class CoreAuthModule {}
