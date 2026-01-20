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
    // URL para web como fallback
    const webUrl = `${
      process.env.APP_WEB_URL ?? "http://localhost:3000"
    }/verify-email?token=${token}`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Verifica tu email - TrabajoYa</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f4;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 0;">
          <!-- Header -->
          <div style="background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); padding: 40px 20px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700;">✨ ¡Bienvenido a TrabajoYa!</h1>
          </div>
          
          <!-- Content -->
          <div style="padding: 40px 30px;">
            <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
              Hola,
            </p>
            
            <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
              ¡Gracias por registrarte en TrabajoYa! Estamos emocionados de tenerte como parte de nuestra comunidad. 
              Para completar tu registro y comenzar a buscar oportunidades laborales, necesitamos verificar tu dirección de email.
            </p>
            
            <!-- Primary Button -->
            <div style="text-align: center; margin: 40px 0;">
              <a href="${appUrl}" 
                 style="display: inline-block; background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); 
                        color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 8px; 
                        font-size: 16px; font-weight: 600; box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);
                        transition: transform 0.2s;">
                ✅ Verificar mi Email
              </a>
            </div>
          
            
            <!-- Benefits -->
            <div style="background-color: #eff6ff; border-left: 4px solid #2563eb; padding: 20px; margin: 30px 0; border-radius: 4px;">
              <p style="color: #1e40af; font-size: 14px; margin: 0 0 12px 0; font-weight: 600;">
                🚀 Una vez verificado, podrás:
              </p>
              <ul style="color: #1e40af; font-size: 14px; margin: 0; padding-left: 20px; line-height: 1.8;">
                <li>Buscar y aplicar a ofertas de trabajo</li>
                <li>Completar tu perfil profesional</li>
                <li>Recibir notificaciones de nuevas oportunidades</li>
                <li>Conectar con empresas de tu interés</li>
              </ul>
            </div>
            
            <!-- Security Info -->
            <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; margin: 30px 0; border-radius: 4px;">
              <p style="color: #92400e; font-size: 13px; margin: 0; line-height: 1.6;">
                <strong>💡 Importante:</strong> Este enlace de verificación expirará en 24 horas por seguridad. 
                Si necesitas un nuevo enlace, puedes solicitarlo desde la aplicación.
              </p>
            </div>
          </div>
          
          <!-- Footer -->
          <div style="background-color: #f9fafb; border-top: 1px solid #e5e7eb; padding: 30px 20px; text-align: center;">
            <p style="color: #9ca3af; font-size: 12px; margin: 0 0 10px 0;">
              Este email fue enviado automáticamente por TrabajoYa
            </p>
            <p style="color: #9ca3af; font-size: 12px; margin: 0 0 20px 0;">
              Si no te registraste en TrabajoYa, puedes ignorar este mensaje de forma segura.
            </p>
            <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
              <p style="color: #6b7280; font-size: 12px; margin: 0;">
                ¿Necesitas ayuda? Contáctanos en 
                <a href="mailto:soporte@trabajo-ya.com" style="color: #2563eb; text-decoration: none;">soporte@trabajo-ya.com</a>
              </p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
✨ ¡Bienvenido a TrabajoYa!

Hola,

¡Gracias por registrarte en TrabajoYa! Estamos emocionados de tenerte como parte de nuestra comunidad. 
Para completar tu registro y comenzar a buscar oportunidades laborales, necesitamos verificar tu dirección de email.

📱 Para abrir en la app móvil:
${appUrl}

🌐 O copia este enlace en tu navegador:
${webUrl}

🚀 Una vez verificado, podrás:
- Buscar y aplicar a ofertas de trabajo
- Completar tu perfil profesional
- Recibir notificaciones de nuevas oportunidades
- Conectar con empresas de tu interés

💡 IMPORTANTE: Este enlace de verificación expirará en 24 horas por seguridad. 
Si necesitas un nuevo enlace, puedes solicitarlo desde la aplicación.

---
Este email fue enviado automáticamente por TrabajoYa
Si no te registraste en TrabajoYa, puedes ignorar este mensaje de forma segura.

