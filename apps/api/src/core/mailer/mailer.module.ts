import { Global, Module } from '@nestjs/common';
import { MailerService } from './mailer.service';
import { SmtpMailerService } from './smtp-mailer.service';

@Global()
@Module({
  providers: [{ provide: MailerService, useClass: SmtpMailerService }],
  exports: [MailerService],
})
export class MailerModule {}
