import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

/**
 * Paginación estándar. El tope duro de `pageSize` (100) existe para que ningún
 * cliente pueda pedir "todos los casos" y tumbar la base: es un límite de
 * protección, no una preferencia de UI.
 */
export class PaginationDto {
  @ApiPropertyOptional({ minimum: 1, default: 1, description: 'Página (base 1)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'page debe ser un entero' })
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'pageSize debe ser un entero' })
  @Min(1)
  @Max(100, { message: 'pageSize no puede superar 100' })
  pageSize = 20;

  @ApiPropertyOptional({ description: 'Campo por el que ordenar' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  sortBy?: string;

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortDir: 'asc' | 'desc' = 'desc';

  get skip(): number {
    return (this.page - 1) * this.pageSize;
  }

  get take(): number {
    return this.pageSize;
  }
}

export interface PaginatedResult<T> {
  data: T[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export function paginate<T>(data: T[], total: number, dto: PaginationDto): PaginatedResult<T> {
  const totalPages = Math.max(1, Math.ceil(total / dto.pageSize));
  return {
    data,
    meta: {
      page: dto.page,
      pageSize: dto.pageSize,
      total,
      totalPages,
      hasNext: dto.page < totalPages,
      hasPrev: dto.page > 1,
    },
  };
}

/**
 * Traduce `sortBy` a un `orderBy` de Prisma **sólo** si el campo está en la lista
 * blanca. Sin esta comprobación, `?sortBy=` sería una vía directa para que un
 * cliente ordene por columnas que no debería ni conocer.
 */
export function safeOrderBy<TField extends string>(
  dto: PaginationDto,
  allowed: readonly TField[],
  fallback: TField,
): Record<string, 'asc' | 'desc'> {
  const field = (allowed as readonly string[]).includes(dto.sortBy ?? '')
    ? (dto.sortBy as TField)
    : fallback;
  return { [field]: dto.sortDir };
}
