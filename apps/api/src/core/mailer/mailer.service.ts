export interface MailMessage {
  to: string;
  subject: string;
  /** Cuerpo en texto plano. Las plantillas TCOM se redactan en texto. */
  text: string;
  html?: string;
  replyTo?: string;
}

/**
 * Puerto de envío de correo. Igual que con el storage, los módulos dependen de
 * la abstracción: hoy hay un adaptador SMTP (Mailpit en local, cualquier SMTP en
 * producción); añadir Resend o SES sería otro adaptador y una línea en el módulo.
 */
export abstract class MailerService {
  abstract send(message: MailMessage): Promise<void>;
  abstract healthCheck(): Promise<boolean>;
}
