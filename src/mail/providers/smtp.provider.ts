import { MailProvider } from "./mail.provider";
import * as nodemailer from "nodemailer";

export class SmtpProvider implements MailProvider {
  private transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 1025),
    secure: String(process.env.SMTP_SECURE ?? "false") === "true",
    auth:
      process.env.SMTP_USER && process.env.SMTP_PASS
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined, // MailHog no necesita auth
  });

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
    await this.transporter.sendMail({
      from: from || process.env.MAIL_FROM || "no-reply@example.local",
      to,
      subject,
      html,
      text,
    });
  }
}
