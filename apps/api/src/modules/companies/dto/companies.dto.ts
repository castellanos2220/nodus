import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { PaginationDto } from '../../../core/common/dto/pagination.dto';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class CreateCompanyDto {
  @ApiProperty({ example: 'Aceros del Norte S.A.S.' })
  @Transform(trim)
  @IsString()
  @MinLength(3)
  @MaxLength(180)
  name!: string;

  @ApiPropertyOptional({ example: '900123456-7' })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(40)
  taxId?: string;

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

  @ApiPropertyOptional({ description: 'Código de la LOV SECTOR' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  sectorCode?: string;

  @ApiPropertyOptional()
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(200)
  website?: string;

  @ApiPropertyOptional({ description: 'Correo del contacto principal, usado para el matching' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsOptional()
  @IsEmail()
  @MaxLength(180)
  contactEmail?: string;

  @ApiPropertyOptional({
    description: 'Vincular a una empresa existente en lugar de crear una nueva',
  })
  @IsOptional()
  @IsUUID()
  linkToCompanyId?: string;

  @ApiPropertyOptional({
    description:
      'Crear a pesar de coincidencias exactas. Sólo ADVISORY/SUPER_ADMIN, y queda auditado con motivo.',
  })
  @IsOptional()
  @IsBoolean()
  forceCreate?: boolean;

  @ApiPropertyOptional({ description: 'Motivo obligatorio cuando se usa forceCreate' })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(500)
  forceCreateReason?: string;
}

export class MatchCompanyDto {
  @ApiProperty({ example: 'Aceros del Norte' })
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(180)
  name!: string;

  @ApiPropertyOptional()
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(40)
  taxId?: string;

  @ApiPropertyOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsOptional()
  @IsEmail()
  @MaxLength(180)
  contactEmail?: string;
}

export class CreateCompanyContactDto {
  @ApiProperty()
  @Transform(trim)
  @IsString()
  @MinLength(3)
  @MaxLength(140)
  fullName!: string;

  @ApiProperty()
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  jobTitle!: string;

  @ApiProperty()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail()
  @MaxLength(180)
  email!: string;

  @ApiProperty()
  @Transform(trim)
  @IsString()
  @MinLength(7)
  @MaxLength(40)
  phone!: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}

export class CompanyListQueryDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Busca por nombre, código o NIT' })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  country?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(60)
  sectorCode?: string;
}
