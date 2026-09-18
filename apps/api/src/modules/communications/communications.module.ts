import { Body, Controller, Get, Injectable, Module, Param, ParseUUIDPipe, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { CommunicationAudience, CommunicationType, DocumentStage } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import type { Request } from 'express';
import { actorFrom, AuditService, type AuditActor } from '../../core/audit/audit.service';
import type { AuthenticatedUser } from '../../core/auth/auth.types';
import { CaseAccessService } from '../../core/auth/case-access.service';
import { CurrentUser, RequirePermissions } from '../../core/auth/decorators';
import { CaseAccess } from '../../core/auth/guards/case-access.guard';
import { NotFoundError } from '../../core/common/errors/domain.errors';
import { PrismaService } from '../../core/prisma/prisma.service';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

/** T3A / T3B / TP4A / T8F — interacción estructurada dentro de la plataforma. */
export class CreateCommunicationDto {
  @ApiProperty({ enum: CommunicationType })
  @IsEnum(CommunicationType)
  type!: CommunicationType;

  @ApiProperty({ enum: DocumentStage })
  @IsEnum(DocumentStage)
  stage!: DocumentStage;

  @ApiProperty({ enum: CommunicationAudience })
  @IsEnum(CommunicationAudience)
  audience!: CommunicationAudience;

  @ApiProperty()
  @Transform(trim) @IsString() @MinLength(5) @MaxLength(180)
  subject!: string;

  @ApiProperty()
  @Transform(trim) @IsString() @MinLength(10) @MaxLength(6000)
  body!: string;

  @ApiPropertyOptional({ description: 'Comunicación a la que responde' })
  @IsOptional() @IsUUID()
  parentId?: string;
}

/**
 * Comunicaciones del caso.
 *
 * Principio de interacción controlada: no hay canal directo consultor ↔ Mipyme
 * fuera de la plataforma. Toda solicitud de aclaración, respuesta o acuerdo
 * operativo se registra aquí y queda en la bitácora.
 */
@Injectable()
export class CommunicationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly caseAccess: CaseAccessService,
  ) {}

  async list(user: AuthenticatedUser, caseId: string) {
    const access = await this.caseAccess.assertCanRead(user, caseId);

    const communications = await this.prisma.communication.findMany({
      where: {
        caseId,
        // Un consultor postulante no ve las comunicaciones internas de advisory.
        ...(access.level === 'REDACTED' ? { audience: { not: 'INTERNO' } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        type: true,
        stage: true,
        audience: true,
        subject: true,
        body: true,
        parentId: true,
        answeredAt: true,
        createdAt: true,
        createdBy: { select: { id: true, fullName: true, role: { select: { code: true } } } },
      },
    });

    return communications.map((item) => ({
      ...item,
      createdBy: item.createdBy
        ? {
            id: item.createdBy.id,
            fullName: item.createdBy.fullName,
            role: item.createdBy.role.code,
          }
        : null,
    }));
  }

  async create(
    user: AuthenticatedUser,
    caseId: string,
    dto: CreateCommunicationDto,
    actor: AuditActor,
  ) {
    await this.caseAccess.assertCanRead(user, caseId);

    const kase = await this.prisma.case.findUnique({
      where: { id: caseId },
      select: { id: true, code: true, companyId: true },
    });
    if (!kase) throw new NotFoundError('el caso', caseId);

    if (dto.parentId) {
      const parent = await this.prisma.communication.findFirst({
        where: { id: dto.parentId, caseId },
        select: { id: true },
      });
      if (!parent) throw new NotFoundError('la comunicación a la que responde', dto.parentId);
    }

    return this.prisma.$transaction(async (tx) => {
      const communication = await tx.communication.create({
        data: { caseId, ...dto, createdById: user.id },
        select: {
          id: true,
          type: true,
          stage: true,
          audience: true,
          subject: true,
          body: true,
          parentId: true,
          createdAt: true,
        },
      });

      // Responder cierra el hilo padre: deja medible el tiempo de respuesta.
      if (dto.parentId) {
        await tx.communication.update({
          where: { id: dto.parentId },
          data: { answeredAt: new Date() },
        });
      }

      await this.audit.record(tx, actor, {
        action: 'COMMUNICATION_REGISTERED',
        entity: 'Communication',
        entityId: communication.id,
        caseId,
        companyId: kase.companyId,
        newValue: {
          type: communication.type,
          audience: communication.audience,
          subject: communication.subject,
        },
      });

      return communication;
    });
  }
}

@ApiTags('Comunicaciones')
@ApiBearerAuth()
@Controller('cases/:id/communications')
export class CommunicationsController {
  constructor(private readonly communications: CommunicationsService) {}

  @Get()
  @RequirePermissions('CASE_READ')
  @CaseAccess('ANY')
  @ApiOperation({ summary: 'Comunicaciones registradas del caso' })
  list(@Param('id', ParseUUIDPipe) caseId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.communications.list(user, caseId);
  }

  @Post()
  @RequirePermissions('CASE_READ')
  @CaseAccess('ANY')
  @ApiOperation({
    summary: 'Registrar una comunicación estructurada',
    description:
      'No existe canal directo consultor ↔ Mipyme fuera de la plataforma: toda aclaración, ' +
      'respuesta o acuerdo pasa por aquí y queda en la bitácora.',
  })
  create(
    @Param('id', ParseUUIDPipe) caseId: string,
    @Body() dto: CreateCommunicationDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.communications.create(user, caseId, dto, actorFrom(user, request));
  }
}

@Module({
  controllers: [CommunicationsController],
  providers: [CommunicationsService],
  exports: [CommunicationsService],
})
export class CommunicationsModule {}
