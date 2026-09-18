import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ActivityStatus,
  ClosureResponseType,
  DeliverableStatus,
  ImpactLevel,
  IncidentStatus,
  MeetingType,
  MilestoneStatus,
} from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
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

// -------------------------------------------------------- T8B Actividades ----

export class CreateActivityDto {
  @ApiProperty()
  @Transform(trim) @IsString() @MinLength(5) @MaxLength(180)
  name!: string;

  @ApiPropertyOptional()
  @Transform(trim) @IsOptional() @IsString() @MaxLength(3000)
  description?: string;

  @ApiProperty()
  @Transform(trim) @IsString() @MinLength(3) @MaxLength(140)
  responsible!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  @Type(() => Date) @IsDate()
  targetDate!: Date;

  @ApiPropertyOptional({ enum: ActivityStatus, default: ActivityStatus.NO_INICIADA })
  @IsOptional() @IsEnum(ActivityStatus)
  status?: ActivityStatus;

  @ApiPropertyOptional()
  @Transform(trim) @IsOptional() @IsString() @MaxLength(2000)
  notes?: string;
}

export class UpdateActivityDto {
  @ApiPropertyOptional() @Transform(trim) @IsOptional() @IsString() @MinLength(5) @MaxLength(180)
  name?: string;

  @ApiPropertyOptional() @Transform(trim) @IsOptional() @IsString() @MaxLength(3000)
  description?: string;

  @ApiPropertyOptional() @Transform(trim) @IsOptional() @IsString() @MaxLength(140)
  responsible?: string;

  @ApiPropertyOptional() @IsOptional() @Type(() => Date) @IsDate()
  targetDate?: Date;

  @ApiPropertyOptional({ enum: ActivityStatus }) @IsOptional() @IsEnum(ActivityStatus)
  status?: ActivityStatus;

  @ApiPropertyOptional() @Transform(trim) @IsOptional() @IsString() @MaxLength(2000)
  notes?: string;

  @ApiPropertyOptional({ description: 'Documento que evidencia la actividad' })
  @IsOptional() @IsUUID()
  evidenceDocumentId?: string;
}

// ------------------------------------------------------------- T8C Hitos ----

export class CreateMilestoneDto {
  @ApiProperty() @Transform(trim) @IsString() @MinLength(5) @MaxLength(180)
  name!: string;

  @ApiPropertyOptional() @Transform(trim) @IsOptional() @IsString() @MaxLength(3000)
  description?: string;

  @ApiProperty() @Transform(trim) @IsString() @MinLength(3) @MaxLength(140)
  responsible!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  @Type(() => Date) @IsDate()
  targetDate!: Date;

  @ApiPropertyOptional({ enum: ImpactLevel, default: ImpactLevel.MEDIO })
  @IsOptional() @IsEnum(ImpactLevel)
  criticality?: ImpactLevel;

  @ApiPropertyOptional() @Transform(trim) @IsOptional() @IsString() @MaxLength(2000)
  expectedResult?: string;
}

export class UpdateMilestoneDto {
  @ApiPropertyOptional() @Transform(trim) @IsOptional() @IsString() @MinLength(5) @MaxLength(180)
  name?: string;

  @ApiPropertyOptional() @Transform(trim) @IsOptional() @IsString() @MaxLength(140)
  responsible?: string;

  @ApiPropertyOptional() @IsOptional() @Type(() => Date) @IsDate()
  targetDate?: Date;

  @ApiPropertyOptional({ enum: MilestoneStatus }) @IsOptional() @IsEnum(MilestoneStatus)
  status?: MilestoneStatus;

  @ApiPropertyOptional({ enum: ImpactLevel }) @IsOptional() @IsEnum(ImpactLevel)
  criticality?: ImpactLevel;

  @ApiPropertyOptional({
    description: 'Obligatoria si el hito se marca JUSTIFICADO o REPROGRAMADO',
  })
  @Transform(trim) @IsOptional() @IsString() @MaxLength(2000)
  justification?: string;
}

// ------------------------------------------------------- T8D Incidencias ----

export class CreateIncidentDto {
  @ApiProperty({ description: 'LOV TIPO_INCIDENCIA' })
  @Transform(trim) @IsString() @MaxLength(60)
  typeCode!: string;

  @ApiProperty() @Transform(trim) @IsString() @MinLength(5) @MaxLength(180)
  title!: string;

  @ApiProperty({ minLength: 20 }) @Transform(trim) @IsString() @MinLength(20) @MaxLength(4000)
  description!: string;

  @ApiProperty({ enum: ImpactLevel }) @IsEnum(ImpactLevel)
  impact!: ImpactLevel;

  @ApiProperty({ minLength: 10 }) @Transform(trim) @IsString() @MinLength(10) @MaxLength(2000)
  suggestedAction!: string;
}

export class UpdateIncidentDto {
  @ApiPropertyOptional({ enum: IncidentStatus }) @IsOptional() @IsEnum(IncidentStatus)
  status?: IncidentStatus;

  @ApiPropertyOptional({ enum: ImpactLevel }) @IsOptional() @IsEnum(ImpactLevel)
  impact?: ImpactLevel;

  @ApiPropertyOptional({ description: 'Decisión tomada; obligatoria al resolver o cerrar' })
  @Transform(trim) @IsOptional() @IsString() @MaxLength(2000)
  decision?: string;
}

// ------------------------------------------------------- T8G Entregables ----

export class CreateDeliverableDto {
  @ApiProperty() @Transform(trim) @IsString() @MinLength(5) @MaxLength(180)
  name!: string;

