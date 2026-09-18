import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ConsultantStatus, ConsultantTier, EngagementMode } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { PaginationDto } from '../../../core/common/dto/pagination.dto';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

/** TC1 — registro de consultor. */
export class CreateConsultantDto {
  @ApiProperty() @Transform(trim) @IsString() @MinLength(3) @MaxLength(140)
  fullName!: string;

  @ApiProperty()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail() @MaxLength(180)
  email!: string;

  @ApiProperty() @Transform(trim) @IsString() @MinLength(5) @MaxLength(40)
  identityDocument!: string;

  @ApiProperty() @Transform(trim) @IsString() @MinLength(7) @MaxLength(40)
  phone!: string;

  @ApiProperty() @Transform(trim) @IsString() @MinLength(2) @MaxLength(80)
  country!: string;

  @ApiProperty() @Transform(trim) @IsString() @MinLength(2) @MaxLength(80)
  city!: string;

  @ApiProperty({ minLength: 40 })
  @Transform(trim) @IsString() @MinLength(40) @MaxLength(4000)
  professionalProfile!: string;

  @ApiProperty({ minimum: 0, maximum: 70 })
  @Type(() => Number) @IsInt() @Min(0) @Max(70)
  yearsOfExperience!: number;

  @ApiProperty({ enum: EngagementMode })
  @IsEnum(EngagementMode)
  engagementMode!: EngagementMode;

  @ApiPropertyOptional({ description: 'Empresa sponsor, si la modalidad es SPONSOR' })
  @IsOptional() @IsUUID()
  sponsorId?: string;

  @ApiProperty() @Transform(trim) @IsString() @MinLength(5) @MaxLength(500)
  availability!: string;

  @ApiPropertyOptional() @Transform(trim) @IsOptional() @IsString() @MaxLength(3000)
  certifications?: string;
}

export class ConsultantSpecialtyDto {
  @ApiProperty({ description: 'LOV ESPECIALIDAD' })
  @Transform(trim) @IsString() @MinLength(2) @MaxLength(60)
  specialtyCode!: string;

  @ApiPropertyOptional({ description: 'LOV SUBAREA' })
  @Transform(trim) @IsOptional() @IsString() @MaxLength(60)
  subSpecialtyCode?: string;

  @ApiProperty({ minimum: 0, maximum: 70 })
  @Type(() => Number) @IsInt() @Min(0) @Max(70)
  yearsOfExperience!: number;

  @ApiPropertyOptional({ default: false })
  @IsOptional() @IsBoolean()
  isPrimary?: boolean;
}

/** TC3 — clasificación y habilitación del consultor. */
export class ClassifyConsultantDto {
  @ApiProperty({ description: 'LOV NIVEL_CONSULTOR' })
  @Transform(trim) @IsString() @MaxLength(60)
  experienceLevelCode!: string;

  @ApiProperty({ description: 'LOV COMPLEJIDAD — complejidad máxima habilitada' })
  @Transform(trim) @IsString() @MaxLength(60)
  maxComplexityCode!: string;

  @ApiProperty({ enum: ConsultantTier })
  @IsEnum(ConsultantTier)
  tier!: ConsultantTier;

  @ApiProperty({ type: [ConsultantSpecialtyDto] })
  @IsArray() @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ConsultantSpecialtyDto)
  specialties!: ConsultantSpecialtyDto[];

  @ApiProperty({ type: [String], description: 'LOV TIPO_INTERVENCION' })
  @IsArray() @ArrayMinSize(1)
  @IsString({ each: true })
  interventionTypeCodes!: string[];

  @ApiPropertyOptional({ type: [String], description: 'LOV SECTOR' })
  @IsOptional() @IsArray() @IsString({ each: true })
  sectorCodes?: string[];

  @ApiPropertyOptional({ default: true })
  @IsOptional() @IsBoolean()
  canBeLeadConsultant?: boolean;

  @ApiPropertyOptional({ default: false, description: 'Habilitado para peer review' })
  @IsOptional() @IsBoolean()
  canBeReviewer?: boolean;

  @ApiPropertyOptional() @Transform(trim) @IsOptional() @IsString() @MaxLength(3000)
  notes?: string;
}

export class ChangeConsultantStatusDto {
  @ApiProperty({ enum: ConsultantStatus })
  @IsEnum(ConsultantStatus)
  status!: ConsultantStatus;

  @ApiProperty({ minLength: 10, description: 'Motivo de la decisión; queda en la bitácora' })
  @Transform(trim) @IsString() @MinLength(10) @MaxLength(2000)
  reason!: string;
}

export class ConsultantListQueryDto extends PaginationDto {
  @ApiPropertyOptional() @Transform(trim) @IsOptional() @IsString() @MaxLength(120)
  search?: string;

  @ApiPropertyOptional({ enum: ConsultantStatus })
  @IsOptional() @IsEnum(ConsultantStatus)
  status?: ConsultantStatus;

  @ApiPropertyOptional({ enum: ConsultantTier })
  @IsOptional() @IsEnum(ConsultantTier)
  tier?: ConsultantTier;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(60)
  specialtyCode?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(60)
  maxComplexityCode?: string;
}
