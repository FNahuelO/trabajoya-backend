import { MailProvider } from "./mail.provider";
import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";

export class SesProvider implements MailProvider {
  private client = new SESv2Client({ region: process.env.AWS_REGION });

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
    const FromEmailAddress = from || process.env.MAIL_FROM!;
    const Destination = { ToAddresses: Array.isArray(to) ? to : [to] };

    await this.client.send(
      new SendEmailCommand({
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
      })
    );
  }
}
