import { Body, Controller, Get, Module, Param, ParseUUIDPipe, Patch, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { actorFrom } from '../../core/audit/audit.service';
import type { AuthenticatedUser } from '../../core/auth/auth.types';
import { CurrentUser, RequirePermissions } from '../../core/auth/decorators';
import { ApplicationsModule } from '../applications/applications.module';
import { ApplicationsService } from '../applications/applications.service';
import { OpportunityQueryDto } from '../applications/dto/applications.dto';
import { LookupsModule } from '../lookups/lookups.module';
import { ConsultantsService } from './consultants.service';
import {
  ChangeConsultantStatusDto,
  ClassifyConsultantDto,
  ConsultantListQueryDto,
  CreateConsultantDto,
} from './dto/consultants.dto';

@ApiTags('Consultores')
@ApiBearerAuth()
@Controller('consultants')
export class ConsultantsController {
  constructor(
    private readonly consultants: ConsultantsService,
    private readonly applications: ApplicationsService,
  ) {}

  @Get()
  @RequirePermissions('CONSULTANT_READ')
  @ApiOperation({ summary: 'Ecosistema de consultores' })
  findAll(@Query() query: ConsultantListQueryDto) {
    return this.consultants.findAll(query);
  }

  @Get('me')
  @RequirePermissions('CONSULTANT_SELF')
  @ApiOperation({ summary: 'Mi perfil de consultor' })
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.consultants.me(user);
  }

  @Get('sponsors')
  @RequirePermissions('CONSULTANT_READ')
  @ApiOperation({ summary: 'Empresas sponsor activas' })
  sponsors() {
    return this.consultants.listSponsors();
  }

  @Post()
  @RequirePermissions('CONSULTANT_MANAGE')
  @ApiOperation({
    summary: 'Registrar un consultor (TC1)',
    description:
      'Principio de consultor único: no se permite duplicar por documento de identidad. ' +
      'Queda en estado REGISTRADO, sin acceso a oportunidades hasta ser habilitado.',
  })
  create(
    @Body() dto: CreateConsultantDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.consultants.create(dto, actorFrom(user, request));
  }

  /**
   * Bolsa interna. Vive en este controlador y no en `applications` porque Nest
   * resuelve las rutas por orden de registro: `/consultants/opportunities`
   * declarada en otro controlador quedaría capturada por `/consultants/:id`.
   * Declararla aquí, antes de la ruta paramétrica, elimina esa dependencia de
   * orden entre módulos.
   */
  @Get('opportunities')
  @RequirePermissions('APPLICATION_CREATE')
  @ApiOperation({
    summary: 'Bolsa interna: oportunidades elegibles para el consultor autenticado',
    description:
      'La elegibilidad (estado del consultor, complejidad habilitada, especialidad, tipo de ' +
      'intervención y sector) se aplica en la consulta SQL. No es un filtro de presentación.',
  })
  opportunities(@CurrentUser() user: AuthenticatedUser, @Query() query: OpportunityQueryDto) {
    return this.applications.opportunities(user, query);
  }

  @Get('me/applications')
  @RequirePermissions('APPLICATION_CREATE')
  @ApiOperation({ summary: 'Mis postulaciones' })
  myApplications(@CurrentUser() user: AuthenticatedUser) {
    return this.applications.myApplications(user);
  }

  @Get(':id')
  @RequirePermissions('CONSULTANT_READ')
  @ApiOperation({ summary: 'Detalle del consultor con su historial de estados' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.consultants.findById(id);
  }

  @Get(':id/performance')
  @RequirePermissions('CONSULTANT_READ')
  @ApiOperation({
    summary: 'Historial de desempeño',
    description:
      'Evidencia acumulada que alimentará el futuro sistema de reputación. El MVP no ' +
      'calcula ni publica puntuaciones ni estrellas.',
  })
  performance(@Param('id', ParseUUIDPipe) id: string) {
    return this.consultants.performance(id);
  }

  @Patch(':id/classification')
  @RequirePermissions('CONSULTANT_MANAGE')
  @ApiOperation({
    summary: 'Clasificar y definir alcance (TC3)',
    description: 'Todos los códigos provienen de listas de valores gobernadas.',
  })
  classify(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ClassifyConsultantDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.consultants.classify(id, dto, actorFrom(user, request));
  }

  @Patch(':id/status')
  @RequirePermissions('CONSULTANT_MANAGE')
  @ApiOperation({
    summary: 'Cambiar el estado del consultor (TC2 / TC7)',
    description:
      'Valida la transición contra el ciclo de vida: no se puede habilitar sin haber ' +
      'validado ni clasificado.',
  })
  changeStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangeConsultantStatusDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.consultants.changeStatus(id, dto, actorFrom(user, request));
  }
}

@Module({
  imports: [LookupsModule, ApplicationsModule],
  controllers: [ConsultantsController],
  providers: [ConsultantsService],
  exports: [ConsultantsService],
})
export class ConsultantsModule {}
