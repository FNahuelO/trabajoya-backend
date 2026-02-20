import { Injectable, Inject } from "@nestjs/common";
import { MailProvider } from "./providers/mail.provider";

const MAIL_PROVIDER_TOKEN = "MAIL_PROVIDER";

@Injectable()
export class MailService {
  constructor(
    @Inject(MAIL_PROVIDER_TOKEN) private readonly provider: MailProvider
  ) { }

  /**
   * Construye una URL HTTPS para la aplicación web
   * Centraliza la generación de URLs usando APP_WEB_URL como base
   * Prioriza APP_WEB_URL, luego FRONTEND_URL, y finalmente usa un fallback seguro
   */
  private buildAppLink(path: string, query?: Record<string, string>): string {
    // Priorizar APP_WEB_URL, luego FRONTEND_URL, y finalmente usar un fallback de producción
    let baseUrl = process.env.APP_WEB_URL || process.env.FRONTEND_URL;

    // Si no hay URL configurada, usar fallback según el entorno
    if (!baseUrl) {
      if (process.env.NODE_ENV === 'production') {
        // En producción, usar el dominio principal
        baseUrl = 'https://trabajo-ya.com';
      } else {
        // En desarrollo, usar localhost
        baseUrl = 'http://localhost:3000';
      }
    }

    // Asegurar que la URL base termine con / para evitar problemas con new URL()
    if (!baseUrl.endsWith('/')) {
      baseUrl += '/';
    }

    // Construir la URL completa
    const url = new URL(path.startsWith('/') ? path.substring(1) : path, baseUrl);

    // Agregar parámetros de query si existen
    if (query) {
      Object.entries(query).forEach(([key, value]) => {
        url.searchParams.append(key, value);
      });
    }

    // En producción, forzar HTTPS
    if (process.env.NODE_ENV === 'production' && url.protocol === 'http:') {
      url.protocol = 'https:';
    }

    return url.toString();
  }

  /**
   * Construye una URL HTTPS para el portal web de empresas
   * Usa WEB_EMPRESAS_URL como base, con fallback a empresas.trabajo-ya.com
   */
  private buildEmpresasLink(path: string, query?: Record<string, string>): string {
    let baseUrl = process.env.WEB_EMPRESAS_URL;

    if (!baseUrl) {
      if (process.env.NODE_ENV === 'production') {
        baseUrl = 'https://empresas.trabajo-ya.com';
      } else {
        baseUrl = 'http://localhost:3000';
      }
    }

    if (!baseUrl.endsWith('/')) {
      baseUrl += '/';
    }

    const url = new URL(path.startsWith('/') ? path.substring(1) : path, baseUrl);

    if (query) {
      Object.entries(query).forEach(([key, value]) => {
        url.searchParams.append(key, value);
      });
    }

    if (process.env.NODE_ENV === 'production' && url.protocol === 'http:') {
      url.protocol = 'https:';
    }

    return url.toString();
  }

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

