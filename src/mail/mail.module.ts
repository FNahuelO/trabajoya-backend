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
        const hasResendKey = process.env.RESEND_API_KEY && process.env.RESEND_API_KEY !== "";
        
        // Si hay RESEND_API_KEY configurado, usar Resend
        if (hasResendKey && (provider === "resend" || !process.env.MAIL_PROVIDER)) {
          logger.log("Usando Resend como proveedor de email");
          return new ResendProvider();
        }
        
        // Si no hay RESEND_API_KEY pero se solicita Resend, usar Resend de todas formas
        // (permitirá que el servidor inicie, pero fallará al enviar emails)
        if (provider === "resend") {
          logger.warn("RESEND_API_KEY no configurado, pero usando Resend (el servidor iniciará pero los emails fallarán)");
          return new ResendProvider();
        }
        
        // SMTP como fallback si está configurado
        if (provider === "smtp") {
          logger.log("Usando SMTP como proveedor de email");
          return new SmtpProvider();
        }
        
        // Por defecto usar Resend (permitirá que el servidor inicie)
        logger.warn("Usando Resend como proveedor de email (predeterminado). Configure RESEND_API_KEY para que funcione correctamente.");
        return new ResendProvider();
      },
    },
  ],
  exports: [MailService],
})
export class MailModule {}
