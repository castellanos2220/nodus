import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiQuery, ApiTags } from '@nestjs/swagger';
import { SlaStatus } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import type { Request } from 'express';
import { actorFrom, AuditService } from '../../core/audit/audit.service';
import type { AuthenticatedUser } from '../../core/auth/auth.types';
import { CurrentUser, RequirePermissions } from '../../core/auth/decorators';
import { PaginationDto, paginate } from '../../core/common/dto/pagination.dto';
import { PrismaService } from '../../core/prisma/prisma.service';
import { SlaService } from './sla.service';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class UpsertSlaRuleDto {
  @ApiProperty({ example: 'SLA_EN_REVISION_ALTA' })
  @Transform(trim) @IsString() @MinLength(3) @MaxLength(80)
  @Matches(/^[A-Z0-9_]+$/, { message: 'El código debe ser MAYÚSCULAS_CON_GUION_BAJO' })
  code!: string;

  @ApiProperty() @Transform(trim) @IsString() @MinLength(5) @MaxLength(180)
  name!: string;

  @ApiProperty({ description: 'Etapa del proceso (coincide con el estado del caso)' })
  @Transform(trim) @IsString() @MaxLength(60)
  stage!: string;

  @ApiProperty({ minimum: 1, maximum: 8760 })
  @Type(() => Number) @IsInt() @Min(1) @Max(8760)
  durationHours!: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 99, default: 75 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(99)
  warningThresholdPercent?: number;

  @ApiPropertyOptional({ minimum: 0, maximum: 8760 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(8760)
  escalationAfterHours?: number;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(60) complexityCode?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(60) interventionTypeCode?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(60) consultantLevelCode?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(60) clientSegmentCode?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(60) priorityCode?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional() @IsBoolean()
  isActive?: boolean;
}

@ApiTags('SLA')
@ApiBearerAuth()
@Controller('sla')
export class SlaController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sla: SlaService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  @RequirePermissions('CASE_READ')
  @ApiOperation({
    summary: 'Instancias de SLA con su consumo y alertas',
    description: 'Ordenadas por vencimiento; el filtro por estado usa el índice (status, deadline).',
  })
  @ApiQuery({ name: 'status', required: false, enum: SlaStatus })
  @ApiQuery({ name: 'caseId', required: false })
  async instances(
    @Query() query: PaginationDto,
    @Query('status') status?: SlaStatus,
    @Query('caseId') caseId?: string,
  ) {
    const where = {
      ...(status ? { status } : {}),
      ...(caseId ? { caseId } : {}),
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.slaInstance.findMany({
        where,
        orderBy: [{ status: 'asc' }, { deadline: 'asc' }],
        skip: query.skip,
        take: query.take,
        select: {
          id: true,
          stage: true,
          startedAt: true,
          deadline: true,
          completedAt: true,
          status: true,
          percentConsumed: true,
          case: { select: { id: true, code: true, title: true, status: true } },
          rule: { select: { code: true, name: true, durationHours: true } },
          alerts: { select: { id: true, kind: true, message: true, createdAt: true } },
          escalations: { select: { id: true, level: true, reason: true, createdAt: true } },
        },
      }),
      this.prisma.slaInstance.count({ where }),
    ]);

    return paginate(
      rows.map((row) => ({
        ...row,
        percentConsumed: Number(row.percentConsumed),
        escalated: row.escalations.length > 0,
      })),
      total,
      query,
    );
  }

  @Get('cases/:caseId')
  @RequirePermissions('CASE_READ')
  @ApiOperation({ summary: 'Historial de SLA de un caso' })
  async byCase(@Param('caseId', ParseUUIDPipe) caseId: string) {
    const rows = await this.prisma.slaInstance.findMany({
      where: { caseId },
      orderBy: { startedAt: 'asc' },
      select: {
        id: true,
        stage: true,
        startedAt: true,
        deadline: true,
        completedAt: true,
        status: true,
        percentConsumed: true,
        rule: { select: { code: true, name: true, durationHours: true } },
        alerts: { select: { kind: true, message: true, createdAt: true } },
      },
    });

    return rows.map((row) => ({ ...row, percentConsumed: Number(row.percentConsumed) }));
  }

  @Get('rules')
  // Leer la parametrización es parte del trabajo de veeduría de Advisory;
  // modificarla sigue reservado a quien tiene SLA_MANAGE.
  @RequirePermissions('CASE_READ')
  @ApiOperation({
    summary: 'Reglas de SLA configuradas',
    description:
      'Ninguna duración está escrita en código: se resuelven por especificidad ' +
      '(etapa + dimensiones coincidentes) en tiempo de ejecución.',
  })
  rules() {
    return this.prisma.slaRule.findMany({
      orderBy: [{ stage: 'asc' }, { code: 'asc' }],
    });
  }

  @Post('rules')
  @RequirePermissions('SLA_MANAGE')
  @ApiOperation({ summary: 'Crear o actualizar una regla de SLA' })
  async upsertRule(
    @Body() dto: UpsertSlaRuleDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    const existing = await this.prisma.slaRule.findUnique({ where: { code: dto.code } });

    return this.prisma.$transaction(async (tx) => {
      const rule = await tx.slaRule.upsert({
        where: { code: dto.code },
        create: {
          ...dto,
          warningThresholdPercent: dto.warningThresholdPercent ?? 75,
          isActive: dto.isActive ?? true,
        },
        update: {
          ...dto,
          warningThresholdPercent: dto.warningThresholdPercent ?? 75,
          isActive: dto.isActive ?? true,
        },
      });

      await this.audit.record(tx, actorFrom(user, request), {
        action: existing ? 'SLA_RULE_UPDATED' : 'SLA_RULE_CREATED',
        entity: 'SlaRule',
        entityId: rule.id,
        previousValue: existing
          ? { durationHours: existing.durationHours, isActive: existing.isActive }
          : null,
        newValue: {
          code: rule.code,
          stage: rule.stage,
          durationHours: rule.durationHours,
          isActive: rule.isActive,
        },
      });

      return rule;
    });
  }

  @Patch('evaluate')
  @RequirePermissions('SLA_MANAGE')
  @ApiOperation({
    summary: 'Forzar una evaluación de SLA',
    description:
      'Normalmente lo hace el worker cada pocos minutos. Este endpoint existe para poder ' +
      'demostrar el ciclo completo sin esperar al cron.',
  })
  async evaluate() {
    const events = await this.sla.evaluateOpenInstances();
    return { evaluated: true, eventsGenerated: events.length, events: events.map((e) => e.name) };
  }
}
