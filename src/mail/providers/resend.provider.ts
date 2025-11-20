import { MailProvider } from "./mail.provider";
import { Resend } from "resend";

export class ResendProvider implements MailProvider {
  private resend: Resend;

  constructor() {
    this.resend = new Resend(process.env.RESEND_API_KEY);
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
  }) {
    // Convertir to a array si es string
    const recipients = Array.isArray(to) ? to : [to];

    await this.resend.emails.send({
      from:
        from || process.env.MAIL_FROM || "TrabajoYa <onboarding@resend.dev>",
      to: recipients,
      subject,
      html,
      text,
    });
  }
}
