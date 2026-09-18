import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { actorFrom } from '../../core/audit/audit.service';
import type { AuthenticatedUser } from '../../core/auth/auth.types';
import { CurrentUser, RequirePermissions } from '../../core/auth/decorators';
import { CaseAccess } from '../../core/auth/guards/case-access.guard';
import { ApplicationsService } from './applications.service';
import { ApplyDto } from './dto/applications.dto';

@ApiTags('Postulaciones')
@ApiBearerAuth()
@Controller()
export class ApplicationsController {
  constructor(private readonly applications: ApplicationsService) {}

  @Post('cases/:id/applications')
  @RequirePermissions('APPLICATION_CREATE')
  @ApiOperation({
    summary: 'Postularse a un caso (plantilla T3C)',
    description:
      'Revalida elegibilidad y plazo en backend, aunque la bolsa ya los aplique: el endpoint ' +
      'debe ser seguro incluso si se llama directamente.',
  })
  apply(
    @Param('id', ParseUUIDPipe) caseId: string,
    @Body() dto: ApplyDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.applications.apply(user, caseId, dto, actorFrom(user, request));
  }

  @Delete('cases/:id/applications/me')
  @RequirePermissions('APPLICATION_CREATE')
  @ApiOperation({ summary: 'Retirar mi postulación' })
  withdraw(
    @Param('id', ParseUUIDPipe) caseId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.applications.withdraw(user, caseId, actorFrom(user, request));
  }

  @Get('cases/:id/applications')
  @RequirePermissions('APPLICATION_READ')
  @CaseAccess('ANY')
  @ApiOperation({
    summary: 'Postulaciones del caso',
    description:
      'Advisory ve todas con perfil y evaluación; un consultor sólo ve la suya.',
  })
  findByCase(
    @Param('id', ParseUUIDPipe) caseId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.applications.findByCase(user, caseId);
  }
}
