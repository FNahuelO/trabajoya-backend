import { Injectable, Inject } from "@nestjs/common";
import { MailProvider } from "./providers/mail.provider";

const MAIL_PROVIDER_TOKEN = "MAIL_PROVIDER";

@Injectable()
export class MailService {
  constructor(
    @Inject(MAIL_PROVIDER_TOKEN) private readonly provider: MailProvider
  ) {}
  async sendVerificationEmail(email: string, token: string): Promise<void> {
    // URL para deep linking a la app móvil
    const appUrl = `trabajoya://verify-email?token=${token}`;

    console.log(appUrl);

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Verifica tu email - TrabajoYa</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 40px 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #2563eb; margin: 0; font-size: 28px;">¡Bienvenido a TrabajoYa!</h1>
          </div>
          
          <div style="text-align: center; margin-bottom: 30px;">
            <p style="color: #374151; font-size: 16px; line-height: 1.5; margin: 0;">
              Gracias por registrarte. Para completar tu registro y comenzar a buscar trabajo, 
              necesitamos verificar tu dirección de email.
            </p>
          </div>
          
          <div style="text-align: center; margin: 40px 0;">
            <a href="${appUrl}" 
               style="display: inline-block; background-color: #2563eb; color: #ffffff; 
                      text-decoration: none; padding: 16px 32px; border-radius: 8px; 
                      font-size: 16px; font-weight: 600; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
              📱 Abrir en la App
            </a>
          </div>
          
        
          
          <div style="border-top: 1px solid #e5e7eb; margin-top: 40px; padding-top: 20px; text-align: center;">
            <p style="color: #9ca3af; font-size: 12px; margin: 0;">
              Este email fue enviado automáticamente. Si no te registraste en TrabajoYa, puedes ignorar este mensaje.
            </p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
¡Bienvenido a TrabajoYa!

Gracias por registrarte. Para completar tu registro y comenzar a buscar trabajo, 
necesitamos verificar tu dirección de email.

📱 Para abrir en la app móvil:
${appUrl}

Este email fue enviado automáticamente. Si no te registraste en TrabajoYa, puedes ignorar este mensaje.
    `;

    await this.provider.send({
      to: email,
      subject: "Verifica tu email - TrabajoYa",
      html,
      text,
      from: process.env.MAIL_FROM,
    });

    /*   console.log(`📧 Enviando email de verificación a: ${email}`);
    console.log(`🔗 Token de verificación: ${token}`);
    console.log(
      `🌐 URL de verificación: ${
        process.env.FRONTEND_URL || "http://localhost:3000"
      }/verify-email?token=${token}`
    ); */

    // En producción, aquí se enviaría el email real usando un servicio como:
    // - SendGrid
    // - AWS SES
    // - Nodemailer con SMTP
    // - Resend
    // - Mailgun
  }

  async sendPasswordResetEmail(email: string, token: string): Promise<void> {
    const url = `${
      process.env.APP_WEB_URL ?? "http://localhost:3000"
    }/reset?token=${token}`;
    await this.provider.send({
      to: email,
      subject: "Restablecer contraseña",
      html: `<p>Hacé clic para restablecer: <a href="${url}">${url}</a></p>`,
      text: `Restablecer contraseña: ${url}`,
      from: process.env.MAIL_FROM,
    });
  }
}
