import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { actorFrom } from '../../core/audit/audit.service';
import type { AuthenticatedUser } from '../../core/auth/auth.types';
import { CurrentUser, RequirePermissions } from '../../core/auth/decorators';
import { CompaniesService } from './companies.service';
import {
  CompanyListQueryDto,
  CreateCompanyContactDto,
  CreateCompanyDto,
  MatchCompanyDto,
} from './dto/companies.dto';

@ApiTags('Empresas')
@ApiBearerAuth()
@Controller('companies')
export class CompaniesController {
  constructor(private readonly companies: CompaniesService) {}

  @Get()
  @RequirePermissions('COMPANY_READ')
  @ApiOperation({ summary: 'Listado paginado de empresas' })
  findAll(@Query() query: CompanyListQueryDto) {
    return this.companies.findAll(query);
  }

  @Post('match')
  @RequirePermissions('COMPANY_READ')
  @ApiOperation({
    summary: 'Buscar coincidencias antes de crear (principio de empresa única)',
    description:
      'Compara por NIT, correo del contacto, dominio corporativo y similitud de nombre. ' +
      'Devuelve las candidatas y si la creación quedaría bloqueada.',
  })
  match(@Body() dto: MatchCompanyDto) {
    return this.companies.preview(dto);
  }

  @Post()
  @RequirePermissions('COMPANY_CREATE')
  @ApiOperation({ summary: 'Crear una empresa' })
  @ApiResponse({
    status: 409,
    description:
      'Existe una coincidencia exacta. La respuesta incluye las empresas candidatas; ' +
      'reintente con `linkToCompanyId` o, si procede, con `forceCreate` + `forceCreateReason`.',
  })
  create(
    @Body() dto: CreateCompanyDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.companies.create(dto, user, actorFrom(user, request));
  }

  @Get(':id')
  @RequirePermissions('COMPANY_READ')
  @ApiOperation({ summary: 'Detalle de una empresa con sus contactos' })
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    this.companies.assertCanRead(user, id);
    return this.companies.findById(id);
  }

  @Get(':id/cases')
  @RequirePermissions('COMPANY_READ')
  @ApiOperation({
    summary: 'Historial de casos de la empresa',
    description: 'Materializa el principio Empresa Única – Casos Múltiples.',
  })
  findCases(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    this.companies.assertCanRead(user, id);
    return this.companies.findCases(id);
  }

  @Post(':id/contacts')
  @RequirePermissions('COMPANY_UPDATE')
  @ApiOperation({ summary: 'Agregar un contacto a la empresa' })
  addContact(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateCompanyContactDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.companies.addContact(id, dto, actorFrom(user, request));
  }
}
