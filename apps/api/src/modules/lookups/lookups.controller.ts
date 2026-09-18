import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsObject, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { Request } from 'express';
import { actorFrom } from '../../core/audit/audit.service';
import type { AuthenticatedUser } from '../../core/auth/auth.types';
import { CurrentUser, Public, RequirePermissions } from '../../core/auth/decorators';
import { LookupsService } from './lookups.service';

export class UpsertLookupValueDto {
  @ApiProperty({ example: 'TRANSFORMACION_DIGITAL' })
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  @Matches(/^[A-Z0-9_]+$/, { message: 'El código debe ser MAYÚSCULAS_CON_GUION_BAJO' })
  code!: string;

  @ApiProperty({ example: 'Transformación digital' })
  @IsString()
  @MinLength(2)
  @MaxLength(140)
  label!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(9999)
  sortOrder?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Metadatos libres, p. ej. { "rank": 3 }' })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

@ApiTags('Lookups (gobierno de LOV)')
@ApiBearerAuth()
@Controller('lookups')
export class LookupsController {
  constructor(private readonly lookups: LookupsService) {}

  @Get()
  @RequirePermissions('LOOKUP_READ')
  @ApiOperation({
    summary: 'Todas las listas de valores con sus opciones activas',
    description:
      'El frontend la consume una vez y alimenta con ella todos los selectores. ' +
      'Ningún campo de clasificación crítica acepta texto libre.',
  })
  @ApiQuery({ name: 'includeInactive', required: false, type: Boolean })
  findAll(@Query('includeInactive') includeInactive?: string) {
    return this.lookups.findAll(includeInactive === 'true');
  }

  /**
   * Listas mínimas del formulario público de onboarding (T1).
   *
   * El intake es público —la Mipyme entra abriendo un caso, no inscribiéndose—,
   * así que su formulario necesita poblar los tres selectores de clasificación
   * sin sesión. Se expone **sólo** ese subconjunto y sólo en lectura: el resto
   * del gobierno de LOV sigue exigiendo autenticación.
   */
  @Get('public/intake')
  @Public()
  @ApiOperation({ summary: 'Listas necesarias para el formulario público de intake' })
  async publicIntakeLists() {
    const [areas, urgencies, impacts] = await Promise.all([
      this.lookups.findByCode('AREA_PROBLEMA'),
      this.lookups.findByCode('URGENCIA'),
      this.lookups.findByCode('IMPACTO'),
    ]);
    return { AREA_PROBLEMA: areas, URGENCIA: urgencies, IMPACTO: impacts };
  }

  @Get(':listCode')
  @RequirePermissions('LOOKUP_READ')
  @ApiOperation({ summary: 'Valores de una lista concreta' })
  findOne(
    @Param('listCode') listCode: string,
    @Query('includeInactive') includeInactive?: string,
  ) {
    return this.lookups.findByCode(listCode.toUpperCase(), includeInactive === 'true');
  }

  @Post(':listCode/values')
  @RequirePermissions('LOOKUP_MANAGE')
  @ApiOperation({ summary: 'Crear o actualizar un valor de la lista' })
  upsert(
    @Param('listCode') listCode: string,
    @Body() dto: UpsertLookupValueDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.lookups.upsertValue(listCode.toUpperCase(), dto, actorFrom(user, request));
  }

  @Delete(':listCode/values/:code')
  @RequirePermissions('LOOKUP_MANAGE')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Desactivar un valor',
    description:
      'No se elimina: hay casos históricos clasificados con él y perder la etiqueta ' +
      'rompería la trazabilidad y la analítica.',
  })
  async deactivate(
    @Param('listCode') listCode: string,
    @Param('code') code: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ): Promise<void> {
    await this.lookups.deactivateValue(
      listCode.toUpperCase(),
      code.toUpperCase(),
      actorFrom(user, request),
    );
  }
}
