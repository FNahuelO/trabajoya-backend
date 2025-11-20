import { Module } from "@nestjs/common";
import { MailService } from "./mail.service";
import { SmtpProvider } from "./providers/smtp.provider";
import { SesProvider } from "./providers/ses.provider";
import { ResendProvider } from "./providers/resend.provider";
import { MailProvider } from "./providers/mail.provider";

const MAIL_PROVIDER_TOKEN = "MAIL_PROVIDER";

@Module({
  providers: [
    MailService,
    {
      provide: MAIL_PROVIDER_TOKEN,
      useFactory: () => {
        const provider = process.env.MAIL_PROVIDER || "smtp";
        if (provider === "ses") {
          return new SesProvider();
        }
        if (provider === "resend") {
          return new ResendProvider();
        }
        return new SmtpProvider();
      },
    },
  ],
  exports: [MailService],
})
export class MailModule {}
