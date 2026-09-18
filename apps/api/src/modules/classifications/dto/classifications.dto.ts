import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EligibilityResult } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

/** T2 — Evaluación, clasificación y habilitación del caso. */
export class ClassifyCaseDto {
  @ApiProperty({ description: 'LOV AREA_PROBLEMA', example: 'OPERACIONES' })
  @Transform(trim)
  @IsString()
  @MaxLength(60)
  areaCode!: string;

  @ApiPropertyOptional({ description: 'LOV SUBAREA' })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(60)
  subAreaCode?: string;

  @ApiProperty({ description: 'LOV TIPO_INTERVENCION', example: 'DIAGNOSTICO' })
  @Transform(trim)
  @IsString()
  @MaxLength(60)
  interventionTypeCode!: string;

  @ApiProperty({ description: 'LOV COMPLEJIDAD', example: 'MEDIO' })
  @Transform(trim)
  @IsString()
  @MaxLength(60)
  complexityCode!: string;

  @ApiProperty({ description: 'LOV IMPACTO', example: 'ALTO' })
  @Transform(trim)
  @IsString()
  @MaxLength(60)
  impactCode!: string;

  @ApiProperty({ description: 'LOV URGENCIA', example: 'ALTA' })
  @Transform(trim)
  @IsString()
  @MaxLength(60)
  urgencyCode!: string;

  @ApiProperty({ enum: EligibilityResult })
  @IsEnum(EligibilityResult)
  eligibility!: EligibilityResult;

  @ApiProperty({ minLength: 20, description: 'Observaciones de la revisión' })
  @Transform(trim)
  @IsString()
  @MinLength(20, { message: 'Registre observaciones de al menos 20 caracteres' })
  @MaxLength(4000)
  reviewNotes!: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 5, description: 'Claridad del problema planteado' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  clarityScore?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 5, description: 'Completitud de la información' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  completenessScore?: number;
}
