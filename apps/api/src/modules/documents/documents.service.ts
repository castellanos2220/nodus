import { createHash } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentStage, RoleCode } from '@prisma/client';
import { AuditService, type AuditActor } from '../../core/audit/audit.service';
import type { AuthenticatedUser } from '../../core/auth/auth.types';
import { CaseAccessService } from '../../core/auth/case-access.service';
import {
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../../core/common/errors/domain.errors';
import type { AppConfig } from '../../core/config/configuration';
import { PrismaService } from '../../core/prisma/prisma.service';
import { StorageService, buildStorageKey } from '../../core/storage/storage.service';
import type { UploadDocumentDto } from './dto/documents.dto';

export interface UploadedFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

/**
 * Tipos MIME aceptados.
 *
 * Lista blanca y no negra: enumerar lo prohibido siempre deja algo fuera. Se
 * valida el MIME declarado **y** los primeros bytes del archivo, porque el
 * `Content-Type` lo elige el cliente y se puede mentir.
 */
const ALLOWED_MIME_TYPES = new Map<string, string[]>([
  ['application/pdf', ['pdf']],
  ['application/msword', ['doc']],
  ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', ['docx']],
  ['application/vnd.ms-excel', ['xls']],
  ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', ['xlsx']],
  ['application/vnd.ms-powerpoint', ['ppt']],
  ['application/vnd.openxmlformats-officedocument.presentationml.presentation', ['pptx']],
  ['text/plain', ['txt']],
  ['text/csv', ['csv']],
  ['image/png', ['png']],
  ['image/jpeg', ['jpg', 'jpeg']],
  ['image/webp', ['webp']],
  ['application/zip', ['zip']],
]);

/** Firmas de archivo (magic numbers) para los tipos que las tienen estables. */
const MAGIC_NUMBERS: Array<{ mime: string; bytes: number[] }> = [
  { mime: 'application/pdf', bytes: [0x25, 0x50, 0x44, 0x46] }, // %PDF
  { mime: 'image/png', bytes: [0x89, 0x50, 0x4e, 0x47] },
  { mime: 'image/jpeg', bytes: [0xff, 0xd8, 0xff] },
  // docx/xlsx/pptx/zip comparten la firma ZIP.
  { mime: 'application/zip', bytes: [0x50, 0x4b, 0x03, 0x04] },
];

const ZIP_BASED = new Set([
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/zip',
]);

/**
 * Repositorio documental (§32, RT-019 .. RT-023).
 *
 * Reglas:
 *  · **Nunca se sobrescribe.** Cada carga es una `DocumentVersion` con una clave
 *    de almacenamiento propia que incluye el número de versión. Un trigger de
 *    PostgreSQL impide además `UPDATE`/`DELETE` sobre versiones.
 *  · **Nada se sirve directamente.** La descarga se hace con URL firmada de
 *    corta duración; el bucket no es público.
 *  · **El acceso se comprueba contra el caso.** Un documento hereda el control de
 *    acceso de su caso, más `DocumentAccess` para permisos puntuales.
 */
@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);
  private readonly maxFileBytes: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
    private readonly caseAccess: CaseAccessService,
    config: ConfigService<AppConfig, true>,
  ) {
    this.maxFileBytes = config.get('storage', { infer: true }).maxFileSizeMb * 1024 * 1024;
  }

  async listByCase(user: AuthenticatedUser, caseId: string, stage?: DocumentStage) {
    await this.caseAccess.assertCanRead(user, caseId);

    return this.prisma.document.findMany({
      where: { caseId, isArchived: false, ...(stage ? { stage } : {}) },
      orderBy: [{ stage: 'asc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        stage: true,
        type: true,
        name: true,
        currentVersion: true,
        createdAt: true,
        versions: {
          orderBy: { versionNumber: 'desc' },
          select: {
            id: true,
            versionNumber: true,
            fileName: true,
            mimeType: true,
            sizeBytes: true,
            checksum: true,
            notes: true,
            createdAt: true,
            uploadedBy: { select: { id: true, fullName: true } },
          },
        },
      },
    });
  }

  /**
   * Sube un archivo creando una versión nueva.
   *
   * Si se indica `documentId`, se añade una versión a ese documento; si no, se
   * crea un documento nuevo. En ningún caso se reemplaza un objeto existente.
   */
  async upload(
    user: AuthenticatedUser,
    caseId: string,
    file: UploadedFile,
    dto: UploadDocumentDto,
    actor: AuditActor,
  ) {
    await this.caseAccess.assertFullAccess(user, caseId);
    this.validateFile(file);

    const kase = await this.prisma.case.findUnique({
      where: { id: caseId },
      select: { id: true, companyId: true, code: true },
    });
    if (!kase) throw new NotFoundError('el caso', caseId);

    const checksum = createHash('sha256').update(file.buffer).digest('hex');

    // El documento y su versión se crean en una transacción; la subida al bucket
    // ocurre después, y si falla se marca la versión como fallida borrándola de
    // la base y del bucket. El orden importa: primero reservamos el número de
    // versión (con el único (documentId, versionNumber) protegiendo carreras).
    const prepared = await this.prisma.$transaction(async (tx) => {
      const document = dto.documentId
        ? await tx.document.findFirstOrThrow({
            where: { id: dto.documentId, caseId },
            select: { id: true, currentVersion: true, stage: true, name: true },
          })
        : await tx.document.create({
            data: {
              companyId: kase.companyId,
              caseId,
              stage: dto.stage,
              type: dto.type,
              name: dto.name ?? file.originalname,
              currentVersion: 0,
            },
            select: { id: true, currentVersion: true, stage: true, name: true },
          });

      const versionNumber = document.currentVersion + 1;
      const storageKey = buildStorageKey({
        companyId: kase.companyId,
        caseId,
        stage: document.stage,
        documentId: document.id,
        versionNumber,
        fileName: file.originalname,
      });

      const version = await tx.documentVersion.create({
        data: {
          documentId: document.id,
          versionNumber,
          fileName: file.originalname.slice(0, 255),
          mimeType: file.mimetype,
          sizeBytes: file.size,
          checksum,
          storageKey,
          notes: dto.notes ?? null,
          uploadedById: user.id,
        },
        select: { id: true, versionNumber: true, fileName: true, createdAt: true },
      });

      await tx.document.update({
        where: { id: document.id },
        data: { currentVersion: versionNumber },
      });

      await this.audit.record(tx, actor, {
        action: 'DOCUMENT_UPLOADED',
        entity: 'DocumentVersion',
        entityId: version.id,
        caseId,
        companyId: kase.companyId,
        newValue: {
          documentName: document.name,
          stage: document.stage,
          versionNumber,
          fileName: version.fileName,
          sizeBytes: file.size,
          checksum,
        },
      });

      return { document, version, storageKey };
    });

    try {
      await this.storage.put({
        key: prepared.storageKey,
        body: file.buffer,
        contentType: file.mimetype,
        metadata: { caseId, documentId: prepared.document.id, uploadedBy: user.id },
      });
    } catch (error) {
      // Compensación: sin bytes en el bucket, la fila de versión sería una
      // mentira. Se elimina con SQL directo porque el trigger de inmutabilidad
      // bloquea el DELETE normal — y ese trigger existe justo para que este sea
      // el único camino, explícito y auditado.
      this.logger.error(
        `Fallo al subir ${prepared.storageKey}; se revierte la versión ${prepared.version.id}`,
        error instanceof Error ? error.stack : undefined,
      );
      await this.rollbackVersion(prepared.document.id, prepared.version.id);
      throw new ValidationError(
        'No se pudo almacenar el archivo. Intente de nuevo.',
        undefined,
        'STORAGE_UPLOAD_FAILED',
      );
    }

    return {
      documentId: prepared.document.id,
      versionId: prepared.version.id,
      versionNumber: prepared.version.versionNumber,
      fileName: prepared.version.fileName,
      checksum,
      createdAt: prepared.version.createdAt,
    };
  }

  /** URL firmada de descarga, de corta duración. El bucket nunca es público. */
  async getDownloadUrl(user: AuthenticatedUser, versionId: string) {
    const version = await this.prisma.documentVersion.findUnique({
      where: { id: versionId },
      select: {
        id: true,
        fileName: true,
        mimeType: true,
        sizeBytes: true,
        storageKey: true,
        document: {
          select: {
            id: true,
            caseId: true,
            companyId: true,
            accesses: { where: { userId: user.id }, select: { level: true } },
          },
        },
      },
    });

    if (!version) throw new NotFoundError('la versión del documento', versionId);

    await this.assertCanAccessDocument(user, version.document);

    const url = await this.storage.getSignedUrl(version.storageKey, version.fileName);

    return {
      url,
      fileName: version.fileName,
      mimeType: version.mimeType,
      sizeBytes: version.sizeBytes,
      expiresInSeconds: 300,
    };
  }

  async findOne(user: AuthenticatedUser, documentId: string) {
    const document = await this.prisma.document.findUnique({
      where: { id: documentId },
      select: {
        id: true,
        caseId: true,
        companyId: true,
        stage: true,
        type: true,
        name: true,
        currentVersion: true,
        createdAt: true,
        accesses: { where: { userId: user.id }, select: { level: true } },
        versions: {
          orderBy: { versionNumber: 'desc' },
          select: {
            id: true,
            versionNumber: true,
            fileName: true,
            mimeType: true,
            sizeBytes: true,
            checksum: true,
            notes: true,
            createdAt: true,
            uploadedBy: { select: { id: true, fullName: true } },
          },
        },
      },
    });

    if (!document) throw new NotFoundError('el documento', documentId);
    await this.assertCanAccessDocument(user, document);

    return document;
  }

  // ------------------------------------------------------------------ internos

  private validateFile(file: UploadedFile): void {
    if (!file?.buffer?.length) {
      throw new ValidationError('No se recibió ningún archivo');
    }

    if (file.size > this.maxFileBytes) {
      throw new ValidationError(
        `El archivo supera el tamaño máximo permitido (${Math.round(this.maxFileBytes / 1024 / 1024)} MB).`,
        { sizeBytes: file.size, maxBytes: this.maxFileBytes },
        'FILE_TOO_LARGE',
      );
    }

    const extensions = ALLOWED_MIME_TYPES.get(file.mimetype);
    if (!extensions) {
      throw new ValidationError(
        `El tipo de archivo "${file.mimetype}" no está permitido.`,
        { allowed: [...ALLOWED_MIME_TYPES.keys()] },
        'MIME_TYPE_NOT_ALLOWED',
      );
    }

    const extension = file.originalname.split('.').pop()?.toLowerCase() ?? '';
    if (!extensions.includes(extension)) {
      throw new ValidationError(
        `La extensión ".${extension}" no corresponde al tipo declarado (${file.mimetype}).`,
        undefined,
        'EXTENSION_MISMATCH',
      );
    }

    // Comprobación de contenido: el `Content-Type` lo elige quien sube.
    const expectedMagic = ZIP_BASED.has(file.mimetype)
      ? MAGIC_NUMBERS.find((entry) => entry.mime === 'application/zip')
      : MAGIC_NUMBERS.find((entry) => entry.mime === file.mimetype);

    if (expectedMagic) {
      const header = [...file.buffer.subarray(0, expectedMagic.bytes.length)];
      const matches = expectedMagic.bytes.every((byte, index) => header[index] === byte);
      if (!matches) {
        throw new ValidationError(
          'El contenido del archivo no corresponde con el tipo declarado.',
          undefined,
          'FILE_CONTENT_MISMATCH',
        );
      }
    }
  }

  private async assertCanAccessDocument(
    user: AuthenticatedUser,
    document: {
      caseId: string | null;
      companyId: string;
      accesses: { level: string }[];
    },
  ): Promise<void> {
    // Un permiso explícito sobre el documento basta.
    if (document.accesses.length > 0) return;

    if (user.role === RoleCode.SUPER_ADMIN || user.role === RoleCode.ADVISORY) return;

    if (document.caseId) {
      await this.caseAccess.assertCanRead(user, document.caseId);
      return;
    }

    // Documento a nivel de empresa: sólo el cliente de esa empresa.
    if (user.role === RoleCode.CLIENTE_MIPYME && user.companyId === document.companyId) return;

    throw new ForbiddenError('No tiene acceso a este documento', 'DOCUMENT_ACCESS_DENIED');
  }

  /** Borrado de compensación; el trigger impide el DELETE por ORM a propósito. */
  private async rollbackVersion(documentId: string, versionId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`ALTER TABLE "document_versions" DISABLE TRIGGER "document_versions_no_delete"`;
      await tx.$executeRaw`DELETE FROM "document_versions" WHERE "id" = ${versionId}::uuid`;
      await tx.$executeRaw`ALTER TABLE "document_versions" ENABLE TRIGGER "document_versions_no_delete"`;

      const remaining = await tx.documentVersion.aggregate({
        where: { documentId },
        _max: { versionNumber: true },
      });
      await tx.document.update({
        where: { id: documentId },
        data: { currentVersion: remaining._max.versionNumber ?? 0 },
      });
    });
  }
}
