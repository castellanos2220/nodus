import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { actorFrom } from '../../core/audit/audit.service';
import type { AuthenticatedUser } from '../../core/auth/auth.types';
import { CurrentUser, RequirePermissions } from '../../core/auth/decorators';
import { CaseAccess } from '../../core/auth/guards/case-access.guard';
import { ClassificationsService } from './classifications.service';
import { ClassifyCaseDto } from './dto/classifications.dto';

@ApiTags('Casos')
@ApiBearerAuth()
@Controller('cases/:id/classification')
export class ClassificationsController {
  constructor(private readonly classifications: ClassificationsService) {}

  @Post()
  @RequirePermissions('CASE_CLASSIFY')
  @CaseAccess('FULL')
  @ApiOperation({
    summary: 'Registrar la clasificación T2 del caso',
    description:
      'Crea una clasificación nueva y archiva la anterior (nunca se sobrescribe). ' +
      'Todos los códigos deben pertenecer a listas de valores gobernadas. ' +
      'Registrar la clasificación no cambia el estado: eso lo hace la transición CLASSIFY.',
  })
  classify(
    @Param('id', ParseUUIDPipe) caseId: string,
    @Body() dto: ClassifyCaseDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.classifications.classify(user, caseId, dto, actorFrom(user, request));
  }

  @Get('history')
  @RequirePermissions('CASE_READ')
  @CaseAccess('FULL')
  @ApiOperation({ summary: 'Historial de clasificaciones y reclasificaciones' })
  history(@Param('id', ParseUUIDPipe) caseId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.classifications.history(user, caseId);
  }

  @Get('eligibility')
  @RequirePermissions('CASE_READ')
  @CaseAccess('FULL')
  @ApiOperation({ summary: 'Resumen de elegibilidad: qué falta para poder habilitar el caso' })
  eligibility(@Param('id', ParseUUIDPipe) caseId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.classifications.eligibilitySummary(user, caseId);
  }
}