  async sendVerificationEmail(email: string, token: string, userType?: string, lang: string = "es"): Promise<void> {
    // Para EMPRESA: enlace directo al portal web-empresas
    // Para POSTULANTE (u otros): enlace a la web principal que redirige a la app vía deep link
    const actionUrl = userType === 'EMPRESA'
      ? this.buildEmpresasLink("/verificar-email", { token })
      : this.buildAppLink("/app/verify-email", { token });

    const LOGO_URL = "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/icon-blanco-jkfiLxis7MIQA4G57Mqpv0A1Wgs9wA.png";
    const LOGO_FULL_URL = this.buildAppLink("/logo.png");

    // Traducciones por idioma
    const translations: Record<string, Record<string, string>> = {
      es: {
        subject: "Verifica tu cuenta de TrabajoYa",
        preheader: "Verifica tu dirección de correo electrónico para activar tu cuenta en TrabajoYa",
        title: "Bienvenido a TrabajoYa",
        greeting: "Hola,",
        description: "Gracias por registrarte en",
        descriptionCta: "Para completar tu registro y comenzar a buscar oportunidades laborales, necesitamos verificar tu correo electrónico.",
        buttonText: "Verificar mi Email",
        benefitsTitle: "Una vez verificado, podrás:",
        benefit1: "Buscar y aplicar a ofertas de trabajo",
        benefit2: "Completar tu perfil profesional",
        benefit3: "Recibir notificaciones de nuevas oportunidades",
        benefit4: "Conectar con empresas de tu interés",
        expirationImportant: "Importante:",
        expirationDesc: "Este enlace de verificación expirará en 24 horas por seguridad. Si necesitas un nuevo enlace, puedes solicitarlo desde la aplicación.",
        footerAutoEmail: "Este email fue enviado automáticamente por TrabajoYa.",
        footerIgnore: "Si no te registraste en TrabajoYa, puedes ignorar este mensaje.",
        footerHelp: "¿Necesitas ayuda?",
        textPlainTitle: "Bienvenido a TrabajoYa",
        textPlainVerifyLink: "Para verificar tu cuenta, visita:",
        textPlainBenefits: "Una vez verificado, podrás:",
        textPlainExpiry: "Este enlace de verificación expirará en 24 horas por seguridad.",
        textPlainContact: "¿Necesitas ayuda? Contáctanos en soporte@trabajo-ya.com",
      },
      en: {
        subject: "Verify your TrabajoYa account",
        preheader: "Verify your email address to activate your TrabajoYa account",
        title: "Welcome to TrabajoYa",
        greeting: "Hello,",
        description: "Thank you for signing up at",
        descriptionCta: "To complete your registration and start looking for job opportunities, we need to verify your email address.",
        buttonText: "Verify my Email",
        benefitsTitle: "Once verified, you'll be able to:",
        benefit1: "Search and apply to job offers",
        benefit2: "Complete your professional profile",
        benefit3: "Receive notifications for new opportunities",
        benefit4: "Connect with companies you're interested in",
        expirationImportant: "Important:",
        expirationDesc: "This verification link will expire in 24 hours for security. If you need a new link, you can request one from the app.",
        footerAutoEmail: "This email was sent automatically by TrabajoYa.",
        footerIgnore: "If you didn't sign up for TrabajoYa, you can ignore this message.",
        footerHelp: "Need help?",
        textPlainTitle: "Welcome to TrabajoYa",
        textPlainVerifyLink: "To verify your account, visit:",
        textPlainBenefits: "Once verified, you'll be able to:",
        textPlainExpiry: "This verification link will expire in 24 hours for security.",
        textPlainContact: "Need help? Contact us at soporte@trabajo-ya.com",
      },
      pt: {
        subject: "Verifique sua conta do TrabajoYa",
        preheader: "Verifique seu endereço de e-mail para ativar sua conta no TrabajoYa",
        title: "Bem-vindo ao TrabajoYa",
        greeting: "Olá,",
        description: "Obrigado por se registrar no",
        descriptionCta: "Para completar seu registro e começar a buscar oportunidades de emprego, precisamos verificar seu e-mail.",
        buttonText: "Verificar meu E-mail",
        benefitsTitle: "Uma vez verificado, você poderá:",
        benefit1: "Buscar e candidatar-se a vagas de emprego",
        benefit2: "Completar seu perfil profissional",
        benefit3: "Receber notificações de novas oportunidades",
        benefit4: "Conectar-se com empresas do seu interesse",
        expirationImportant: "Importante:",
        expirationDesc: "Este link de verificação expirará em 24 horas por segurança. Se precisar de um novo link, pode solicitá-lo pelo aplicativo.",
        footerAutoEmail: "Este e-mail foi enviado automaticamente pelo TrabajoYa.",
        footerIgnore: "Se você não se registrou no TrabajoYa, pode ignorar esta mensagem.",
        footerHelp: "Precisa de ajuda?",
        textPlainTitle: "Bem-vindo ao TrabajoYa",
        textPlainVerifyLink: "Para verificar sua conta, acesse:",
        textPlainBenefits: "Uma vez verificado, você poderá:",
        textPlainExpiry: "Este link de verificação expirará em 24 horas por segurança.",
        textPlainContact: "Precisa de ajuda? Entre em contato em soporte@trabajo-ya.com",
      },
    };

    const t = translations[lang] || translations["es"];

    const html = `
      <!DOCTYPE html>
      <html lang="${lang}">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
        <title>${t.subject}</title>
        <!--[if !mso]><!-->
        <style type="text/css">
          .preheader { display: none !important; visibility: hidden; opacity: 0; color: transparent; height: 0; width: 0; }
        </style>
        <!--<![endif]-->
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f4;">
        <!-- Preheader text for email clients -->
        <div class="preheader" style="display: none; visibility: hidden; opacity: 0; color: transparent; height: 0; width: 0;">
          ${t.preheader}
        </div>
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 0;">

          <!-- Header -->
          <div style="background-color: #0f2b4e; padding: 40px 32px; text-align: center; position: relative; overflow: hidden;">
            <img src="${LOGO_URL}" alt="TrabajoYa" style="height: 48px; width: auto; margin-bottom: 16px;" />
            <p style="margin: 0 0 4px 0; font-size: 11px; font-weight: 600; letter-spacing: 0.2em; text-transform: uppercase; color: rgba(255,255,255,0.5);">
              TrabajoYa
            </p>
            <h1 style="margin: 0; font-size: 20px; font-weight: 700; color: #ffffff; letter-spacing: -0.025em;">
              ${t.title}
            </h1>
          </div>

          <!-- Body -->
          <div style="padding: 40px 32px;">
            <!-- Greeting & Description -->
            <p style="margin: 0 0 12px 0; font-size: 15px; line-height: 1.6; color: #1a1a2e;">
              ${t.greeting}
            </p>
            <p style="margin: 0 0 24px 0; font-size: 15px; line-height: 1.6; color: #4a4a5a;">
              ${t.description} <span style="font-weight: 600; color: #0f2b4e;">TrabajoYa</span>.
              ${t.descriptionCta}
            </p>

            <!-- CTA Button -->
            ${this.createEmailButton(t.buttonText, actionUrl, "#2e9e39")}

            <!-- Benefits -->
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-top: 8px;">
              <tr>
                <td style="border: 1px solid #e8f0e8; border-radius: 8px; background-color: #f0f8f0; padding: 20px;">
                  <p style="margin: 0 0 12px 0; font-size: 13px; font-weight: 600; color: #1a5c24;">
                    ${t.benefitsTitle}
                  </p>
                  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                    <!-- Benefit 1 -->
                    <tr>
                      <td style="padding: 0 0 10px 0;">
                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                          <tr>
                            <td style="vertical-align: middle; width: 28px;">
                              <div style="width: 28px; height: 28px; border-radius: 6px; background-color: rgba(46,158,57,0.1); text-align: center; line-height: 28px; font-size: 14px;">
                                &#128188;
                              </div>
                            </td>
                            <td style="vertical-align: middle; padding-left: 10px;">
                              <p style="margin: 0; font-size: 13px; color: #2a5c2a;">${t.benefit1}</p>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                    <!-- Benefit 2 -->
                    <tr>
                      <td style="padding: 0 0 10px 0;">
                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                          <tr>
                            <td style="vertical-align: middle; width: 28px;">
                              <div style="width: 28px; height: 28px; border-radius: 6px; background-color: rgba(46,158,57,0.1); text-align: center; line-height: 28px; font-size: 14px;">
                                &#128100;
                              </div>
                            </td>
                            <td style="vertical-align: middle; padding-left: 10px;">
                              <p style="margin: 0; font-size: 13px; color: #2a5c2a;">${t.benefit2}</p>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                    <!-- Benefit 3 -->
                    <tr>
                      <td style="padding: 0 0 10px 0;">
                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                          <tr>
                            <td style="vertical-align: middle; width: 28px;">
                              <div style="width: 28px; height: 28px; border-radius: 6px; background-color: rgba(46,158,57,0.1); text-align: center; line-height: 28px; font-size: 14px;">
                                &#128276;
                              </div>
                            </td>
                            <td style="vertical-align: middle; padding-left: 10px;">
                              <p style="margin: 0; font-size: 13px; color: #2a5c2a;">${t.benefit3}</p>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                    <!-- Benefit 4 -->
                    <tr>
                      <td style="padding: 0;">
                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                          <tr>
                            <td style="vertical-align: middle; width: 28px;">
                              <div style="width: 28px; height: 28px; border-radius: 6px; background-color: rgba(46,158,57,0.1); text-align: center; line-height: 28px; font-size: 14px;">
                                &#9993;
                              </div>
                            </td>
                            <td style="vertical-align: middle; padding-left: 10px;">
                              <p style="margin: 0; font-size: 13px; color: #2a5c2a;">${t.benefit4}</p>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>

            <!-- Expiration notice -->
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-top: 24px;">
              <tr>
                <td style="border: 1px solid #f5e6b8; border-radius: 8px; background-color: #fef9ed; padding: 16px;">
                  <p style="margin: 0; font-size: 13px; line-height: 1.6; color: #8a6914;">
                    <span style="font-weight: 600;">${t.expirationImportant}</span> ${t.expirationDesc}
                  </p>
                </td>
              </tr>
            </table>
          </div>

          <!-- Footer -->
          <div style="border-top: 1px solid #eaeef3; background-color: #f7f9fb; padding: 24px 32px;">
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
              <tr>
                <td style="text-align: center;">
                  <img src="${LOGO_FULL_URL}" alt="TrabajoYa" style="height: 40px; width: auto; margin-bottom: 16px;" />
                  <p style="margin: 0 0 4px 0; font-size: 11px; line-height: 1.6; color: #8c96a3;">
                    ${t.footerAutoEmail}
                  </p>
                  <p style="margin: 0 0 12px 0; font-size: 11px; line-height: 1.6; color: #8c96a3;">
                    ${t.footerIgnore}
                  </p>
                  <div style="width: 64px; height: 1px; background-color: #e0e5eb; margin: 0 auto 12px auto;"></div>
                  <p style="margin: 0; font-size: 11px; color: #8c96a3;">
                    ${t.footerHelp}
                    <a href="mailto:soporte@trabajo-ya.com" style="font-weight: 500; color: #0f2b4e; text-decoration: none;">
                      soporte@trabajo-ya.com
                    </a>
                  </p>
                </td>
              </tr>
            </table>
          </div>

        </div>
      </body>
      </html>
    `;

    const text = `${t.textPlainTitle}

${t.greeting}

${t.description} TrabajoYa.
${t.descriptionCta}

${t.textPlainVerifyLink}
${actionUrl}

${t.textPlainBenefits}
- ${t.benefit1}
- ${t.benefit2}
- ${t.benefit3}
- ${t.benefit4}

${t.textPlainExpiry}

---
${t.footerAutoEmail}
${t.footerIgnore}

${t.textPlainContact}`;

    // Formatear el From con nombre si es posible
    const fromEmail = process.env.MAIL_FROM || 'noreply@trabajo-ya.com';
    const fromName = 'TrabajoYa';
    const fromFormatted = fromEmail.includes('<') ? fromEmail : `${fromName} <${fromEmail}>`;

    await this.provider.send({
      to: email,
      subject: t.subject,
      html,
      text,
      from: fromFormatted,
      headers: {
        "Reply-To": process.env.MAIL_REPLY_TO || "soporte@trabajo-ya.com",
        "X-Mailer": "TrabajoYa",
        "X-Auto-Response-Suppress": "All",
      },
    });
  }

