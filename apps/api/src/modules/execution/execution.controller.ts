import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { actorFrom } from '../../core/audit/audit.service';
import type { AuthenticatedUser } from '../../core/auth/auth.types';
import { CurrentUser, RequirePermissions } from '../../core/auth/decorators';
import { CaseAccess } from '../../core/auth/guards/case-access.guard';
import { ClosureService } from './closure.service';
import {
  AddDeliverableVersionDto,
  ConsultantEvaluationDto,
  CreateActivityDto,
  CreateDeliverableDto,
  CreateIncidentDto,
  CreateMeetingDto,
  CreateMilestoneDto,
  CustomerClosureResponseDto,
  CustomerEvaluationDto,
  UpdateActivityDto,
  UpdateClosureChecklistItemDto,
  UpdateDeliverableDto,
  UpdateIncidentDto,
  UpdateMilestoneDto,
} from './dto/execution.dto';
import { ExecutionService } from './execution.service';

@ApiTags('Ejecución')
@ApiBearerAuth()
@Controller('cases/:id')
export class ExecutionController {
  constructor(
    private readonly execution: ExecutionService,
    private readonly closure: ClosureService,
  ) {}

  // ------------------------------------------------------------------ Resumen
  @Get('execution-summary')
  @RequirePermissions('CASE_READ')
  @CaseAccess('ANY')
  @ApiOperation({
    summary: 'Estado agregado de la ejecución y bloqueos para el cierre técnico',
    description:
      'Los "subestados" del Punto 8 como atributos calculados, en lugar de fragmentar el ' +
      'estado global del caso.',
  })
  summary(@Param('id', ParseUUIDPipe) caseId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.execution.summary(user, caseId);
  }

  // --------------------------------------------------------------- Actividades
  @Get('activities')
  @RequirePermissions('CASE_READ')
  @CaseAccess('ANY')
  @ApiOperation({ summary: 'Actividades del caso (T8B)' })
  listActivities(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.execution.listActivities(user, id);
  }

  @Post('activities')
  @RequirePermissions('CASE_EXECUTE')
  @CaseAccess('FULL')
  @ApiOperation({ summary: 'Registrar una actividad' })
  createActivity(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateActivityDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.execution.createActivity(user, id, dto, actorFrom(user, req));
  }

  @Patch('activities/:activityId')
  @RequirePermissions('CASE_EXECUTE')
  @CaseAccess('FULL')
  @ApiOperation({ summary: 'Actualizar una actividad' })
  updateActivity(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('activityId', ParseUUIDPipe) activityId: string,
    @Body() dto: UpdateActivityDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.execution.updateActivity(user, id, activityId, dto, actorFrom(user, req));
  }

  // --------------------------------------------------------------------- Hitos
  @Get('milestones')
  @RequirePermissions('CASE_READ')
  @CaseAccess('ANY')
  @ApiOperation({ summary: 'Hitos del caso (T8C)' })
  listMilestones(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.execution.listMilestones(user, id);
  }

  @Post('milestones')
  @RequirePermissions('CASE_EXECUTE')
  @CaseAccess('FULL')
  @ApiOperation({ summary: 'Registrar un hito' })
  createMilestone(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateMilestoneDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.execution.createMilestone(user, id, dto, actorFrom(user, req));
  }

  @Patch('milestones/:milestoneId')
  @RequirePermissions('CASE_EXECUTE')
  @CaseAccess('FULL')
  @ApiOperation({
    summary: 'Actualizar un hito',
    description: 'Justificar o reprogramar exige una explicación registrada.',
  })
  updateMilestone(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('milestoneId', ParseUUIDPipe) milestoneId: string,
    @Body() dto: UpdateMilestoneDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.execution.updateMilestone(user, id, milestoneId, dto, actorFrom(user, req));
  }

  // --------------------------------------------------------------- Incidencias
  @Get('incidents')
  @RequirePermissions('CASE_READ')
  @CaseAccess('ANY')
  @ApiOperation({ summary: 'Incidencias del caso (T8D)' })
  listIncidents(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.execution.listIncidents(user, id);
  }

  @Post('incidents')
  @RequirePermissions('CASE_READ')
  @CaseAccess('FULL')
  @ApiOperation({ summary: 'Abrir una incidencia' })
  createIncident(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateIncidentDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.execution.createIncident(user, id, dto, actorFrom(user, req));
  }

  @Patch('incidents/:incidentId')
  @RequirePermissions('CASE_READ')
  @CaseAccess('FULL')
  @ApiOperation({
    summary: 'Actualizar una incidencia',
    description: 'Resolver o cerrar exige registrar la decisión tomada.',
  })
  updateIncident(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('incidentId', ParseUUIDPipe) incidentId: string,
    @Body() dto: UpdateIncidentDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.execution.updateIncident(user, id, incidentId, dto, actorFrom(user, req));
  }

