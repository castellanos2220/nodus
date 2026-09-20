import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { RatePolicy, RateLimitPolicy } from '../../core/rate-limit';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { actorFrom, SYSTEM_ACTOR } from '../../core/audit/audit.service';
import type { AuthenticatedUser } from '../../core/auth/auth.types';
import { CurrentUser, Public, RequirePermissions } from '../../core/auth/decorators';
import { CaseAccess } from '../../core/auth/guards/case-access.guard';
import { CasesService } from './cases.service';
import { CaseListQueryDto, CreateCaseDto, IntakeDto, UpdateCaseDto } from './dto/cases.dto';

@ApiTags('Casos')
@Controller()
export class CasesController {
  constructor(private readonly cases: CasesService) {}

  /**
   * T1 — onboarding y apertura del caso.
   *
   * Es público porque el modelo operativo es explícito: la Mipyme no se inscribe
   * primero y abre un caso después; **entra abriendo un caso**. Al ser público
   * lleva un límite de tasa estricto, que es la contrapartida razonable.
   */
  @Post('intake')
  @Public()
  // Crea empresa, usuario y caso sin sesión: el cupo público más estricto.
  @RatePolicy(RateLimitPolicy.PUBLIC)
  @Throttle({ public: { limit: 5, ttl: 600_000 } })
  @ApiOperation({
    summary: 'Onboarding T1: crear empresa (si no existe), contacto, usuario y caso',
    description:
      'Flujo de dos bloques del Punto 1. Aplica el principio Empresa Única: si hay una ' +
      'coincidencia exacta por NIT o correo, el caso se vincula a la empresa existente en ' +
      'lugar de duplicarla. Todo ocurre en una sola transacción.',
  })
  @ApiResponse({ status: 201, description: 'Caso creado en estado CREADO' })
  @ApiResponse({ status: 400, description: 'Clasificación fuera de las listas de valores' })
  intake(@Body() dto: IntakeDto, @Req() request: Request) {
    return this.cases.intake(dto, {
      ...SYSTEM_ACTOR,
      ip: request.ip ?? null,
      userAgent: request.headers['user-agent'] ?? null,
      requestId: (request.headers['x-request-id'] as string) ?? null,
    });
  }

  @Get('cases')
  @ApiBearerAuth()
  @RequirePermissions('CASE_READ')
  @ApiOperation({
    summary: 'Listado de casos',
    description:
      'El alcance depende del rol: el cliente ve los de su empresa; el consultor, los suyos; ' +
      'advisory, todos. Se resuelve en backend, no ocultando filas en el frontend.',
  })
  findAll(@CurrentUser() user: AuthenticatedUser, @Query() query: CaseListQueryDto) {
    return this.cases.findAll(user, query);
  }

  @Post('cases')
  @ApiBearerAuth()
  @RequirePermissions('CASE_CREATE')
  @ApiOperation({ summary: 'Crear un caso adicional para una empresa existente' })
  create(
    @Body() dto: CreateCaseDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.cases.create(dto, user, actorFrom(user, request));
  }

  @Get('cases/:id')
  @ApiBearerAuth()
  @RequirePermissions('CASE_READ')
  @CaseAccess('ANY')
  @ApiOperation({
    summary: 'Detalle del caso',
    description:
      'Incluye `availableTransitions` calculadas por el backend para este usuario. ' +
      'Un consultor postulante recibe la versión controlada, sin datos sensibles del cliente.',
  })
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.cases.findById(user, id);
  }

  @Patch('cases/:id')
  @ApiBearerAuth()
  @RequirePermissions('CASE_UPDATE')
  @CaseAccess('FULL')
  @ApiOperation({
    summary: 'Editar el caso',
    description: 'Sólo permitido mientras el estado sea CREADO (RF-013).',
  })
  @ApiResponse({ status: 409, description: 'El caso ya no es editable' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCaseDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.cases.update(user, id, dto, actorFrom(user, request));
  }

  @Get('cases/:id/timeline')
  @ApiBearerAuth()
  @RequirePermissions('CASE_READ')
  @CaseAccess('ANY')
  @ApiOperation({
    summary: 'Línea de tiempo del caso',
    description: 'Alimentada por la bitácora de auditoría: es la misma verdad, no una copia.',
  })
  timeline(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.cases.timeline(user, id);
  }

  @Get('cases/:id/status-history')
  @ApiBearerAuth()
  @RequirePermissions('CASE_READ')
  @CaseAccess('ANY')
  @ApiOperation({ summary: 'Historial de estados con tiempo permanecido en cada uno' })
  statusHistory(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.cases.statusHistory(user, id);
  }
}
