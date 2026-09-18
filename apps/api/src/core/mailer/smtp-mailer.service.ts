import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { type Transporter } from 'nodemailer';
import type { AppConfig } from '../config/configuration';
import { MailerService, type MailMessage } from './mailer.service';

@Injectable()
export class SmtpMailerService extends MailerService {
  private readonly logger = new Logger(SmtpMailerService.name);
  private readonly transporter: Transporter;
  private readonly from: string;

  constructor(config: ConfigService<AppConfig, true>) {
    super();
    const mail = config.get('mail', { infer: true });
    this.from = mail.from;

    this.transporter = nodemailer.createTransport({
      host: mail.host,
      port: mail.port,
      secure: mail.secure,
      auth: mail.user ? { user: mail.user, pass: mail.password } : undefined,
      // Mailpit no presenta certificado válido; en producción `secure: true`
      // más un host real hace que esto no aplique.
      tls: { rejectUnauthorized: mail.secure },
      pool: true,
      maxConnections: 3,
    });
  }

  async send(message: MailMessage): Promise<void> {
    await this.transporter.sendMail({
      from: this.from,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
      replyTo: message.replyTo,
    });
    this.logger.debug(`Correo enviado a ${message.to}: ${message.subject}`);
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.transporter.verify();
      return true;
    } catch {
      return false;
    }
  }
}
