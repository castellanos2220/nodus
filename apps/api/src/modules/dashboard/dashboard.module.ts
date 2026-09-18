import { Controller, Get, Module } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedUser } from '../../core/auth/auth.types';
import { CurrentUser, RequirePermissions } from '../../core/auth/decorators';
import { DashboardService } from './dashboard.service';

@ApiTags('Dashboard')
@ApiBearerAuth()
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get('kpis')
  @RequirePermissions('DASHBOARD_READ')
  @ApiOperation({
    summary: 'Indicadores del tablero PMO',
    description:
      'Todos los indicadores se calculan con agregados SQL sobre índices; nunca se cargan ' +
      'filas en memoria para contarlas. El alcance depende del rol.',
  })
  kpis(@CurrentUser() user: AuthenticatedUser) {
    return this.dashboard.kpis(user);
  }

  @Get('attention')
  @RequirePermissions('DASHBOARD_READ')
  @ApiOperation({ summary: 'Casos que requieren atención: SLA vencido, estancados, en decisión' })
  attention(@CurrentUser() user: AuthenticatedUser) {
    return this.dashboard.attentionQueue(user);
  }
}

@Module({
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
