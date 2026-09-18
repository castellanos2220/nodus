import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Put, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ChecklistKind } from '@prisma/client';
import type { Request } from 'express';
import { actorFrom } from '../../core/audit/audit.service';
import type { AuthenticatedUser } from '../../core/auth/auth.types';
import { CurrentUser, RequirePermissions } from '../../core/auth/decorators';
import { CaseAccess } from '../../core/auth/guards/case-access.guard';
import { ContractsService } from './contracts.service';
import {
  CreateContractEvidenceDto,
  UpdateChecklistItemDto,
  UpsertOperationalFrameworkDto,
} from './dto/contracts.dto';

@ApiTags('Contratación')
@ApiBearerAuth()
@Controller()
export class ContractsController {
  constructor(private readonly contracts: ContractsService) {}

  @Get('cases/:id/contract/checklist')
  @RequirePermissions('CASE_READ')
  @CaseAccess('ANY')
  @ApiOperation({
    summary: 'Checklist de contratación T7A con su progreso',
    description:
      'NODUS no es parte contractual: verifica el cumplimiento del proceso, no el contenido legal.',
  })
  getChecklist(@Param('id', ParseUUIDPipe) caseId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.contracts.getChecklist(user, caseId);
  }

  @Patch('cases/:id/contract/checklist/items/:itemId')
  @RequirePermissions('CONTRACT_MANAGE')
  @CaseAccess('FULL')
  @ApiOperation({
    summary: 'Actualizar un ítem del checklist',
    description: 'Un ítem que exige evidencia no puede marcarse cumplido sin ella.',
  })
  updateItem(
    @Param('id', ParseUUIDPipe) caseId: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() dto: UpdateChecklistItemDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.contracts.updateItem(user, caseId, itemId, dto, actorFrom(user, request));
  }

  @Post('cases/:id/contract/evidences')
  @RequirePermissions('CONTRACT_MANAGE')
  @CaseAccess('FULL')
  @ApiOperation({ summary: 'Registrar evidencia contractual (T7C)' })
  addEvidence(
    @Param('id', ParseUUIDPipe) caseId: string,
    @Body() dto: CreateContractEvidenceDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.contracts.addEvidence(user, caseId, dto, actorFrom(user, request));
  }

  @Get('cases/:id/contract/evidences')
  @RequirePermissions('CASE_READ')
  @CaseAccess('ANY')
  @ApiOperation({ summary: 'Evidencias contractuales registradas' })
  listEvidences(
    @Param('id', ParseUUIDPipe) caseId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.contracts.listEvidences(user, caseId);
  }

  @Put('cases/:id/contract/operational-framework')
  @RequirePermissions('CASE_EXECUTE')
  @CaseAccess('FULL')
  @ApiOperation({
    summary: 'Cargar o actualizar el marco operativo del servicio (T7B)',
    description:
      'Lo carga el consultor responsable. Es requisito para autorizar la ejecución y la base ' +
      'sobre la que se hace el seguimiento.',
  })
  upsertFramework(
    @Param('id', ParseUUIDPipe) caseId: string,
    @Body() dto: UpsertOperationalFrameworkDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.contracts.upsertOperationalFramework(user, caseId, dto, actorFrom(user, request));
  }

  @Get('cases/:id/contract/operational-framework')
  @RequirePermissions('CASE_READ')
  @CaseAccess('ANY')
  @ApiOperation({ summary: 'Marco operativo del servicio' })
  getFramework(@Param('id', ParseUUIDPipe) caseId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.contracts.getOperationalFramework(user, caseId);
  }

  @Get('checklist-templates')
  @RequirePermissions('CONTRACT_MANAGE')
  @ApiOperation({ summary: 'Plantillas de checklist configuradas (T7A y T9C)' })
  listTemplates(@Query('kind') kind?: ChecklistKind) {
    return this.contracts.listTemplates(kind);
  }
}