¿Necesitas ayuda? Contáctanos en soporte@trabajo-ya.com
    `;

    await this.provider.send({
      to: email,
      subject: "✨ Verifica tu email - TrabajoYa",
      html,
      text,
      from: process.env.MAIL_FROM,
      headers: {
        // Headers para mejorar deliverability y evitar spam
        "List-Unsubscribe": "<mailto:unsubscribe@trabajo-ya.com>",
        "X-Priority": "3",
        "X-MSMail-Priority": "Normal",
        Precedence: "bulk",
      },
    });

    // El email se envía usando AWS SES (configurado en mail.module.ts)
  }

  async sendPasswordResetEmail(email: string, token: string): Promise<void> {
    // URL para deep linking a la app móvil
    const appUrl = `trabajoya://reset-password?token=${token}`;
    // URL para web como fallback
    const webUrl = `${
      process.env.APP_WEB_URL ?? "http://localhost:3000"
    }/reset?token=${token}`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Restablecer contraseña - TrabajoYa</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f4;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 0;">
          <!-- Header -->
          <div style="background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); padding: 40px 20px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700;">🔒 Restablecer Contraseña</h1>
          </div>
          
          <!-- Content -->
          <div style="padding: 40px 30px;">
            <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
              Hola,
            </p>
            
            <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
              Recibimos una solicitud para restablecer la contraseña de tu cuenta en TrabajoYa. 
              Si solicitaste este cambio, haz clic en el botón de abajo para continuar.
            </p>
            
            <!-- Primary Button -->
            <div style="text-align: center; margin: 40px 0;">
              <a href="${appUrl}" 
                 style="display: inline-block; background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); 
                        color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 8px; 
                        font-size: 16px; font-weight: 600; box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);
                        transition: transform 0.2s;">
                🔑 Restablecer Contraseña
              </a>
            </div>
            
            
            <!-- Security Warning -->
            <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; margin: 30px 0; border-radius: 4px;">
              <p style="color: #92400e; font-size: 14px; margin: 0 0 8px 0; font-weight: 600;">
                ⚠️ Información Importante
              </p>
              <ul style="color: #92400e; font-size: 13px; margin: 0; padding-left: 20px; line-height: 1.6;">
                <li>Este enlace expirará en 1 hora por seguridad</li>
                <li>Si no solicitaste este cambio, puedes ignorar este email</li>
                <li>Tu contraseña no cambiará hasta que completes el proceso</li>
              </ul>
            </div>
            
            <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 30px 0 0 0;">
              Si tienes problemas o no solicitaste este cambio, contáctanos inmediatamente.
            </p>
          </div>
          
          <!-- Footer -->
          <div style="background-color: #f9fafb; border-top: 1px solid #e5e7eb; padding: 30px 20px; text-align: center;">
            <p style="color: #9ca3af; font-size: 12px; margin: 0 0 10px 0;">
              Este email fue enviado automáticamente por TrabajoYa
            </p>
            <p style="color: #9ca3af; font-size: 12px; margin: 0;">
              Si no solicitaste este cambio, puedes ignorar este mensaje de forma segura.
            </p>
            <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
              <p style="color: #6b7280; font-size: 12px; margin: 0;">
                ¿Necesitas ayuda? Contáctanos en 
                <a href="mailto:soporte@trabajo-ya.com" style="color: #2563eb; text-decoration: none;">soporte@trabajo-ya.com</a>
              </p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
🔒 Restablecer Contraseña - TrabajoYa

Hola,

Recibimos una solicitud para restablecer la contraseña de tu cuenta en TrabajoYa. 
Si solicitaste este cambio, usa el siguiente enlace para continuar:

📱 Para abrir en la app móvil:
${appUrl}

🌐 O copia este enlace en tu navegador:
${webUrl}

⚠️ INFORMACIÓN IMPORTANTE:
- Este enlace expirará en 1 hora por seguridad
- Si no solicitaste este cambio, puedes ignorar este email
- Tu contraseña no cambiará hasta que completes el proceso

Si tienes problemas o no solicitaste este cambio, contáctanos inmediatamente en soporte@trabajo-ya.com

---
Este email fue enviado automáticamente por TrabajoYa
Si no solicitaste este cambio, puedes ignorar este mensaje de forma segura.
    `;

    await this.provider.send({
      to: email,
      subject: "🔒 Restablecer contraseña - TrabajoYa",
      html,
      text,
      from: process.env.MAIL_FROM,
    });
  }
}
