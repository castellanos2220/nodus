import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from '../config/configuration';
import { StorageService } from './storage.service';

/**
 * Adaptador S3. Funciona contra MinIO en desarrollo (`S3_FORCE_PATH_STYLE=true`,
 * endpoint local) y contra AWS S3 / Cloudflare R2 en producción cambiando sólo
 * variables de entorno. Ningún módulo de negocio importa este archivo.
 */
@Injectable()
export class S3StorageService extends StorageService implements OnModuleInit {
  private readonly logger = new Logger(S3StorageService.name);
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly signedUrlTtl: number;

  constructor(private readonly config: ConfigService<AppConfig, true>) {
    super();
    const storage = this.config.get('storage', { infer: true });

    this.bucket = storage.bucket;
    this.signedUrlTtl = storage.signedUrlTtlSeconds;
    this.client = new S3Client({
      endpoint: storage.endpoint,
      region: storage.region,
      forcePathStyle: storage.forcePathStyle,
      credentials: {
        accessKeyId: storage.accessKey,
        secretAccessKey: storage.secretKey,
      },
    });
  }

  async onModuleInit(): Promise<void> {
    const ok = await this.healthCheck();
    if (ok) {
      this.logger.log(`Storage conectado (bucket "${this.bucket}")`);
    } else {
      // No se aborta el arranque: la API debe poder servir el resto aunque el
      // storage esté caído, y `/health` lo reportará como degradado.
      this.logger.warn(
        `No se pudo alcanzar el bucket "${this.bucket}". Las cargas de documentos fallarán.`,
      );
    }
  }

  async put(input: {
    key: string;
    body: Buffer;
    contentType: string;
    metadata?: Record<string, string>;
  }): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: input.key,
        Body: input.body,
        ContentType: input.contentType,
        Metadata: input.metadata,
      }),
    );
  }

  async get(key: string): Promise<Buffer> {
    const result = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
    );
    const bytes = await result.Body?.transformToByteArray();
    if (!bytes) {
      throw new Error(`El objeto ${key} no devolvió contenido`);
    }
    return Buffer.from(bytes);
  }

  async getSignedUrl(key: string, fileName?: string): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ResponseContentDisposition: fileName
        ? `attachment; filename="${encodeURIComponent(fileName)}"`
        : undefined,
    });
    return getSignedUrl(this.client, command, { expiresIn: this.signedUrlTtl });
  }

  async exists(key: string): Promise<boolean> {
    try {
      await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return true;
    } catch {
      return false;
    }
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
      return true;
    } catch {
      return false;
    }
  }
}