  // --------------------------------------------------------------- Entregables
  @Get('deliverables')
  @RequirePermissions('CASE_READ')
  @CaseAccess('ANY')
  @ApiOperation({ summary: 'Entregables con todo su historial de versiones (T8G)' })
  listDeliverables(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.execution.listDeliverables(user, id);
  }

  @Post('deliverables')
  @RequirePermissions('CASE_EXECUTE')
  @CaseAccess('FULL')
  @ApiOperation({ summary: 'Registrar un entregable comprometido' })
  createDeliverable(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateDeliverableDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.execution.createDeliverable(user, id, dto, actorFrom(user, req));
  }

  @Patch('deliverables/:deliverableId')
  @RequirePermissions('CASE_READ')
  @CaseAccess('FULL')
  @ApiOperation({
    summary: 'Actualizar el estado de un entregable',
    description: 'No puede declararse cargado ni listo sin al menos una versión.',
  })
  updateDeliverable(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('deliverableId', ParseUUIDPipe) deliverableId: string,
    @Body() dto: UpdateDeliverableDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.execution.updateDeliverable(user, id, deliverableId, dto, actorFrom(user, req));
  }

  @Post('deliverables/:deliverableId/versions')
  @RequirePermissions('CASE_EXECUTE')
  @CaseAccess('FULL')
  @ApiOperation({
    summary: 'Cargar una versión nueva del entregable',
    description: 'Versionamiento obligatorio: nunca se sustituye la versión anterior.',
  })
  addDeliverableVersion(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('deliverableId', ParseUUIDPipe) deliverableId: string,
    @Body() dto: AddDeliverableVersionDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.execution.addDeliverableVersion(user, id, deliverableId, dto, actorFrom(user, req));
  }

  // ------------------------------------------------------------------ Reuniones
  @Get('meetings')
  @RequirePermissions('CASE_READ')
  @CaseAccess('ANY')
  @ApiOperation({ summary: 'Reuniones registradas (T8E / T9E)' })
  listMeetings(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.execution.listMeetings(user, id);
  }

  @Post('meetings')
  @RequirePermissions('CASE_READ')
  @CaseAccess('FULL')
  @ApiOperation({ summary: 'Registrar una reunión del caso' })
  createMeeting(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateMeetingDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.execution.createMeeting(user, id, dto, actorFrom(user, req));
  }

  // --------------------------------------------------------------------- Cierre
  @Get('closure')
  @RequirePermissions('CASE_READ')
  @CaseAccess('ANY')
  @ApiOperation({ summary: 'Estado del cierre: qué hay registrado y qué falta' })
  closureSummary(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.closure.summary(user, id);
  }

  @Get('closure/declaration')
  @RequirePermissions('CASE_READ')
  @CaseAccess('ANY')
  @ApiOperation({ summary: 'Declaración de cierre técnico (T9A)' })
  declaration(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.closure.getDeclaration(user, id);
  }

  @Get('closure/checklist')
  @RequirePermissions('CASE_READ')
  @CaseAccess('ANY')
  @ApiOperation({ summary: 'Checklist de revisión final (T9C)' })
  closureChecklist(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.closure.getChecklist(user, id);
  }

  @Patch('closure/checklist/items/:itemId')
  @RequirePermissions('CASE_CLOSE')
  @CaseAccess('FULL')
  @ApiOperation({ summary: 'Actualizar un ítem de la revisión final' })
  updateClosureItem(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() dto: UpdateClosureChecklistItemDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.closure.updateChecklistItem(user, id, itemId, dto, actorFrom(user, req));
  }

  @Put('closure/client-response')
  @RequirePermissions('CASE_DECIDE')
  @CaseAccess('FULL')
  @ApiOperation({ summary: 'Aceptación u observaciones de cierre del cliente (T9F)' })
  clientResponse(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CustomerClosureResponseDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.closure.registerClientResponse(user, id, dto, actorFrom(user, req));
  }

  @Put('closure/customer-evaluation')
  @RequirePermissions('CASE_DECIDE')
  @CaseAccess('FULL')
  @ApiOperation({ summary: 'Encuesta de satisfacción del cliente (T9G)' })
  customerEvaluation(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CustomerEvaluationDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.closure.registerCustomerEvaluation(user, id, dto, actorFrom(user, req));
  }

  @Put('closure/consultant-evaluation')
  @RequirePermissions('CASE_CLOSE')
  @CaseAccess('FULL')
  @ApiOperation({
    summary: 'Evaluación de desempeño del consultor (T9H)',
    description:
      'Base de datos del futuro sistema de reputación: se captura el desempeño real, no se ' +
      'calcula ni se expone puntuación pública en el MVP.',
  })
  consultantEvaluation(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ConsultantEvaluationDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.closure.registerConsultantEvaluation(user, id, dto, actorFrom(user, req));
  }
}
