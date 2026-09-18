import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ReviewOutcome, ReviewType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

/** TP4B — análisis estructurado del caso. */
export class ProposalAnalysisDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(4000) problemSynthesis?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(3000) workingHypothesis?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(3000) criticalFactors?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(3000) risks?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(3000) assumptions?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(3000) constraints?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(3000) additionalNeeds?: string;
}

/** TP4C — bloques A–J de la propuesta estructurada de solución. */
export class ProposalContentDto {
  @ApiPropertyOptional({ description: 'A. Resumen ejecutivo' })
  @IsOptional() @IsString() @MaxLength(4000) executiveSummary?: string;

  @ApiPropertyOptional({ description: 'B. Objetivo de la intervención' })
  @IsOptional() @IsString() @MaxLength(2000) objective?: string;

  @ApiPropertyOptional({ description: 'C. Alcance' })
  @IsOptional() @IsString() @MaxLength(4000) scope?: string;

  @ApiPropertyOptional({ description: 'D. Exclusiones' })
  @IsOptional() @IsString() @MaxLength(3000) exclusions?: string;

  @ApiPropertyOptional({ description: 'E. Actividades o componentes de trabajo' })
  @IsOptional() @IsString() @MaxLength(6000) activities?: string;

  @ApiPropertyOptional({ description: 'F. Entregables esperados' })
  @IsOptional() @IsString() @MaxLength(4000) deliverables?: string;

  @ApiPropertyOptional({ description: 'G. Cronograma preliminar' })
  @IsOptional() @IsString() @MaxLength(4000) schedule?: string;

  @ApiPropertyOptional({ description: 'H. Valoración inicial' })
  @IsOptional() @IsString() @MaxLength(3000) valuation?: string;

  @ApiPropertyOptional({ description: 'I. Condiciones y supuestos' })
  @IsOptional() @IsString() @MaxLength(3000) conditions?: string;

  @ApiPropertyOptional({ description: 'J. Nota del responsable principal' })
  @IsOptional() @IsString() @MaxLength(1000) leadConsultantNote?: string;
}

export class UpdateProposalVersionDto {
  @ApiPropertyOptional({ type: ProposalAnalysisDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => ProposalAnalysisDto)
  analysis?: ProposalAnalysisDto;

  @ApiPropertyOptional({ type: ProposalContentDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => ProposalContentDto)
  content?: ProposalContentDto;

  @ApiPropertyOptional({ description: 'Nota de cambio de esta edición' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  changeNote?: string;
}

/** TP4H — checklist de la revisión metodológica (el "Go"). */
export class ReviewChecklistDto {
  @ApiProperty({ description: 'La propuesta está completa' })
  @IsBoolean() completeness!: boolean;

  @ApiProperty({ description: 'Usa correctamente las plantillas oficiales' })
  @IsBoolean() templateUsage!: boolean;

  @ApiProperty({ description: 'Tiene trazabilidad documental' })
  @IsBoolean() traceability!: boolean;

  @ApiProperty({ description: 'Hay coherencia entre problema, alcance y entregables' })
  @IsBoolean() problemScopeCoherence!: boolean;

  @ApiProperty({ description: 'Es comprensible para una Mipyme' })
  @IsBoolean() clientReadability!: boolean;

  @ApiProperty({ description: 'Incluye cronograma y valoración mínimos' })
  @IsBoolean() scheduleAndValuation!: boolean;

  @ApiProperty({ description: 'No omite exclusiones, supuestos ni restricciones clave' })
  @IsBoolean() exclusionsAndAssumptions!: boolean;
}

export class CreateReviewDto {
  @ApiProperty({ enum: ReviewType, default: ReviewType.METODOLOGICA })
  @IsEnum(ReviewType)
  type: ReviewType = ReviewType.METODOLOGICA;

  @ApiProperty({ enum: ReviewOutcome })
  @IsEnum(ReviewOutcome)
  outcome!: ReviewOutcome;

  @ApiProperty({ type: ReviewChecklistDto })
  @IsObject()
  @ValidateNested()
  @Type(() => ReviewChecklistDto)
  checklist!: ReviewChecklistDto;

  @ApiPropertyOptional({ description: 'Observaciones; obligatorias si se solicitan ajustes' })
  @IsOptional()
  @IsString()
  @MaxLength(6000)
  observations?: string;
}
