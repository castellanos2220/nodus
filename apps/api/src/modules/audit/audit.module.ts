import { Controller, Get, Injectable, Module, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { AuditOrigin, Prisma } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import { IsDate, IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { RequirePermissions } from '../../core/auth/decorators';
import { PaginationDto, paginate } from '../../core/common/dto/pagination.dto';
import { PrismaService } from '../../core/prisma/prisma.service';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class AuditQueryDto extends PaginationDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID() caseId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() companyId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() actorId?: string;

  @ApiPropertyOptional({ description: 'Acción exacta o prefijo, p. ej. CASE_TRANSITION_' })
  @Transform(trim) @IsOptional() @IsString() @MaxLength(80)
  action?: string;

  @ApiPropertyOptional() @Transform(trim) @IsOptional() @IsString() @MaxLength(80)
  entity?: string;

  @ApiPropertyOptional({ enum: AuditOrigin })
  @IsOptional() @IsEnum(AuditOrigin)
  origin?: AuditOrigin;

  @ApiPropertyOptional() @IsOptional() @Type(() => Date) @IsDate() from?: Date;
  @ApiPropertyOptional() @IsOptional() @Type(() => Date) @IsDate() to?: Date;
}

/**
 * Consulta de la bitácora de auditoría.
 *
 * Deliberadamente **sólo lectura**: no hay endpoint de creación (la escriben los
 * servicios dentro de sus transacciones), ni de actualización, ni de borrado.
 * La inmutabilidad se garantiza además con triggers en PostgreSQL, de modo que
 * ni un error de programación futuro pueda alterarla (RT-004).
 *
 * Filtros exigidos por §26: empresa, caso, usuario, acción y fecha; cada uno
 * tiene su índice compuesto con `createdAt`.
 */
@Injectable()
export class AuditQueryService {
  constructor(private readonly prisma: PrismaService) {}

  async find(query: AuditQueryDto) {
    const where: Prisma.AuditLogWhereInput = {};

    if (query.caseId) where.caseId = query.caseId;
    if (query.companyId) where.companyId = query.companyId;
    if (query.actorId) where.actorId = query.actorId;
    if (query.entity) where.entity = query.entity;
    if (query.origin) where.origin = query.origin;

    if (query.action) {
      // Un prefijo como `CASE_TRANSITION_` es una consulta habitual: permite ver
      // sólo los cambios de estado sin enumerar 21 códigos.
      where.action = query.action.endsWith('_')
        ? { startsWith: query.action }
        : query.action;
    }

    if (query.from || query.to) {
      where.createdAt = { gte: query.from ?? undefined, lte: query.to ?? undefined };
    }

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: query.skip,
        take: query.take,
        select: {
          id: true,
          createdAt: true,
          action: true,
          entity: true,
          entityId: true,
          origin: true,
          previousValue: true,
          newValue: true,
          metadata: true,
          ip: true,
          requestId: true,
          actorRole: true,
          actor: { select: { id: true, fullName: true, email: true } },
          case: { select: { id: true, code: true, title: true } },
          company: { select: { id: true, code: true, name: true } },
        },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return paginate(rows, total, query);
  }

  /** Acciones distintas registradas, para poblar el filtro de la interfaz. */
  async actions() {
    const rows = await this.prisma.auditLog.groupBy({
      by: ['action'],
      _count: { _all: true },
      orderBy: { action: 'asc' },
    });
    return rows.map((row) => ({ action: row.action, count: row._count._all }));
  }
}

@ApiTags('Auditoría')
@ApiBearerAuth()
@Controller('audit')
export class AuditController {
  constructor(private readonly audit: AuditQueryService) {}

  @Get()
  @RequirePermissions('AUDIT_READ')
  @ApiOperation({
    summary: 'Consultar la bitácora de auditoría',
    description:
      'Sólo lectura. Filtrable por empresa, caso, usuario, acción, entidad, origen y fecha. ' +
      'Los registros no pueden modificarse ni eliminarse desde la aplicación.',
  })
  find(@Query() query: AuditQueryDto) {
    return this.audit.find(query);
  }

  @Get('actions')
  @RequirePermissions('AUDIT_READ')
  @ApiOperation({ summary: 'Acciones registradas y su frecuencia' })
  actions() {
    return this.audit.actions();
  }
}

@Module({
  controllers: [AuditController],
  providers: [AuditQueryService],
})
export class AuditModule {}
