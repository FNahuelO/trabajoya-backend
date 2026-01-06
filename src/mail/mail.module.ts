import { Module } from "@nestjs/common";
import { MailService } from "./mail.service";
import { SmtpProvider } from "./providers/smtp.provider";
import { SesProvider } from "./providers/ses.provider";
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
        const provider = process.env.MAIL_PROVIDER?.toLowerCase() || "ses";
        
        // AWS SES es el proveedor por defecto
        // Si hay credenciales de AWS configuradas o no se especifica otro proveedor, usar SES
        if (provider === "ses" || (!process.env.MAIL_PROVIDER && (process.env.AWS_ACCESS_KEY_ID || process.env.AWS_REGION))) {
          logger.log("Usando AWS SES como proveedor de email");
          return new SesProvider();
        }
        
        // SMTP solo para desarrollo/testing
        if (provider === "smtp") {
          logger.log("Usando SMTP como proveedor de email (solo para desarrollo)");
          return new SmtpProvider();
        }
        
        // Por defecto usar SES
        logger.log("Usando AWS SES como proveedor de email (predeterminado)");
        return new SesProvider();
      },
    },
  ],
  exports: [MailService],
})
export class MailModule {}
