import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DocumentStage } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class UploadDocumentDto {
  @ApiProperty({
    enum: DocumentStage,
    description: 'Etapa del repositorio documental (Empresa → Caso → Etapa → Versión)',
  })
  @IsEnum(DocumentStage)
  stage!: DocumentStage;

  @ApiProperty({ example: 'ANEXO_VALORACION', description: 'Tipo documental' })
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  type!: string;

  @ApiPropertyOptional({ description: 'Nombre del documento; por defecto, el del archivo' })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(240)
  name?: string;

  @ApiPropertyOptional({
    description: 'Si se indica, se añade una versión nueva a ese documento en lugar de crear uno',
  })
  @IsOptional()
  @IsUUID()
  documentId?: string;

  @ApiPropertyOptional()
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
