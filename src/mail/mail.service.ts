import { Injectable, Inject } from "@nestjs/common";
import { MailProvider } from "./providers/mail.provider";

const MAIL_PROVIDER_TOKEN = "MAIL_PROVIDER";

@Injectable()
export class MailService {
  constructor(
    @Inject(MAIL_PROVIDER_TOKEN) private readonly provider: MailProvider
  ) {}

  /**
   * Genera un botón HTML compatible con todas las plataformas (Outlook, Gmail, Apple Mail, etc.)
   * Usa tablas anidadas para máxima compatibilidad con Outlook
   */
  private createEmailButton(text: string, url: string, backgroundColor: string = "#2563eb"): string {
    return `
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 40px auto;">
        <tr>
          <td align="center">
            <!--[if mso]>
            <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" 
                         href="${url}" style="height:50px;v-text-anchor:middle;width:200px;" 
                         arcsize="8%" stroke="f" fillcolor="${backgroundColor}">
              <w:anchorlock/>
              <center style="color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:600;">
                ${text}
              </center>
            </v:roundrect>
            <![endif]-->
            <!--[if !mso]><!-->
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 0 auto;">
              <tr>
                <td align="center" style="background-color: ${backgroundColor}; border-radius: 8px; padding: 0;">
                  <a href="${url}" 
                     style="display: inline-block; padding: 16px 40px; 
                            background-color: ${backgroundColor}; color: #ffffff; 
                            text-decoration: none; font-size: 16px; font-weight: 600; 
                            font-family: Arial, Helvetica, sans-serif; line-height: 1.5;
                            border-radius: 8px;">
                    ${text}
                  </a>
                </td>
              </tr>
            </table>
            <!--<![endif]-->
          </td>
        </tr>
      </table>
    `;
  }

