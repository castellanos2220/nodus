import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { actorFrom } from '../../core/audit/audit.service';
import type { AuthenticatedUser } from '../../core/auth/auth.types';
import { CurrentUser, RequirePermissions } from '../../core/auth/decorators';
import { CaseAccess } from '../../core/auth/guards/case-access.guard';
import { CreateReviewDto, UpdateProposalVersionDto } from './dto/proposals.dto';
import { ProposalsService } from './proposals.service';
import { ReviewsService } from './reviews.service';

@ApiTags('Propuestas')
@ApiBearerAuth()
@Controller()
export class ProposalsController {
  constructor(
    private readonly proposals: ProposalsService,
    private readonly reviews: ReviewsService,
  ) {}

  @Get('cases/:id/proposal')
  @RequirePermissions('PROPOSAL_READ')
  @CaseAccess('ANY')
  @ApiOperation({
    summary: 'Expediente de propuesta del caso',
    description: 'Todas las versiones, revisiones y solicitudes de ajuste. Nada se sobrescribe.',
  })
  findByCase(@Param('id', ParseUUIDPipe) caseId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.proposals.findByCase(user, caseId);
  }

  @Get('cases/:id/proposal/diff')
  @RequirePermissions('PROPOSAL_READ')
  @CaseAccess('ANY')
  @ApiOperation({ summary: 'Diferencias entre dos versiones de la propuesta' })
  @ApiQuery({ name: 'from', type: Number })
  @ApiQuery({ name: 'to', type: Number })
  diff(
    @Param('id', ParseUUIDPipe) caseId: string,
    @Query('from', ParseIntPipe) from: number,
    @Query('to', ParseIntPipe) to: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.proposals.diff(user, caseId, from, to);
  }

  @Get('proposals/pending-review')
  @RequirePermissions('PROPOSAL_REVIEW')
  @ApiOperation({ summary: 'Bandeja de propuestas pendientes de QA' })
  pendingReview(@CurrentUser() user: AuthenticatedUser) {
    return this.proposals.pendingReview(user);
  }

  @Get('proposals/versions/:versionId')
  @RequirePermissions('PROPOSAL_READ')
  @ApiOperation({ summary: 'Detalle de una versión concreta' })
  findVersion(
    @Param('versionId', ParseUUIDPipe) versionId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.proposals.findVersion(user, versionId);
  }

  @Patch('proposals/versions/:versionId')
  @RequirePermissions('PROPOSAL_CREATE')
  @ApiOperation({
    summary: 'Editar la versión en borrador (TP4B + TP4C)',
    description:
      'Sólo el consultor responsable principal, y sólo mientras la versión esté en BORRADOR. ' +
      'Permite guardado por bloques: lo enviado se fusiona con lo ya guardado.',
  })
  @ApiResponse({ status: 409, description: 'La versión está congelada' })
  updateVersion(
    @Param('versionId', ParseUUIDPipe) versionId: string,
    @Body() dto: UpdateProposalVersionDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.proposals.updateVersion(user, versionId, dto, actorFrom(user, request));
  }

  @Post('cases/:id/proposal/reviews')
  @RequirePermissions('PROPOSAL_REVIEW')
  @CaseAccess('ANY')
  @ApiOperation({
    summary: 'Registrar una revisión de propuesta (TP4H metodológica o peer review)',
    description:
      'No cambia el estado del caso: lo hacen las transiciones APPROVE_AND_SEND o ' +
      'REQUEST_PROPOSAL_CHANGES, que exigen que exista la revisión adecuada.',
  })
  createReview(
    @Param('id', ParseUUIDPipe) caseId: string,
    @Body() dto: CreateReviewDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.reviews.create(user, caseId, dto, actorFrom(user, request));
  }

  @Get('cases/:id/proposal/reviews')
  @RequirePermissions('PROPOSAL_READ')
  @CaseAccess('ANY')
  @ApiOperation({ summary: 'Revisiones registradas sobre la propuesta del caso' })
  findReviews(@Param('id', ParseUUIDPipe) caseId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.reviews.findByCase(user, caseId);
  }
}
