import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ChecklistItemStatus } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  IsDate,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class UpdateChecklistItemDto {
  @ApiProperty({ enum: ChecklistItemStatus })
  @IsEnum(ChecklistItemStatus)
  status!: ChecklistItemStatus;

  @ApiPropertyOptional()
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(140)
  responsible?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  targetDate?: Date;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  completedDate?: Date;

  @ApiPropertyOptional()
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

/** T7C — registro de evidencia contractual. */
export class CreateContractEvidenceDto {
  @ApiProperty()
  @Transform(trim)
  @IsString()
  @MinLength(3)
  @MaxLength(240)
  title!: string;

  @ApiPropertyOptional()
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiPropertyOptional({ description: 'Documento cargado en el repositorio' })
  @IsOptional()
  @IsUUID()
  documentId?: string;

  @ApiPropertyOptional({ description: 'Ítem del checklist al que soporta' })
  @IsOptional()
  @IsUUID()
  itemId?: string;
}

/** T7B — marco operativo del servicio formalizado. */
export class UpsertOperationalFrameworkDto {
  @ApiProperty({ minLength: 40 })
  @Transform(trim)
  @IsString()
  @MinLength(40)
  @MaxLength(5000)
  operatingConditions!: string;

  @ApiProperty({ minimum: 1, maximum: 3650 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(3650)
  estimatedDurationDays!: number;

  @ApiProperty({ minLength: 20 })
  @Transform(trim)
  @IsString()
  @MinLength(20)
  @MaxLength(5000)
  baselineSchedule!: string;

  @ApiProperty({ minLength: 20 })
  @Transform(trim)
  @IsString()
  @MinLength(20)
  @MaxLength(5000)
  committedDeliverables!: string;

  @ApiProperty({ minLength: 10 })
  @Transform(trim)
  @IsString()
  @MinLength(10)
  @MaxLength(4000)
  clientDependencies!: string;

  @ApiProperty({ minLength: 10 })
  @Transform(trim)
  @IsString()
  @MinLength(10)
  @MaxLength(4000)
  assumptions!: string;

  @ApiPropertyOptional()
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  executionConstraints?: string;

  @ApiProperty()
  @Transform(trim)
  @IsString()
  @MinLength(3)
  @MaxLength(140)
  primaryContact!: string;
}