  async sendPasswordResetEmail(email: string, token: string, lang: string = "es"): Promise<void> {
    // URL HTTPS unificada para botón HTML y versión texto plano
    const actionUrl = this.buildAppLink("/app/reset-password", { token });

    const LOGO_URL = "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/icon-blanco-jkfiLxis7MIQA4G57Mqpv0A1Wgs9wA.png";
    const LOGO_FULL_URL = this.buildAppLink("/logo.png");

    // Traducciones por idioma
    const translations: Record<string, Record<string, string>> = {
      es: {
        subject: "Restablecer contraseña de TrabajoYa",
        preheader: "Restablece la contraseña de tu cuenta en TrabajoYa usando el enlace seguro",
        title: "Restablecer Contraseña",
        greeting: "Hola,",
        description: "Recibimos una solicitud para restablecer la contraseña de tu cuenta en",
        descriptionCta: "Si solicitaste este cambio, haz clic en el botón para continuar.",
        buttonText: "Restablecer Contraseña",
        temporaryLink: "Enlace temporal",
        temporaryLinkDesc: "Este enlace expirará en 1 hora por seguridad",
        accountSafe: "Tu cuenta está segura",
        accountSafeDesc: "Tu contraseña no cambiará hasta que completes el proceso",
        notYou: "¿No fuiste tú?",
        notYouDesc: "Si no solicitaste este cambio, puedes ignorar este email",
        warning: "Si tienes problemas o no solicitaste este cambio, contáctanos inmediatamente para proteger tu cuenta.",
        footerAutoEmail: "Este email fue enviado automáticamente por TrabajoYa.",
        footerIgnore: "Si no solicitaste este cambio, puedes ignorar este mensaje.",
        footerHelp: "¿Necesitas ayuda?",
        textPlainTitle: "Restablecer Contraseña - TrabajoYa",
        textPlainInfo: "INFORMACIÓN IMPORTANTE:",
        textPlainExpiry: "Este enlace expirará en 1 hora por seguridad",
        textPlainIgnore: "Si no solicitaste este cambio, puedes ignorar este correo",
        textPlainNoChange: "Tu contraseña no cambiará hasta que completes el proceso",
        textPlainContact: "Si tienes problemas o no solicitaste este cambio, contáctanos inmediatamente en soporte@trabajo-ya.com",
      },
      en: {
        subject: "Reset your TrabajoYa password",
        preheader: "Reset your TrabajoYa account password using the secure link",
        title: "Reset Password",
        greeting: "Hello,",
        description: "We received a request to reset the password for your account on",
        descriptionCta: "If you requested this change, click the button below to continue.",
        buttonText: "Reset Password",
        temporaryLink: "Temporary link",
        temporaryLinkDesc: "This link will expire in 1 hour for security",
        accountSafe: "Your account is safe",
        accountSafeDesc: "Your password will not change until you complete the process",
        notYou: "Wasn't you?",
        notYouDesc: "If you didn't request this change, you can ignore this email",
        warning: "If you're having trouble or didn't request this change, contact us immediately to protect your account.",
        footerAutoEmail: "This email was sent automatically by TrabajoYa.",
        footerIgnore: "If you didn't request this change, you can ignore this message.",
        footerHelp: "Need help?",
        textPlainTitle: "Reset Password - TrabajoYa",
        textPlainInfo: "IMPORTANT INFORMATION:",
        textPlainExpiry: "This link will expire in 1 hour for security",
        textPlainIgnore: "If you didn't request this change, you can ignore this email",
        textPlainNoChange: "Your password will not change until you complete the process",
        textPlainContact: "If you're having trouble or didn't request this change, contact us immediately at soporte@trabajo-ya.com",
      },
      pt: {
        subject: "Redefinir senha do TrabajoYa",
        preheader: "Redefina a senha da sua conta no TrabajoYa usando o link seguro",
        title: "Redefinir Senha",
        greeting: "Olá,",
        description: "Recebemos uma solicitação para redefinir a senha da sua conta no",
        descriptionCta: "Se você solicitou esta alteração, clique no botão abaixo para continuar.",
        buttonText: "Redefinir Senha",
        temporaryLink: "Link temporário",
        temporaryLinkDesc: "Este link expirará em 1 hora por segurança",
        accountSafe: "Sua conta está segura",
        accountSafeDesc: "Sua senha não será alterada até que você conclua o processo",
        notYou: "Não foi você?",
        notYouDesc: "Se você não solicitou esta alteração, pode ignorar este e-mail",
        warning: "Se tiver problemas ou não solicitou esta alteração, entre em contato conosco imediatamente para proteger sua conta.",
        footerAutoEmail: "Este e-mail foi enviado automaticamente pelo TrabajoYa.",
        footerIgnore: "Se você não solicitou esta alteração, pode ignorar esta mensagem.",
        footerHelp: "Precisa de ajuda?",
        textPlainTitle: "Redefinir Senha - TrabajoYa",
        textPlainInfo: "INFORMAÇÃO IMPORTANTE:",
        textPlainExpiry: "Este link expirará em 1 hora por segurança",
        textPlainIgnore: "Se você não solicitou esta alteração, pode ignorar este e-mail",
        textPlainNoChange: "Sua senha não será alterada até que você conclua o processo",
        textPlainContact: "Se tiver problemas ou não solicitou esta alteração, entre em contato conosco imediatamente em soporte@trabajo-ya.com",
      },
    };

    const t = translations[lang] || translations["es"];

    const html = `
      <!DOCTYPE html>
      <html lang="${lang}">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
        <title>${t.subject}</title>
        <!--[if !mso]><!-->
        <style type="text/css">
          .preheader { display: none !important; visibility: hidden; opacity: 0; color: transparent; height: 0; width: 0; }
        </style>
        <!--<![endif]-->
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f4;">
        <!-- Preheader text for email clients -->
        <div class="preheader" style="display: none; visibility: hidden; opacity: 0; color: transparent; height: 0; width: 0;">
          ${t.preheader}
        </div>
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 0;">
          
          <!-- Header -->
          <div style="background-color: #0f2b4e; padding: 40px 32px; text-align: center; position: relative; overflow: hidden;">
            <img src="${LOGO_URL}" alt="TrabajoYa" style="height: 48px; width: auto; margin-bottom: 16px;" />
            <p style="margin: 0 0 4px 0; font-size: 11px; font-weight: 600; letter-spacing: 0.2em; text-transform: uppercase; color: rgba(255,255,255,0.5);">
              TrabajoYa
            </p>
            <h1 style="margin: 0; font-size: 20px; font-weight: 700; color: #ffffff; letter-spacing: -0.025em;">
              ${t.title}
            </h1>
          </div>

          <!-- Body -->
          <div style="padding: 40px 32px;">
            <!-- Greeting & Description -->
            <p style="margin: 0 0 12px 0; font-size: 15px; line-height: 1.6; color: #1a1a2e;">
              ${t.greeting}
            </p>
            <p style="margin: 0 0 24px 0; font-size: 15px; line-height: 1.6; color: #4a4a5a;">
              ${t.description}
              <span style="font-weight: 600; color: #0f2b4e;">TrabajoYa</span>.
              ${t.descriptionCta}
            </p>

            <!-- CTA Button -->
            ${this.createEmailButton(t.buttonText, actionUrl, "#0f2b4e")}

            <!-- Security Info Cards -->
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-top: 8px;">
              <!-- Card 1: Temporary Link -->
              <tr>
                <td style="padding: 0 0 10px 0;">
                  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="border: 1px solid #eaeef3; border-radius: 8px; background-color: #f7f9fb;">
                    <tr>
                      <td style="padding: 14px; vertical-align: top; width: 32px;">
                        <div style="width: 32px; height: 32px; border-radius: 6px; background-color: rgba(15,43,78,0.08); text-align: center; line-height: 32px; font-size: 16px;">
                          &#9200;
                        </div>
                      </td>
                      <td style="padding: 14px 14px 14px 0; vertical-align: top;">
                        <p style="margin: 0; font-size: 13px; font-weight: 500; color: #1a1a2e;">${t.temporaryLink}</p>
                        <p style="margin: 2px 0 0 0; font-size: 12px; line-height: 1.5; color: #6b7280;">${t.temporaryLinkDesc}</p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <!-- Card 2: Account Safe -->
              <tr>
                <td style="padding: 0 0 10px 0;">
                  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="border: 1px solid #eaeef3; border-radius: 8px; background-color: #f7f9fb;">
                    <tr>
                      <td style="padding: 14px; vertical-align: top; width: 32px;">
                        <div style="width: 32px; height: 32px; border-radius: 6px; background-color: rgba(15,43,78,0.08); text-align: center; line-height: 32px; font-size: 16px;">
                          &#128737;
                        </div>
                      </td>
                      <td style="padding: 14px 14px 14px 0; vertical-align: top;">
                        <p style="margin: 0; font-size: 13px; font-weight: 500; color: #1a1a2e;">${t.accountSafe}</p>
                        <p style="margin: 2px 0 0 0; font-size: 12px; line-height: 1.5; color: #6b7280;">${t.accountSafeDesc}</p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <!-- Card 3: Not You -->
              <tr>
                <td style="padding: 0 0 10px 0;">
                  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="border: 1px solid #eaeef3; border-radius: 8px; background-color: #f7f9fb;">
                    <tr>
                      <td style="padding: 14px; vertical-align: top; width: 32px;">
                        <div style="width: 32px; height: 32px; border-radius: 6px; background-color: rgba(15,43,78,0.08); text-align: center; line-height: 32px; font-size: 16px;">
                          &#8505;
                        </div>
                      </td>
                      <td style="padding: 14px 14px 14px 0; vertical-align: top;">
                        <p style="margin: 0; font-size: 13px; font-weight: 500; color: #1a1a2e;">${t.notYou}</p>
                        <p style="margin: 2px 0 0 0; font-size: 12px; line-height: 1.5; color: #6b7280;">${t.notYouDesc}</p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>

            <!-- Warning -->
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-top: 14px;">
              <tr>
                <td style="border: 1px solid #fde2e2; border-radius: 8px; background-color: #fef5f5; padding: 16px;">
                  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                    <tr>
                      <td style="vertical-align: top; width: 20px; padding-right: 12px;">
                        <span style="font-size: 14px; color: #dc2626;">&#9888;</span>
                      </td>
                      <td style="vertical-align: top;">
                        <p style="margin: 0; font-size: 12px; line-height: 1.6; color: #991b1b;">
                          ${t.warning}
                        </p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </div>

          <!-- Footer -->
          <div style="border-top: 1px solid #eaeef3; background-color: #f7f9fb; padding: 24px 32px;">
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
              <tr>
                <td style="text-align: center;">
                  <img src="${LOGO_FULL_URL}" alt="TrabajoYa" style="height: 40px; width: auto; margin-bottom: 16px;" />
                  <p style="margin: 0 0 4px 0; font-size: 11px; line-height: 1.6; color: #8c96a3;">
                    ${t.footerAutoEmail}
                  </p>
                  <p style="margin: 0 0 12px 0; font-size: 11px; line-height: 1.6; color: #8c96a3;">
                    ${t.footerIgnore}
                  </p>
                  <div style="width: 64px; height: 1px; background-color: #e0e5eb; margin: 0 auto 12px auto;"></div>
                  <p style="margin: 0; font-size: 11px; color: #8c96a3;">
                    ${t.footerHelp}
                    <a href="mailto:soporte@trabajo-ya.com" style="font-weight: 500; color: #0f2b4e; text-decoration: none;">
                      soporte@trabajo-ya.com
                    </a>
                  </p>
                </td>
              </tr>
            </table>
          </div>

        </div>
      </body>
      </html>
    `;

    const text = `${t.textPlainTitle}

${t.greeting}

${t.description} TrabajoYa.
${t.descriptionCta}

${actionUrl}

${t.textPlainInfo}
- ${t.textPlainExpiry}
- ${t.textPlainIgnore}
- ${t.textPlainNoChange}

${t.textPlainContact}

---
${t.footerAutoEmail}
${t.footerIgnore}`;

    // Formatear el From con nombre si es posible
    const fromEmail = process.env.MAIL_FROM || "noreply@trabajo-ya.com";
    const fromName = "TrabajoYa";
    const fromFormatted = fromEmail.includes("<")
      ? fromEmail
      : `${fromName} <${fromEmail}>`;

    await this.provider.send({
      to: email,
      subject: t.subject,
      html,
      text,
      from: fromFormatted,
      headers: {
        "Reply-To": process.env.MAIL_REPLY_TO || "soporte@trabajo-ya.com",
        "X-Auto-Response-Suppress": "All",
        "X-Mailer": "TrabajoYa",
      },
    });

  }

