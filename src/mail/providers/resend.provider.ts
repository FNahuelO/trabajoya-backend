import { MailProvider } from "./mail.provider";
import { Resend } from "resend";
import { Logger } from "@nestjs/common";

export class ResendProvider implements MailProvider {
  private readonly logger = new Logger(ResendProvider.name);
  private client: Resend | null = null;
  private apiKey: string | undefined;

  constructor() {
    this.apiKey = process.env.RESEND_API_KEY;

    if (!this.apiKey) {
      this.logger.warn(
        "RESEND_API_KEY no está configurado. El servicio de email no funcionará correctamente."
      );
    } else {
      // Solo inicializar el cliente si hay API key válida
      try {
        this.client = new Resend(this.apiKey);
        this.logger.log("Resend Provider inicializado correctamente");
      } catch (error: any) {
        this.logger.error(`Error inicializando Resend: ${error.message}`);
        this.client = null;
      }
    }
  }

  private getClient(): Resend {
    if (!this.client) {
      if (!this.apiKey) {
        throw new Error("RESEND_API_KEY no está configurado");
      }
      this.client = new Resend(this.apiKey);
    }
    return this.client;
  }

  async send({
    to,
    subject,
    html,
    text,
    from,
    headers,
  }: {
    to: string | string[];
    subject: string;
    html?: string;
    text?: string;
    from?: string;
    headers?: Record<string, string>;
  }): Promise<void> {
    // Verificar que la API key esté configurada antes de intentar enviar
    if (
      !process.env.RESEND_API_KEY ||
      process.env.RESEND_API_KEY === "dummy-key-for-initialization"
    ) {
      this.logger.error(
        "RESEND_API_KEY no está configurado. No se puede enviar el email."
      );
      throw new Error(
        "RESEND_API_KEY no está configurado. Configure la variable de entorno o use otro proveedor de email."
      );
    }

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
      const client = this.getClient();
      const { data, error } = await client.emails.send({
        from: fromEmail,
        to: to, // Resend acepta string o array directamente
        subject,
        html: html || text || "",
        text: text,
        headers: headers,
      });

      if (error) {
        this.logger.error(
          `Error enviando email con Resend: ${error.message}`,
          error
        );
        throw new Error(`Error enviando email con Resend: ${error.message}`);
      }

      const recipients = Array.isArray(to) ? to : [to];
      this.logger.log(
        `Email enviado exitosamente a ${recipients.join(", ")}. MessageId: ${
          data?.id
        }`
      );
    } catch (error: any) {
      this.logger.error(
        `Error enviando email con Resend: ${error.message}`,
        error.stack
      );
      throw error;
    }
  }
}