  @ApiPropertyOptional() @Transform(trim) @IsOptional() @IsString() @MaxLength(3000)
  description?: string;

  @ApiPropertyOptional({ description: 'LOV TIPO_ENTREGABLE' })
  @Transform(trim) @IsOptional() @IsString() @MaxLength(60)
  typeCode?: string;

  @ApiProperty() @Transform(trim) @IsString() @MinLength(3) @MaxLength(140)
  responsible!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  @Type(() => Date) @IsDate()
  targetDate!: Date;
}

export class UpdateDeliverableDto {
  @ApiPropertyOptional({ enum: DeliverableStatus }) @IsOptional() @IsEnum(DeliverableStatus)
  status?: DeliverableStatus;

  @ApiPropertyOptional() @Transform(trim) @IsOptional() @IsString() @MaxLength(2000)
  notes?: string;

  @ApiPropertyOptional() @IsOptional() @Type(() => Date) @IsDate()
  targetDate?: Date;
}

export class AddDeliverableVersionDto {
  @ApiPropertyOptional({ description: 'Versión documental que soporta esta entrega' })
  @IsOptional() @IsUUID()
  documentVersionId?: string;

  @ApiPropertyOptional() @Transform(trim) @IsOptional() @IsString() @MaxLength(2000)
  notes?: string;
}

// ------------------------------------------ T8E reuniones / T8F comunicaciones --

export class CreateMeetingDto {
  @ApiProperty() @Transform(trim) @IsString() @MinLength(5) @MaxLength(180)
  title!: string;

  @ApiProperty({ enum: MeetingType }) @IsEnum(MeetingType)
  type!: MeetingType;

  @ApiProperty({ type: String, format: 'date-time' }) @Type(() => Date) @IsDate()
  heldAt!: Date;

  @ApiProperty({ minimum: 5, maximum: 600 })
  @Type(() => Number) @IsInt() @Min(5) @Max(600)
  durationMinutes!: number;

  @ApiProperty() @Transform(trim) @IsString() @MinLength(5) @MaxLength(2000)
  participants!: string;

  @ApiProperty() @Transform(trim) @IsString() @MinLength(10) @MaxLength(4000)
  topics!: string;

  @ApiProperty() @Transform(trim) @IsString() @MinLength(10) @MaxLength(4000)
  conclusions!: string;

  @ApiPropertyOptional() @Transform(trim) @IsOptional() @IsString() @MaxLength(4000)
  commitments?: string;
}

// ------------------------------------------------------------ T9 Cierre ----

/** T9F — aceptación u observaciones de cierre del cliente. */
export class CustomerClosureResponseDto {
  @ApiProperty({ enum: ClosureResponseType })
  @IsEnum(ClosureResponseType)
  response!: ClosureResponseType;

  @ApiPropertyOptional({ description: 'Obligatorias salvo aceptación limpia' })
  @Transform(trim) @IsOptional() @IsString() @MaxLength(4000)
  observations?: string;
}

/** T9G — encuesta de satisfacción del cliente. */
export class CustomerEvaluationDto {
  @ApiProperty({ minimum: 1, maximum: 5 })
  @Type(() => Number) @IsInt() @Min(1) @Max(5) overallSatisfaction!: number;

  @ApiProperty({ minimum: 1, maximum: 5 })
  @Type(() => Number) @IsInt() @Min(1) @Max(5) serviceClarity!: number;

  @ApiProperty({ minimum: 1, maximum: 5 })
  @Type(() => Number) @IsInt() @Min(1) @Max(5) expectationFulfilment!: number;

  @ApiProperty({ minimum: 1, maximum: 5 })
  @Type(() => Number) @IsInt() @Min(1) @Max(5) perceivedValue!: number;

  @ApiProperty() @IsBoolean() wouldReuse!: boolean;

  @ApiPropertyOptional() @Transform(trim) @IsOptional() @IsString() @MaxLength(3000)
  comments?: string;
}

/** T9H — evaluación de desempeño del consultor. */
export class ConsultantEvaluationDto {
  @ApiProperty({ minimum: 1, maximum: 5 })
  @Type(() => Number) @IsInt() @Min(1) @Max(5) scopeCompliance!: number;

  @ApiProperty({ minimum: 1, maximum: 5 })
  @Type(() => Number) @IsInt() @Min(1) @Max(5) timeCompliance!: number;

  @ApiProperty({ minimum: 1, maximum: 5 })
  @Type(() => Number) @IsInt() @Min(1) @Max(5) documentationOrder!: number;

  @ApiProperty({ minimum: 1, maximum: 5 })
  @Type(() => Number) @IsInt() @Min(1) @Max(5) processConsistency!: number;

  @ApiProperty({ minimum: 1, maximum: 5 })
  @Type(() => Number) @IsInt() @Min(1) @Max(5) qaOutcome!: number;

  @ApiPropertyOptional() @Transform(trim) @IsOptional() @IsString() @MaxLength(3000)
  comments?: string;
}

/** T9C — ítem del checklist de revisión final. */
export class UpdateClosureChecklistItemDto {
  @ApiProperty({ enum: ['PENDIENTE', 'EN_PROCESO', 'CUMPLIDO', 'NO_APLICA'] })
  @IsString() @MaxLength(20)
  status!: 'PENDIENTE' | 'EN_PROCESO' | 'CUMPLIDO' | 'NO_APLICA';

  @ApiPropertyOptional() @Transform(trim) @IsOptional() @IsString() @MaxLength(2000)
  notes?: string;
}
