import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UploadedFile as UploadedFileParam,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { DocumentStage } from '@prisma/client';
import type { Request } from 'express';
import { actorFrom } from '../../core/audit/audit.service';
import type { AuthenticatedUser } from '../../core/auth/auth.types';
import { CurrentUser, RequirePermissions } from '../../core/auth/decorators';
import { CaseAccess } from '../../core/auth/guards/case-access.guard';
import { DocumentsService, type UploadedFile } from './documents.service';
import { UploadDocumentDto } from './dto/documents.dto';

@ApiTags('Documentos')
@ApiBearerAuth()
@Controller()
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  @Get('cases/:id/documents')
  @RequirePermissions('DOCUMENT_READ')
  @CaseAccess('ANY')
  @ApiOperation({ summary: 'Documentos del caso, con todas sus versiones' })
  @ApiQuery({ name: 'stage', required: false, enum: DocumentStage })
  list(
    @Param('id', ParseUUIDPipe) caseId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query('stage') stage?: DocumentStage,
  ) {
    return this.documents.listByCase(user, caseId, stage);
  }

  @Post('cases/:id/documents')
  @RequirePermissions('DOCUMENT_UPLOAD')
  @CaseAccess('FULL')
  @UseInterceptors(
    FileInterceptor('file', {
      // Se guarda en memoria: los archivos del producto son documentos de
      // oficina, y así se puede calcular el checksum y validar la firma antes
      // de tocar el bucket. El límite duro lo impone también el servicio.
      limits: { fileSize: 30 * 1024 * 1024, files: 1 },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file', 'stage', 'type'],
      properties: {
        file: { type: 'string', format: 'binary' },
        stage: { type: 'string', enum: Object.values(DocumentStage) },
        type: { type: 'string', example: 'ANEXO_VALORACION' },
        name: { type: 'string' },
        documentId: { type: 'string', format: 'uuid' },
        notes: { type: 'string' },
      },
    },
  })
  @ApiOperation({
    summary: 'Cargar un documento (crea una versión nueva)',
    description:
      'Valida tipo MIME contra lista blanca, extensión y firma binaria. La clave de ' +
      'almacenamiento incluye la versión: nunca se sobrescribe un objeto previo.',
  })
  upload(
    @Param('id', ParseUUIDPipe) caseId: string,
    @UploadedFileParam() file: UploadedFile,
    @Body() dto: UploadDocumentDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.documents.upload(user, caseId, file, dto, actorFrom(user, request));
  }

  @Get('documents/:documentId')
  @RequirePermissions('DOCUMENT_READ')
  @ApiOperation({ summary: 'Detalle de un documento' })
  findOne(
    @Param('documentId', ParseUUIDPipe) documentId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.documents.findOne(user, documentId);
  }

  @Get('documents/versions/:versionId/download-url')
  @RequirePermissions('DOCUMENT_READ')
  @ApiOperation({
    summary: 'URL firmada de descarga',
    description:
      'De corta duración. El bucket no es público: la API nunca devuelve una ruta directa.',
  })
  downloadUrl(
    @Param('versionId', ParseUUIDPipe) versionId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.documents.getDownloadUrl(user, versionId);
  }
}
