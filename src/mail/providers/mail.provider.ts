export interface MailProvider {
  send(params: {
    to: string | string[];
    subject: string;
    html?: string;
    text?: string;
    from?: string;
    headers?: Record<string, string>;
  }): Promise<void>;
}
