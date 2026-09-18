import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { actorFrom } from '../../core/audit/audit.service';
import type { AuthenticatedUser } from '../../core/auth/auth.types';
import { CurrentUser, RequirePermissions } from '../../core/auth/decorators';
import { CaseAccess } from '../../core/auth/guards/case-access.guard';
import { ExecuteTransitionDto } from './dto/execute-transition.dto';
import { TRANSITIONS } from './transitions/transitions.registry';
import { WorkflowService } from './workflow.service';

/**
 * El estado de un caso **sólo** cambia por aquí.
 *
 * No existe `PATCH /cases/:id { status }` ni nada equivalente: el brief lo
 * prohíbe expresamente (§12) y el diseño lo hace imposible, porque ningún otro
 * servicio del sistema escribe `case.status`.
 */
@ApiTags('Workflow')
@ApiBearerAuth()
@Controller('cases/:id')
export class WorkflowController {
  constructor(private readonly workflow: WorkflowService) {}

  @Post('transitions')
  @RequirePermissions('CASE_READ')
  @CaseAccess('FULL')
  @ApiOperation({
    summary: 'Ejecutar una transición de estado del caso',
    description:
      'Valida estado actual, rol, ámbito sobre el recurso y reglas de negocio. ' +
      'Persiste el estado, escribe historial y bitácora, actualiza los relojes de SLA ' +
      'y emite el evento de dominio — todo de forma atómica.',
  })
  @ApiParam({ name: 'id', description: 'ID del caso' })
  @ApiResponse({ status: 201, description: 'Transición aplicada' })
  @ApiResponse({ status: 403, description: 'El actor no puede ejecutar esta transición' })
  @ApiResponse({
    status: 409,
    description: 'La transición no existe desde el estado actual, o un guard la bloquea',
  })
  async execute(
    @Param('id', ParseUUIDPipe) caseId: string,
    @Body() dto: ExecuteTransitionDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.workflow.execute(user, caseId, dto, actorFrom(user, request));
  }

  @Get('transitions')
  @RequirePermissions('CASE_READ')
  @CaseAccess('ANY')
  @ApiOperation({
    summary: 'Transiciones disponibles para el usuario actual',
    description:
      'Para cada transición posible desde el estado actual: si el usuario puede ejecutarla ' +
      'ahora y, si no, qué guard la bloquea y por qué. El frontend pinta botones con esto; ' +
      'no reimplementa ninguna regla.',
  })
  async available(
    @Param('id', ParseUUIDPipe) caseId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.workflow.availableTransitions(user, caseId);
  }
}

/** Catálogo de la máquina de estados: documentación viva para QA y evaluación. */
@ApiTags('Workflow')
@ApiBearerAuth()
@Controller('workflow')
export class WorkflowCatalogController {
  @Get('transitions')
  @ApiOperation({ summary: 'Catálogo completo de transiciones declaradas' })
  catalog() {
    return TRANSITIONS.map((transition) => ({
      code: transition.code,
      label: transition.label,
      from: transition.from,
      to: transition.to,
      roles: transition.roles,
      scope: transition.scope,
      guards: transition.guards,
      event: transition.event,
      autoNext: transition.autoNext ?? null,
      requiresPayload: transition.requiresPayload,
      description: transition.description,
    }));
  }
}
