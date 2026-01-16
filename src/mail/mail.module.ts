import { Module } from "@nestjs/common";
import { MailService } from "./mail.service";
import { SmtpProvider } from "./providers/smtp.provider";
import { SesProvider } from "./providers/ses.provider";
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
        
        // AWS SES (código mantenido para futura migración)
        // Si hay credenciales de AWS configuradas, usar SES
        if (provider === "ses" || (!process.env.MAIL_PROVIDER && (process.env.AWS_ACCESS_KEY_ID || process.env.AWS_REGION))) {
          logger.log("Usando AWS SES como proveedor de email");
          return new SesProvider();
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