  async sendApplicationStatusUpdateEmail(
    email: string,
    postulanteFullName: string,
    jobTitle: string,
    companyName: string,
    newStatus: string,
    notes?: string,
    lang: string = "es"
  ): Promise<void> {
    const LOGO_URL = "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/icon-blanco-jkfiLxis7MIQA4G57Mqpv0A1Wgs9wA.png";
    const LOGO_FULL_URL = this.buildAppLink("/logo.png");

    // Traducciones por idioma
    const translations: Record<string, Record<string, string>> = {
      es: {
        title: "Actualización de Postulación",
        greeting: "Hola",
        description: "Queremos informarte que el estado de tu postulación al puesto",
        descriptionIn: "en",
        descriptionUpdated: "ha sido actualizado.",
        newStatusLabel: "Nuevo estado",
        companyNote: "Nota de la empresa:",
        contactInfo: "Si tienes alguna pregunta, puedes contactar a la empresa directamente a través de la plataforma.",
        footerAutoEmail: "Este email fue enviado automáticamente por TrabajoYa.",
        footerActiveApplication: "Recibiste este email porque tienes una postulación activa.",
        footerHelp: "¿Necesitas ayuda?",
        statusPending: "Pendiente",
        statusPendingDesc: "Tu postulación está pendiente de revisión.",
        statusReviewed: "Revisada",
        statusReviewedDesc: "Tu postulación ha sido revisada por la empresa.",
        statusInterview: "Entrevista",
        statusInterviewDesc: "La empresa quiere agendar una entrevista contigo.",
        statusAccepted: "Aceptada",
        statusAcceptedDesc: "Tu postulación ha sido aceptada.",
        statusRejected: "Rechazada",
        statusRejectedDesc: "Lamentablemente, tu postulación no fue seleccionada en esta oportunidad.",
        statusDefault: "Actualizado",
        statusDefaultDesc: "El estado de tu postulación ha sido actualizado.",
        textPlainTitle: "Actualización de Postulación - TrabajoYa",
        textPlainNewStatus: "Nuevo estado:",
        textPlainCompanyNote: "Nota de la empresa:",
        textPlainContact: "¿Necesitas ayuda? Contáctanos en soporte@trabajo-ya.com",
      },
      en: {
        title: "Application Update",
        greeting: "Hello",
        description: "We want to let you know that the status of your application for the position",
        descriptionIn: "at",
        descriptionUpdated: "has been updated.",
        newStatusLabel: "New status",
        companyNote: "Company note:",
        contactInfo: "If you have any questions, you can contact the company directly through the platform.",
        footerAutoEmail: "This email was sent automatically by TrabajoYa.",
        footerActiveApplication: "You received this email because you have an active application.",
        footerHelp: "Need help?",
        statusPending: "Pending",
        statusPendingDesc: "Your application is pending review.",
        statusReviewed: "Reviewed",
        statusReviewedDesc: "Your application has been reviewed by the company.",
        statusInterview: "Interview",
        statusInterviewDesc: "The company wants to schedule an interview with you.",
        statusAccepted: "Accepted",
        statusAcceptedDesc: "Your application has been accepted.",
        statusRejected: "Rejected",
        statusRejectedDesc: "Unfortunately, your application was not selected for this opportunity.",
        statusDefault: "Updated",
        statusDefaultDesc: "Your application status has been updated.",
        textPlainTitle: "Application Update - TrabajoYa",
        textPlainNewStatus: "New status:",
        textPlainCompanyNote: "Company note:",
        textPlainContact: "Need help? Contact us at soporte@trabajo-ya.com",
      },
      pt: {
        title: "Atualização de Candidatura",
        greeting: "Olá",
        description: "Queremos informá-lo que o status da sua candidatura para a vaga",
        descriptionIn: "em",
        descriptionUpdated: "foi atualizado.",
        newStatusLabel: "Novo status",
        companyNote: "Nota da empresa:",
        contactInfo: "Se tiver alguma dúvida, pode entrar em contato com a empresa diretamente pela plataforma.",
        footerAutoEmail: "Este e-mail foi enviado automaticamente pelo TrabajoYa.",
        footerActiveApplication: "Você recebeu este e-mail porque tem uma candidatura ativa.",
        footerHelp: "Precisa de ajuda?",
        statusPending: "Pendente",
        statusPendingDesc: "Sua candidatura está pendente de revisão.",
        statusReviewed: "Revisada",
        statusReviewedDesc: "Sua candidatura foi revisada pela empresa.",
        statusInterview: "Entrevista",
        statusInterviewDesc: "A empresa quer agendar uma entrevista com você.",
        statusAccepted: "Aceita",
        statusAcceptedDesc: "Sua candidatura foi aceita.",
        statusRejected: "Rejeitada",
        statusRejectedDesc: "Infelizmente, sua candidatura não foi selecionada nesta oportunidade.",
        statusDefault: "Atualizado",
        statusDefaultDesc: "O status da sua candidatura foi atualizado.",
        textPlainTitle: "Atualização de Candidatura - TrabajoYa",
        textPlainNewStatus: "Novo status:",
        textPlainCompanyNote: "Nota da empresa:",
        textPlainContact: "Precisa de ajuda? Entre em contato em soporte@trabajo-ya.com",
      },
    };

    const t = translations[lang] || translations["es"];

    // Mapeo de estados con colores y traducciones
    const statusConfig: Record<string, { color: string; bgColor: string; borderColor: string; labelKey: string; descKey: string; icon: string }> = {
      PENDING: { color: "#d97706", bgColor: "#fef9ed", borderColor: "#f5e6b8", labelKey: "statusPending", descKey: "statusPendingDesc", icon: "&#9200;" },
      REVIEWED: { color: "#2563eb", bgColor: "#eff6ff", borderColor: "#bfdbfe", labelKey: "statusReviewed", descKey: "statusReviewedDesc", icon: "&#128065;" },
      INTERVIEW: { color: "#7c3aed", bgColor: "#f5f3ff", borderColor: "#ddd6fe", labelKey: "statusInterview", descKey: "statusInterviewDesc", icon: "&#128197;" },
      ACCEPTED: { color: "#16a34a", bgColor: "#f0fdf4", borderColor: "#bbf7d0", labelKey: "statusAccepted", descKey: "statusAcceptedDesc", icon: "&#9989;" },
      REJECTED: { color: "#dc2626", bgColor: "#fef2f2", borderColor: "#fecaca", labelKey: "statusRejected", descKey: "statusRejectedDesc", icon: "&#10060;" },
    };

    const sConf = statusConfig[newStatus] || {
      color: "#6b7280", bgColor: "#f9fafb", borderColor: "#e5e7eb",
      labelKey: "statusDefault", descKey: "statusDefaultDesc", icon: "&#128203;",
    };

    const statusLabel = t[sConf.labelKey];
    const statusDesc = t[sConf.descKey];
    const subject = `${t.title} - ${statusLabel}: "${jobTitle}"`;

    const notesSection = notes
      ? `
            <!-- Company Notes -->
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-top: 24px;">
              <tr>
                <td style="border: 1px solid #eaeef3; border-radius: 8px; background-color: #f7f9fb; padding: 16px;">
                  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                    <tr>
                      <td style="vertical-align: middle; width: 20px; padding-right: 8px;">
                        <span style="font-size: 14px; color: #6b7280;">&#128172;</span>
                      </td>
                      <td style="vertical-align: middle;">
                        <p style="margin: 0; font-size: 13px; font-weight: 600; color: #1a1a2e;">${t.companyNote}</p>
                      </td>
                    </tr>
                  </table>
                  <p style="margin: 8px 0 0 0; font-size: 13px; line-height: 1.6; color: #4a4a5a;">
                    ${notes}
                  </p>
                </td>
              </tr>
            </table>`
      : "";

    const html = `
      <!DOCTYPE html>
      <html lang="${lang}">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
        <title>${subject}</title>
        <!--[if !mso]><!-->
        <style type="text/css">
          .preheader { display: none !important; visibility: hidden; opacity: 0; color: transparent; height: 0; width: 0; }
        </style>
        <!--<![endif]-->
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f4;">
        <!-- Preheader text for email clients -->
        <div class="preheader" style="display: none; visibility: hidden; opacity: 0; color: transparent; height: 0; width: 0;">
          ${t.description} "${jobTitle}" ${t.descriptionIn} ${companyName} - ${statusLabel}
        </div>
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 0;">

          <!-- Header -->
          <div style="background-color: ${sConf.color}; padding: 40px 32px; text-align: center; position: relative; overflow: hidden;">
            <img src="${LOGO_URL}" alt="TrabajoYa" style="height: 48px; width: auto; margin-bottom: 16px;" />
            <p style="margin: 0 0 4px 0; font-size: 11px; font-weight: 600; letter-spacing: 0.2em; text-transform: uppercase; color: rgba(255,255,255,0.5);">
              TrabajoYa
            </p>
            <h1 style="margin: 0; font-size: 20px; font-weight: 700; color: #ffffff; letter-spacing: -0.025em;">
              ${t.title}
            </h1>
          </div>

          <!-- Body -->
          <div style="padding: 40px 32px;">
            <!-- Greeting & Description -->
            <p style="margin: 0 0 12px 0; font-size: 15px; line-height: 1.6; color: #1a1a2e;">
              ${t.greeting}${postulanteFullName ? ` <span style="font-weight: 600;">${postulanteFullName}</span>` : ""},
            </p>
            <p style="margin: 0 0 24px 0; font-size: 15px; line-height: 1.6; color: #4a4a5a;">
              ${t.description}
              <span style="font-weight: 600; color: #0f2b4e;">"${jobTitle}"</span> ${t.descriptionIn}
              <span style="font-weight: 600; color: #0f2b4e;">${companyName}</span> ${t.descriptionUpdated}
            </p>

            <!-- Status Badge -->
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
              <tr>
                <td style="border: 1px solid ${sConf.borderColor}; border-radius: 8px; background-color: ${sConf.bgColor}; padding: 20px;">
                  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                    <tr>
                      <td style="vertical-align: top; width: 40px;">
                        <div style="width: 40px; height: 40px; border-radius: 8px; background-color: ${sConf.color}18; text-align: center; line-height: 40px; font-size: 20px;">
                          ${sConf.icon}
                        </div>
                      </td>
                      <td style="vertical-align: top; padding-left: 12px;">
                        <p style="margin: 0; font-size: 11px; font-weight: 500; letter-spacing: 0.05em; text-transform: uppercase; color: ${sConf.color}99;">
                          ${t.newStatusLabel}
                        </p>
                        <p style="margin: 2px 0 0 0; font-size: 18px; font-weight: 700; color: ${sConf.color};">
                          ${statusLabel}
                        </p>
                      </td>
                    </tr>
                  </table>
                  <p style="margin: 12px 0 0 0; font-size: 13px; line-height: 1.6; color: #4a4a5a;">
                    ${statusDesc}
                  </p>
                </td>
              </tr>
            </table>
            ${notesSection}

            <!-- Contact Info -->
            <p style="margin: 24px 0 0 0; font-size: 13px; line-height: 1.6; color: #6b7280;">
              ${t.contactInfo}
            </p>
          </div>

          <!-- Footer -->
          <div style="border-top: 1px solid #eaeef3; background-color: #f7f9fb; padding: 24px 32px;">
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
              <tr>
                <td style="text-align: center;">
                  <img src="${LOGO_FULL_URL}" alt="TrabajoYa" style="height: 40px; width: auto; margin-bottom: 16px;" />
                  <p style="margin: 0 0 4px 0; font-size: 11px; line-height: 1.6; color: #8c96a3;">
                    ${t.footerAutoEmail}
                  </p>
                  <p style="margin: 0 0 12px 0; font-size: 11px; line-height: 1.6; color: #8c96a3;">
                    ${t.footerActiveApplication}
                  </p>
                  <div style="width: 64px; height: 1px; background-color: #e0e5eb; margin: 0 auto 12px auto;"></div>
                  <p style="margin: 0; font-size: 11px; color: #8c96a3;">
                    ${t.footerHelp}
                    <a href="mailto:soporte@trabajo-ya.com" style="font-weight: 500; color: #0f2b4e; text-decoration: none;">
                      soporte@trabajo-ya.com
                    </a>
                  </p>
                </td>
              </tr>
            </table>
          </div>

        </div>
      </body>
      </html>
    `;

    const text = `${t.textPlainTitle}

${t.greeting}${postulanteFullName ? ` ${postulanteFullName}` : ""},

${t.description} "${jobTitle}" ${t.descriptionIn} ${companyName} ${t.descriptionUpdated}

${t.textPlainNewStatus} ${statusLabel}
${statusDesc}
${notes ? `\n${t.textPlainCompanyNote} ${notes}\n` : ""}
${t.contactInfo}

---
${t.footerAutoEmail}
${t.footerActiveApplication}

${t.textPlainContact}`;

    const fromEmail = process.env.MAIL_FROM || "noreply@trabajo-ya.com";
    const fromName = "TrabajoYa";
    const fromFormatted = fromEmail.includes("<") ? fromEmail : `${fromName} <${fromEmail}>`;

    await this.provider.send({
      to: email,
      subject,
      html,
      text,
      from: fromFormatted,
      headers: {
        "Reply-To": process.env.MAIL_REPLY_TO || "soporte@trabajo-ya.com",
        "X-Auto-Response-Suppress": "All",
        "X-Mailer": "TrabajoYa",
      },
    });
  }

