import { MailProvider } from "./mail.provider";
import { Resend } from "resend";
import { Logger } from "@nestjs/common";

export class ResendProvider implements MailProvider {
  private readonly logger = new Logger(ResendProvider.name);
  private client: Resend;

  constructor() {
    const apiKey = process.env.RESEND_API_KEY;
    
    if (!apiKey) {
      this.logger.warn(
        "RESEND_API_KEY no está configurado. El servicio de email no funcionará correctamente."
      );
    }

    this.client = new Resend(apiKey);
    this.logger.log("Resend Provider inicializado");
  }

  async send({
    to,
    subject,
    html,
    text,
    from,
  }: {
    to: string | string[];
    subject: string;
    html?: string;
    text?: string;
    from?: string;
  }): Promise<void> {
    try {
      const fromEmail = from || process.env.MAIL_FROM;
      
      if (!fromEmail) {
        throw new Error(
          "MAIL_FROM no está configurado. Debe ser un email verificado en Resend."
        );
      }

      // Validar que el email "from" esté configurado
      if (!fromEmail.includes("@")) {
        throw new Error(`Email "from" inválido: ${fromEmail}`);
      }

      // Resend acepta un string o array de strings para 'to'
      const { data, error } = await this.client.emails.send({
        from: fromEmail,
        to: to, // Resend acepta string o array directamente
        subject,
        html: html || text || "",
        text: text,
      });

      if (error) {
        this.logger.error(`Error enviando email con Resend: ${error.message}`, error);
        throw new Error(`Error enviando email con Resend: ${error.message}`);
      }

      const recipients = Array.isArray(to) ? to : [to];
      this.logger.log(
        `Email enviado exitosamente a ${recipients.join(", ")}. MessageId: ${data?.id}`
      );
    } catch (error: any) {
      this.logger.error(`Error enviando email con Resend: ${error.message}`, error.stack);
      throw error;
    }
  }
}

