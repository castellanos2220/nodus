import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { Equals, IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { PaginationDto } from '../../../core/common/dto/pagination.dto';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

/** T3C — Postulación estructurada del consultor. */
export class ApplyDto {
  @ApiProperty({ minLength: 40, description: 'Manifestación de interés' })
  @Transform(trim)
  @IsString()
  @MinLength(40)
  @MaxLength(2000)
  interestStatement!: string;

  @ApiProperty({ description: 'Disponibilidad declarada' })
  @Transform(trim)
  @IsString()
  @MinLength(10)
  @MaxLength(500)
  availability!: string;

  @ApiProperty({ minLength: 40, description: 'Experiencia relevante para este caso' })
  @Transform(trim)
  @IsString()
  @MinLength(40)
  @MaxLength(3000)
  relevantExperience!: string;

  @ApiProperty({ minLength: 40, description: 'Justificación de pertinencia' })
  @Transform(trim)
  @IsString()
  @MinLength(40)
  @MaxLength(2000)
  fitJustification!: string;

  @ApiProperty({ minLength: 40, description: 'Enfoque preliminar del caso' })
  @Transform(trim)
  @IsString()
  @MinLength(40)
  @MaxLength(3000)
  preliminaryApproach!: string;

  @ApiProperty({ description: 'Aceptación de las condiciones metodológicas de la plataforma' })
  @IsBoolean()
  @Equals(true, { message: 'Debe aceptar las condiciones metodológicas de la plataforma' })
  acceptsConditions!: boolean;
}

export class OpportunityQueryDto extends PaginationDto {
  @ApiPropertyOptional()
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

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

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(60)
  interventionTypeCode?: string;
}