  async sendJobApprovalEmail(
    email: string,
    jobTitle: string,
    companyName: string,
    jobId: string,
    lang: string = "es"
  ): Promise<void> {
    // URL HTTPS unificada para botón HTML y versión texto plano
    const actionUrl = this.buildAppLink(`/app/job/${jobId}`);

    const LOGO_URL = "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/icon-blanco-jkfiLxis7MIQA4G57Mqpv0A1Wgs9wA.png";
    const LOGO_FULL_URL = this.buildAppLink("/logo.png");

    // Traducciones por idioma
    const translations: Record<string, Record<string, string>> = {
      es: {
        subject: `Tu publicación "${jobTitle}" ha sido aprobada`,
        preheader: `Tu publicación de empleo "${jobTitle}" fue aprobada y ya está activa en TrabajoYa`,
        title: "Publicación Aprobada",
        greeting: "Hola",
        description: "Nos complace informarte que tu publicación de empleo",
        descriptionApproved: "ha sido revisada y",
        approved: "aprobada",
        successTitle: "Tu empleo ya está activo",
        successDesc: "Los postulantes ahora pueden ver y aplicar a tu oferta de trabajo.",
        buttonText: "Ver mi Publicación",
        nextStepsTitle: "Próximos pasos:",
        step1: "Revisa las aplicaciones que recibas",
        step2: "Contacta a los candidatos que más te interesen",
        step3: "Gestiona tu publicación desde tu panel de empresa",
        step4: "Considera promocionar tu empleo para mayor visibilidad",
        contactInfo: "Si tienes alguna pregunta o necesitas ayuda, no dudes en contactarnos.",
        footerAutoEmail: "Este email fue enviado automáticamente por TrabajoYa.",
        footerHelp: "¿Necesitas ayuda?",
        textPlainTitle: "Publicación Aprobada - TrabajoYa",
        textPlainActive: "¡Tu empleo ya está activo!",
        textPlainNextSteps: "Próximos pasos:",
        textPlainContact: "¿Necesitas ayuda? Contáctanos en soporte@trabajo-ya.com",
      },
      en: {
        subject: `Your job posting "${jobTitle}" has been approved`,
        preheader: `Your job posting "${jobTitle}" has been approved and is now active on TrabajoYa`,
        title: "Job Posting Approved",
        greeting: "Hello",
        description: "We are pleased to inform you that your job posting",
        descriptionApproved: "has been reviewed and",
        approved: "approved",
        successTitle: "Your job is now active",
        successDesc: "Applicants can now see and apply to your job offer.",
        buttonText: "View my Posting",
        nextStepsTitle: "Next steps:",
        step1: "Review the applications you receive",
        step2: "Contact the candidates you're most interested in",
        step3: "Manage your posting from your company dashboard",
        step4: "Consider promoting your job for greater visibility",
        contactInfo: "If you have any questions or need help, don't hesitate to contact us.",
        footerAutoEmail: "This email was sent automatically by TrabajoYa.",
        footerHelp: "Need help?",
        textPlainTitle: "Job Posting Approved - TrabajoYa",
        textPlainActive: "Your job is now active!",
        textPlainNextSteps: "Next steps:",
        textPlainContact: "Need help? Contact us at soporte@trabajo-ya.com",
      },
      pt: {
        subject: `Sua vaga "${jobTitle}" foi aprovada`,
        preheader: `Sua publicação de vaga "${jobTitle}" foi aprovada e já está ativa no TrabajoYa`,
        title: "Publicação Aprovada",
        greeting: "Olá",
        description: "Temos o prazer de informar que sua publicação de emprego",
        descriptionApproved: "foi revisada e",
        approved: "aprovada",
        successTitle: "Sua vaga já está ativa",
        successDesc: "Os candidatos agora podem ver e se candidatar à sua oferta de trabalho.",
        buttonText: "Ver minha Publicação",
        nextStepsTitle: "Próximos passos:",
        step1: "Revise as candidaturas que receber",
        step2: "Entre em contato com os candidatos que mais lhe interessam",
        step3: "Gerencie sua publicação no painel da empresa",
        step4: "Considere promover sua vaga para maior visibilidade",
        contactInfo: "Se tiver alguma dúvida ou precisar de ajuda, não hesite em nos contatar.",
        footerAutoEmail: "Este e-mail foi enviado automaticamente pelo TrabajoYa.",
        footerHelp: "Precisa de ajuda?",
        textPlainTitle: "Publicação Aprovada - TrabajoYa",
        textPlainActive: "Sua vaga já está ativa!",
        textPlainNextSteps: "Próximos passos:",
        textPlainContact: "Precisa de ajuda? Entre em contato em soporte@trabajo-ya.com",
      },
    };

    const t = translations[lang] || translations["es"];

    const html = `
      <!DOCTYPE html>
      <html lang="${lang}">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
        <title>${t.subject}</title>
        <!--[if !mso]><!-->
        <style type="text/css">
          .preheader { display: none !important; visibility: hidden; opacity: 0; color: transparent; height: 0; width: 0; }
        </style>
        <!--<![endif]-->
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f4;">
        <!-- Preheader text for email clients -->
        <div class="preheader" style="display: none; visibility: hidden; opacity: 0; color: transparent; height: 0; width: 0;">
          ${t.preheader}
        </div>
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 0;">

          <!-- Header -->
          <div style="background-color: #2e9e39; padding: 40px 32px; text-align: center; position: relative; overflow: hidden;">
            <img src="${LOGO_URL}" alt="TrabajoYa" style="height: 48px; width: auto; margin-bottom: 16px;" />
            <p style="margin: 0 0 4px 0; font-size: 11px; font-weight: 600; letter-spacing: 0.2em; text-transform: uppercase; color: rgba(255,255,255,0.5);">
              TrabajoYa
            </p>
            <h1 style="margin: 0; font-size: 20px; font-weight: 700; color: #ffffff; letter-spacing: -0.025em;">
              ${t.title}
            </h1>
          </div>

          <!-- Body -->
          <div style="padding: 40px 32px;">
            <!-- Greeting & Description -->
            <p style="margin: 0 0 12px 0; font-size: 15px; line-height: 1.6; color: #1a1a2e;">
              ${t.greeting}${companyName ? ` <span style="font-weight: 600;">${companyName}</span>` : ""},
            </p>
            <p style="margin: 0 0 24px 0; font-size: 15px; line-height: 1.6; color: #4a4a5a;">
              ${t.description}
              <span style="font-weight: 600; color: #0f2b4e;">"${jobTitle}"</span>
              ${t.descriptionApproved} <span style="font-weight: 600; color: #2e9e39;">${t.approved}</span>.
            </p>

            <!-- Success Box -->
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
              <tr>
                <td style="border: 1px solid #bbf7d0; border-radius: 8px; background-color: #f0fdf4; padding: 20px;">
                  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                    <tr>
                      <td style="vertical-align: top; width: 40px;">
                        <div style="width: 40px; height: 40px; border-radius: 8px; background-color: rgba(46,158,57,0.1); text-align: center; line-height: 40px; font-size: 20px;">
                          &#10004;
                        </div>
                      </td>
                      <td style="vertical-align: top; padding-left: 12px;">
                        <p style="margin: 0; font-size: 15px; font-weight: 700; color: #166534;">
                          ${t.successTitle}
                        </p>
                        <p style="margin: 4px 0 0 0; font-size: 13px; line-height: 1.6; color: #2a5c2a;">
                          ${t.successDesc}
                        </p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>

            <!-- CTA Button -->
            ${this.createEmailButton(t.buttonText, actionUrl, "#2e9e39")}

            <!-- Next Steps -->
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-top: 8px;">
              <tr>
                <td style="border: 1px solid #e0e5eb; border-radius: 8px; background-color: #f7f9fb; padding: 20px;">
                  <p style="margin: 0 0 12px 0; font-size: 13px; font-weight: 600; color: #0f2b4e;">
                    ${t.nextStepsTitle}
                  </p>
                  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                    <!-- Step 1 -->
                    <tr>
                      <td style="padding: 0 0 10px 0;">
                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                          <tr>
                            <td style="vertical-align: middle; width: 28px;">
                              <div style="width: 28px; height: 28px; border-radius: 6px; background-color: rgba(15,43,78,0.08); text-align: center; line-height: 28px; font-size: 13px;">
                                &#128203;
                              </div>
                            </td>
                            <td style="vertical-align: middle; padding-left: 10px;">
                              <p style="margin: 0; font-size: 13px; color: #4a4a5a;">${t.step1}</p>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                    <!-- Step 2 -->
                    <tr>
                      <td style="padding: 0 0 10px 0;">
                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                          <tr>
                            <td style="vertical-align: middle; width: 28px;">
                              <div style="width: 28px; height: 28px; border-radius: 6px; background-color: rgba(15,43,78,0.08); text-align: center; line-height: 28px; font-size: 13px;">
                                &#128101;
                              </div>
                            </td>
                            <td style="vertical-align: middle; padding-left: 10px;">
                              <p style="margin: 0; font-size: 13px; color: #4a4a5a;">${t.step2}</p>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                    <!-- Step 3 -->
                    <tr>
                      <td style="padding: 0 0 10px 0;">
                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                          <tr>
                            <td style="vertical-align: middle; width: 28px;">
                              <div style="width: 28px; height: 28px; border-radius: 6px; background-color: rgba(15,43,78,0.08); text-align: center; line-height: 28px; font-size: 13px;">
                                &#9881;
                              </div>
                            </td>
                            <td style="vertical-align: middle; padding-left: 10px;">
                              <p style="margin: 0; font-size: 13px; color: #4a4a5a;">${t.step3}</p>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                    <!-- Step 4 -->
                    <tr>
                      <td style="padding: 0;">
                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                          <tr>
                            <td style="vertical-align: middle; width: 28px;">
                              <div style="width: 28px; height: 28px; border-radius: 6px; background-color: rgba(15,43,78,0.08); text-align: center; line-height: 28px; font-size: 13px;">
                                &#128200;
                              </div>
                            </td>
                            <td style="vertical-align: middle; padding-left: 10px;">
                              <p style="margin: 0; font-size: 13px; color: #4a4a5a;">${t.step4}</p>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>

            <!-- Contact Info -->
            <p style="margin: 24px 0 0 0; font-size: 13px; line-height: 1.6; color: #6b7280;">
              ${t.contactInfo}
            </p>
          </div>

          <!-- Footer -->
          <div style="border-top: 1px solid #eaeef3; background-color: #f7f9fb; padding: 24px 32px;">
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
              <tr>
                <td style="text-align: center;">
                  <img src="${LOGO_FULL_URL}" alt="TrabajoYa" style="height: 40px; width: auto; margin-bottom: 16px;" />
                  <p style="margin: 0 0 12px 0; font-size: 11px; line-height: 1.6; color: #8c96a3;">
                    ${t.footerAutoEmail}
                  </p>
                  <div style="width: 64px; height: 1px; background-color: #e0e5eb; margin: 0 auto 12px auto;"></div>
                  <p style="margin: 0; font-size: 11px; color: #8c96a3;">
                    ${t.footerHelp}
                    <a href="mailto:soporte@trabajo-ya.com" style="font-weight: 500; color: #0f2b4e; text-decoration: none;">
                      soporte@trabajo-ya.com
                    </a>
                  </p>
                </td>
              </tr>
            </table>
          </div>

        </div>
      </body>
      </html>
    `;

    const text = `${t.textPlainTitle}

${t.greeting}${companyName ? ` ${companyName}` : ""},

${t.description} "${jobTitle}" ${t.descriptionApproved} ${t.approved}.

${t.textPlainActive}
${t.successDesc}

${t.buttonText}:
${actionUrl}

${t.textPlainNextSteps}
- ${t.step1}
- ${t.step2}
- ${t.step3}
- ${t.step4}

${t.contactInfo}

---
${t.footerAutoEmail}

${t.textPlainContact}`;

    const fromEmail = process.env.MAIL_FROM || "noreply@trabajo-ya.com";
    const fromName = "TrabajoYa";
    const fromFormatted = fromEmail.includes("<") ? fromEmail : `${fromName} <${fromEmail}>`;

    await this.provider.send({
      to: email,
      subject: t.subject,
      html,
      text,
      from: fromFormatted,
      headers: {
        "Reply-To": process.env.MAIL_REPLY_TO || "soporte@trabajo-ya.com",
        "X-Auto-Response-Suppress": "All",
        "X-Mailer": "TrabajoYa",
      },
    });
  }
}
