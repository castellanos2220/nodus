/**
 * Puerto de almacenamiento documental.
 *
 * El brief (§32) exige que la aplicación **no** se acople a S3. Los módulos de
 * negocio dependen de esta clase abstracta; el adaptador concreto se decide en
 * `StorageModule` a partir de la configuración. Hoy hay un adaptador S3 que
 * sirve tanto para MinIO en local como para AWS/R2/Supabase en producción,
 * porque los tres hablan el mismo protocolo; añadir un adaptador de sistema de
 * archivos o de Azure Blob no tocaría ni una línea de los módulos.
 */
export abstract class StorageService {
  /** Sube un objeto. La clave debe ser única e incluir la versión. */
  abstract put(input: {
    key: string;
    body: Buffer;
    contentType: string;
    metadata?: Record<string, string>;
  }): Promise<void>;

  /** Descarga un objeto completo. */
  abstract get(key: string): Promise<Buffer>;

  /** URL firmada de descarga, con expiración. */
  abstract getSignedUrl(key: string, fileName?: string): Promise<string>;

  abstract exists(key: string): Promise<boolean>;

  /**
   * Borra un objeto. Existe para limpieza de infraestructura (p. ej. revertir
   * una subida fallida); **no** se usa para versiones históricas: una versión
   * documental publicada no se borra nunca.
   */
  abstract delete(key: string): Promise<void>;

  /** Comprobación de disponibilidad para `/health`. */
  abstract healthCheck(): Promise<boolean>;
}

/**
 * Construye la clave de almacenamiento.
 *
 * La estructura reproduce exactamente el repositorio documental del blueprint
 * operativo — Empresa → Caso → Etapa → Versión — y **la versión forma parte de
 * la clave**, de modo que subir una versión nueva no puede sobrescribir físicamente
 * a la anterior aunque alguien se equivoque en la capa de arriba.
 */
export function buildStorageKey(input: {
  companyId: string;
  caseId?: string | null;
  stage: string;
  documentId: string;
  versionNumber: number;
  fileName: string;
}): string {
  const safeName = input.fileName
    .normalize('NFD')
    .replace(/[^A-Za-z0-9._-]/g, '_')
    .slice(0, 120);

  const scope = input.caseId ? `cases/${input.caseId}` : 'company';

  return [
    'companies',
    input.companyId,
    scope,
    input.stage.toLowerCase(),
    input.documentId,
    `v${input.versionNumber}`,
    safeName,
  ].join('/');
}
