import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  Equals,
  IsBoolean,
  IsDate,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { CaseStatusCode } from '@prisma/client';
import { PaginationDto } from '../../../core/common/dto/pagination.dto';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;
const lower = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

/**
 * T1 — Registro de caso. Bloque 1 (identificación) + Bloque 2 (necesidad).
 *
 * Diseñado para diligenciarse en menos de tres minutos (RF-001): sólo lo
 * imprescindible para identificar a la empresa y describir la necesidad.
 */
export class IntakeDto {
  // ------------------------------------------- Bloque 1: identificación básica
  @ApiProperty({ example: 'Aceros del Norte S.A.S.' })
  @Transform(trim)
  @IsString()
  @MinLength(3)
  @MaxLength(180)
  companyName!: string;

  @ApiPropertyOptional({ example: '900123456-7' })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(40)
  taxId?: string;

  @ApiProperty({ example: 'María Restrepo' })
  @Transform(trim)
  @IsString()
  @MinLength(3)
  @MaxLength(140)
  contactFullName!: string;

  @ApiProperty({ example: 'Gerente de Operaciones' })
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  contactJobTitle!: string;

  @ApiProperty({ example: 'maria.restrepo@acerosdelnorte.com' })
  @Transform(lower)
  @IsEmail({}, { message: 'El correo electrónico no es válido' })
  @MaxLength(180)
  contactEmail!: string;

  @ApiProperty({ example: '+57 320 123 4567' })
  @Transform(trim)
  @IsString()
  @MinLength(7)
  @MaxLength(40)
  contactPhone!: string;

  @ApiProperty({ example: 'Colombia' })
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  country!: string;

  @ApiProperty({ example: 'Bogotá' })
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  city!: string;

  @ApiProperty({
    description: 'Aceptación de términos de uso y política de tratamiento de datos',
  })
  @IsBoolean()
  @Equals(true, {
    message: 'Debe aceptar los términos y la política de tratamiento de datos',
  })
  acceptedTerms!: boolean;

  // ----------------------------------- Bloque 2: necesidad empresarial (T1)
  @ApiProperty({ example: 'Alta rotación de inventario sin trazabilidad' })
  @Transform(trim)
  @IsString()
  @MinLength(10, { message: 'El título debe tener al menos 10 caracteres' })
  @MaxLength(180)
  title!: string;

  @ApiProperty({ minLength: 40 })
  @Transform(trim)
  @IsString()
  @MinLength(40, { message: 'Describa la necesidad con al menos 40 caracteres' })
  @MaxLength(5000)
  description!: string;

  @ApiProperty({ description: 'Código de la LOV AREA_PROBLEMA', example: 'OPERACIONES' })
  @Transform(trim)
  @IsString()
  @MaxLength(60)
  areaCode!: string;

  @ApiProperty({ description: 'Código de la LOV URGENCIA', example: 'ALTA' })
  @Transform(trim)
  @IsString()
  @MaxLength(60)
  urgencyCode!: string;

  @ApiProperty({ description: 'Código de la LOV IMPACTO', example: 'ALTO' })
  @Transform(trim)
  @IsString()
  @MaxLength(60)
  impactCode!: string;

  @ApiPropertyOptional({
    description: 'Vincular a una empresa existente detectada por el matching',
  })
  @IsOptional()
  @IsUUID()
  linkToCompanyId?: string;
}

/** Alta de un caso adicional para una empresa ya existente. */
export class CreateCaseDto {
  @ApiPropertyOptional({
    description: 'Empresa. Si el usuario es CLIENTE_MIPYME se ignora y se usa la suya.',
  })
  @IsOptional()
  @IsUUID()
  companyId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  contactId?: string;

  @ApiProperty()
  @Transform(trim)
  @IsString()
  @MinLength(10)
  @MaxLength(180)
  title!: string;

  @ApiProperty()
  @Transform(trim)
  @IsString()
  @MinLength(40)
  @MaxLength(5000)
  description!: string;

  @ApiProperty({ example: 'TECNOLOGIA' })
  @Transform(trim)
  @IsString()
  @MaxLength(60)
  areaCode!: string;

  @ApiProperty({ example: 'MEDIA' })
  @Transform(trim)
  @IsString()
  @MaxLength(60)
  urgencyCode!: string;

  @ApiProperty({ example: 'ALTO' })
  @Transform(trim)
  @IsString()
  @MaxLength(60)
  impactCode!: string;
}

/** Edición del caso. Sólo permitida mientras el estado sea CREADO (RF-013). */
export class UpdateCaseDto {
  @ApiPropertyOptional()
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MinLength(10)
  @MaxLength(180)
  title?: string;

  @ApiPropertyOptional()
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MinLength(40)
  @MaxLength(5000)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(60)
  areaCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(60)
  urgencyCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(60)
  impactCode?: string;
}

export class CaseListQueryDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Busca por título o código de caso' })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @ApiPropertyOptional({ enum: CaseStatusCode })
  @IsOptional()
  @IsEnum(CaseStatusCode)
  status?: CaseStatusCode;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  companyId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(60)
  areaCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(60)
  complexityCode?: string;

  @ApiPropertyOptional({ description: 'Filtra por riesgo de SLA', enum: ['ON_TRACK', 'AT_RISK', 'OVERDUE'] })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  slaStatus?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  consultantId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  createdFrom?: Date;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  createdTo?: Date;
}
