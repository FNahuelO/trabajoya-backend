import { Module } from "@nestjs/common";
import { MailService } from "./mail.service";
import { SmtpProvider } from "./providers/smtp.provider";
import { ResendProvider } from "./providers/resend.provider";
import { MailProvider } from "./providers/mail.provider";
import { Logger } from "@nestjs/common";

const MAIL_PROVIDER_TOKEN = "MAIL_PROVIDER";

@Module({
  providers: [
    MailService,
    {
      provide: MAIL_PROVIDER_TOKEN,
      useFactory: () => {
        const logger = new Logger("MailModule");
        const provider = process.env.MAIL_PROVIDER?.toLowerCase() || "resend";
        
        // Resend es el proveedor por defecto
        if (provider === "resend" || (!process.env.MAIL_PROVIDER && process.env.RESEND_API_KEY)) {
          logger.log("Usando Resend como proveedor de email");
          return new ResendProvider();
        }
        
        // SMTP solo para desarrollo/testing
        if (provider === "smtp") {
          logger.log("Usando SMTP como proveedor de email (solo para desarrollo)");
          return new SmtpProvider();
        }
        
        // Por defecto usar Resend
        logger.log("Usando Resend como proveedor de email (predeterminado)");
        return new ResendProvider();
      },
    },
  ],
  exports: [MailService],
})
export class MailModule {}
