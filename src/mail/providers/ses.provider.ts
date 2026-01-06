import { MailProvider } from "./mail.provider";
import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";
import { Logger } from "@nestjs/common";

export class SesProvider implements MailProvider {
  private readonly logger = new Logger(SesProvider.name);
  private client: SESv2Client;

  constructor() {
    // Configurar cliente SES con credenciales de AWS
    // En producción, las credenciales pueden venir de:
    // 1. Variables de entorno (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY)
    // 2. IAM roles (si está ejecutándose en EC2/ECS/Lambda)
    // 3. Perfiles de AWS (~/.aws/credentials)
    const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "us-east-1";
    
    const clientConfig: any = {
      region,
    };

    // Si hay credenciales explícitas en variables de entorno, usarlas
    // (útil para desarrollo local o cuando no se usan IAM roles)
    if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
      clientConfig.credentials = {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      };
      this.logger.log("Usando credenciales AWS desde variables de entorno");
    } else {
      this.logger.log("Usando credenciales AWS desde IAM role o perfil local");
    }

    this.client = new SESv2Client(clientConfig);
    this.logger.log(`SES Provider inicializado para región: ${region}`);
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
      const FromEmailAddress = from || process.env.MAIL_FROM;
      
      if (!FromEmailAddress) {
        throw new Error(
          "MAIL_FROM no está configurado. Debe ser un email verificado en AWS SES."
        );
      }

      const Destination = { ToAddresses: Array.isArray(to) ? to : [to] };

      // Validar que el email "from" esté configurado
      // En el free tier de AWS SES, el email "from" debe estar verificado
      if (!FromEmailAddress.includes("@")) {
        throw new Error(`Email "from" inválido: ${FromEmailAddress}`);
      }

      const command = new SendEmailCommand({
        FromEmailAddress,
        Destination,
        Content: {
          Simple: {
            Subject: { Data: subject },
            Body: {
              Html: html ? { Data: html } : undefined,
              Text: text ? { Data: text } : undefined,
            },
          },
        },
      });

      const response = await this.client.send(command);
      
      this.logger.log(
        `Email enviado exitosamente a ${Array.isArray(to) ? to.join(", ") : to}. MessageId: ${response.MessageId}`
      );
    } catch (error: any) {
      this.logger.error(`Error enviando email con SES: ${error.message}`, error.stack);
      
      // Proporcionar mensajes de error más descriptivos
      if (error.name === "MessageRejected") {
        throw new Error(
          `El email fue rechazado por AWS SES. Verifica que el email "from" (${from || process.env.MAIL_FROM}) esté verificado en AWS SES.`
        );
      }
      
      if (error.name === "AccountSendingPausedException") {
        throw new Error(
          "El envío de emails está pausado en tu cuenta de AWS SES. Revisa el estado de tu cuenta en la consola de AWS."
        );
      }
      
      if (error.name === "ConfigurationSetDoesNotExistException") {
        throw new Error(
          "El conjunto de configuración de SES no existe. Verifica la configuración en AWS SES."
        );
      }

      throw error;
    }
  }
}