  async sendVerificationEmail(email: string, token: string): Promise<void> {
    // URL para deep linking a la app móvil
    const appUrl = `trabajoya://verify-email?token=${token}`;
    // URL para web como fallback
    const webUrl = `${
      process.env.APP_WEB_URL ?? "http://localhost:3000"
    }/verify-email?token=${token}`;

    const html = `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
        <title>Verifica tu email - TrabajoYa</title>
        <!--[if !mso]><!-->
        <style type="text/css">
          .preheader { display: none !important; visibility: hidden; opacity: 0; color: transparent; height: 0; width: 0; }
        </style>
        <!--<![endif]-->
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f4;">
        <!-- Preheader text for email clients -->
        <div class="preheader" style="display: none; visibility: hidden; opacity: 0; color: transparent; height: 0; width: 0;">
          Verifica tu dirección de correo electrónico para activar tu cuenta en TrabajoYa
        </div>
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 0;">
          <!-- Header -->
          <div style="background-color: #2563eb; padding: 40px 20px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700;">✨ ¡Bienvenido a TrabajoYa!</h1>
          </div>
          
          <!-- Content -->
          <div style="padding: 40px 30px;">
            <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
              Hola,
            </p>
            
            <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
              Gracias por registrarte en TrabajoYa. Para completar tu registro y comenzar a buscar oportunidades laborales, necesitamos verificar tu dirección de correo electrónico.
            </p>
            
            <!-- Primary Button -->
            ${this.createEmailButton("✅ Verificar mi Email", appUrl, "#2563eb")}
            
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

    const text = `Bienvenido a TrabajoYa

Hola,

Gracias por registrarte en TrabajoYa. Para completar tu registro y comenzar a buscar oportunidades laborales, necesitamos verificar tu dirección de correo electrónico.

Para verificar tu cuenta, visita:
${webUrl}

Una vez verificado, podrás:
- Buscar y aplicar a ofertas de trabajo
- Completar tu perfil profesional
- Recibir notificaciones de nuevas oportunidades
- Conectar con empresas de tu interés

Este enlace de verificación expirará en 24 horas por seguridad.

---
Este correo fue enviado automáticamente por TrabajoYa.
Si no te registraste en TrabajoYa, puedes ignorar este mensaje de forma segura.

¿Necesitas ayuda? Contáctanos en soporte@trabajo-ya.com`;

    // Generar un Message-ID único y bien formateado (RFC 5322)
    const domain = process.env.MAIL_FROM?.split('@')[1] || 'trabajo-ya.com';
    const messageId = `<${Date.now()}.${Math.random().toString(36).substring(2, 15)}@${domain}>`;
    const unsubscribeUrl = process.env.APP_WEB_URL 
      ? `${process.env.APP_WEB_URL}/unsubscribe?email=${encodeURIComponent(email)}`
      : `mailto:unsubscribe@trabajo-ya.com?subject=Unsubscribe&body=Please unsubscribe ${encodeURIComponent(email)}`;

    await this.provider.send({
      to: email,
      subject: "Verifica tu cuenta de TrabajoYa",
      html,
      text,
      from: process.env.MAIL_FROM,
      headers: {
        // Headers para mejorar deliverability y evitar spam
        "Message-ID": messageId,
        "Reply-To": process.env.MAIL_REPLY_TO || "soporte@trabajo-ya.com",
        "List-Unsubscribe": `<${unsubscribeUrl}>, <mailto:unsubscribe@trabajo-ya.com?subject=Unsubscribe>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        "X-Mailer": "TrabajoYa",
        "X-Auto-Response-Suppress": "All",
        "Importance": "normal",
        "MIME-Version": "1.0",
        // Removido X-Priority ya que puede ser visto como spam
        // El proveedor de email maneja Content-Type automáticamente
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
      <html lang="es">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
        <title>Restablecer contraseña - TrabajoYa</title>
        <!--[if !mso]><!-->
        <style type="text/css">
          .preheader { display: none !important; visibility: hidden; opacity: 0; color: transparent; height: 0; width: 0; }
        </style>
        <!--<![endif]-->
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f4;">
        <!-- Preheader text for email clients -->
        <div class="preheader" style="display: none; visibility: hidden; opacity: 0; color: transparent; height: 0; width: 0;">
          Restablece la contraseña de tu cuenta en TrabajoYa usando el enlace seguro
        </div>
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 0;">
          <!-- Header -->
          <div style="background-color: #2563eb; padding: 40px 20px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700;">🔒 Restablecer Contraseña</h1>
          </div>
          
          <!-- Content -->
          <div style="padding: 40px 30px;">
            <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
              Hola,
            </p>
            
            <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
              Recibimos una solicitud para restablecer la contraseña de tu cuenta en TrabajoYa. 
              Si solicitaste este cambio, haz clic en el botón para continuar.
            </p>
            
            <!-- Primary Button -->
            ${this.createEmailButton("🔑 Restablecer Contraseña", appUrl, "#2563eb")}
            
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

    const text = `Restablecer Contraseña - TrabajoYa

Hola,

Recibimos una solicitud para restablecer la contraseña de tu cuenta en TrabajoYa. 
Si solicitaste este cambio, usa el siguiente enlace para continuar:

${webUrl}

INFORMACIÓN IMPORTANTE:
- Este enlace expirará en 1 hora por seguridad
- Si no solicitaste este cambio, puedes ignorar este correo
- Tu contraseña no cambiará hasta que completes el proceso

Si tienes problemas o no solicitaste este cambio, contáctanos inmediatamente en soporte@trabajo-ya.com

---
Este correo fue enviado automáticamente por TrabajoYa.
Si no solicitaste este cambio, puedes ignorar este mensaje de forma segura.`;

    // Generar un Message-ID único y bien formateado (RFC 5322)
    const domain = process.env.MAIL_FROM?.split('@')[1] || 'trabajo-ya.com';
    const messageId = `<${Date.now()}.${Math.random().toString(36).substring(2, 15)}@${domain}>`;
    const unsubscribeUrl = process.env.APP_WEB_URL 
      ? `${process.env.APP_WEB_URL}/unsubscribe?email=${encodeURIComponent(email)}`
      : `mailto:unsubscribe@trabajo-ya.com?subject=Unsubscribe&body=Please unsubscribe ${encodeURIComponent(email)}`;

    await this.provider.send({
      to: email,
      subject: "Restablecer contraseña de TrabajoYa",
      html,
      text,
      from: process.env.MAIL_FROM,
      headers: {
        // Headers para mejorar deliverability y evitar spam
        "Message-ID": messageId,
        "Reply-To": process.env.MAIL_REPLY_TO || "soporte@trabajo-ya.com",
        "List-Unsubscribe": `<${unsubscribeUrl}>, <mailto:unsubscribe@trabajo-ya.com?subject=Unsubscribe>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        "X-Mailer": "TrabajoYa",
        "X-Auto-Response-Suppress": "All",
        "Importance": "normal",
        "MIME-Version": "1.0",
        // Removido X-Priority ya que puede ser visto como spam
        // El proveedor de email maneja Content-Type automáticamente
      },
    });
  }

  async sendJobApprovalEmail(
    email: string,
    jobTitle: string,
    companyName: string,
    jobId: string
  ): Promise<void> {
    // URL para ver el empleo en la app móvil
    const appUrl = `trabajoya://job/${jobId}`;
    // URL para web como fallback
    const webUrl = `${
      process.env.APP_WEB_URL ?? "http://localhost:3000"
    }/empresa/empleos/${jobId}`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Publicación Aprobada - TrabajoYa</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f4;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 0;">
          <!-- Header -->
          <div style="background-color: #10b981; padding: 40px 20px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700;">✅ ¡Tu publicación ha sido aprobada!</h1>
          </div>
          
          <!-- Content -->
          <div style="padding: 40px 30px;">
            <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
              Hola${companyName ? ` ${companyName}` : ""},
            </p>
            
            <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
              Nos complace informarte que tu publicación de empleo <strong>"${jobTitle}"</strong> ha sido revisada y <strong>aprobada</strong>.
            </p>
            
            <div style="background-color: #d1fae5; border-left: 4px solid #10b981; padding: 20px; margin: 30px 0; border-radius: 4px;">
              <p style="color: #065f46; font-size: 16px; margin: 0 0 12px 0; font-weight: 600;">
                🎉 ¡Tu empleo ya está activo!
              </p>
              <p style="color: #065f46; font-size: 14px; margin: 0; line-height: 1.6;">
                Los postulantes ahora pueden ver y aplicar a tu oferta de trabajo. Tu publicación está visible en la plataforma y comenzará a recibir aplicaciones.
              </p>
            </div>
            
            <!-- Primary Button -->
            ${this.createEmailButton("Ver mi Publicación", appUrl, "#10b981")}
            
            <!-- Next Steps -->
            <div style="background-color: #eff6ff; border-left: 4px solid #2563eb; padding: 20px; margin: 30px 0; border-radius: 4px;">
              <p style="color: #1e40af; font-size: 14px; margin: 0 0 12px 0; font-weight: 600;">
                📋 Próximos pasos:
              </p>
              <ul style="color: #1e40af; font-size: 14px; margin: 0; padding-left: 20px; line-height: 1.8;">
                <li>Revisa las aplicaciones que recibas</li>
                <li>Contacta a los candidatos que más te interesen</li>
                <li>Gestiona tu publicación desde tu panel de empresa</li>
                <li>Considera promocionar tu empleo para mayor visibilidad</li>
              </ul>
            </div>
            
            <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 30px 0 0 0;">
              Si tienes alguna pregunta o necesitas ayuda, no dudes en contactarnos.
            </p>
          </div>
          
          <!-- Footer -->
          <div style="background-color: #f9fafb; border-top: 1px solid #e5e7eb; padding: 30px 20px; text-align: center;">
            <p style="color: #9ca3af; font-size: 12px; margin: 0 0 10px 0;">
              Este email fue enviado automáticamente por TrabajoYa
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

    const text = `Publicación Aprobada - TrabajoYa

Hola${companyName ? ` ${companyName}` : ""},

Nos complace informarte que tu publicación de empleo "${jobTitle}" ha sido revisada y aprobada.

🎉 ¡Tu empleo ya está activo!

Los postulantes ahora pueden ver y aplicar a tu oferta de trabajo. Tu publicación está visible en la plataforma y comenzará a recibir aplicaciones.

Ver tu publicación:
${webUrl}

Próximos pasos:
- Revisa las aplicaciones que recibas
- Contacta a los candidatos que más te interesen
- Gestiona tu publicación desde tu panel de empresa
- Considera promocionar tu empleo para mayor visibilidad

Si tienes alguna pregunta o necesitas ayuda, no dudes en contactarnos en soporte@trabajo-ya.com

---
Este correo fue enviado automáticamente por TrabajoYa.`;

    // Generar un Message-ID único y bien formateado (RFC 5322)
    const domain = process.env.MAIL_FROM?.split('@')[1] || 'trabajo-ya.com';
    const messageId = `<${Date.now()}.${Math.random().toString(36).substring(2, 15)}@${domain}>`;
    const unsubscribeUrl = process.env.APP_WEB_URL 
      ? `${process.env.APP_WEB_URL}/unsubscribe?email=${encodeURIComponent(email)}`
      : `mailto:unsubscribe@trabajo-ya.com?subject=Unsubscribe&body=Please unsubscribe ${encodeURIComponent(email)}`;

    await this.provider.send({
      to: email,
      subject: `✅ Tu publicación "${jobTitle}" ha sido aprobada`,
      html,
      text,
      from: process.env.MAIL_FROM,
      headers: {
        // Headers para mejorar deliverability y evitar spam
        "Message-ID": messageId,
        "Reply-To": process.env.MAIL_REPLY_TO || "soporte@trabajo-ya.com",
        "List-Unsubscribe": `<${unsubscribeUrl}>, <mailto:unsubscribe@trabajo-ya.com?subject=Unsubscribe>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        "X-Mailer": "TrabajoYa",
        "X-Auto-Response-Suppress": "All",
        "Importance": "normal",
        "MIME-Version": "1.0",
        // Removido X-Priority ya que puede ser visto como spam
        // El proveedor de email maneja Content-Type automáticamente
      },
    });
  }
}
