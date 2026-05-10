// Provider-agnostic notification abstraction.

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface SmsMessage {
  to: string;       // E.164
  body: string;
}

export interface SendResult {
  ok: boolean;
  externalId?: string;
  error?: string;
}

export interface EmailProvider { send(msg: EmailMessage): Promise<SendResult>; }
export interface SmsProvider { send(msg: SmsMessage): Promise<SendResult>; }

// ── Stub providers (development) ────────────────────────────────

export class ConsoleEmailProvider implements EmailProvider {
  async send(msg: EmailMessage): Promise<SendResult> {
    // eslint-disable-next-line no-console
    console.log(`[email] → ${msg.to} :: ${msg.subject}`);
    return { ok: true, externalId: `console-${Date.now()}` };
  }
}

export class ConsoleSmsProvider implements SmsProvider {
  async send(msg: SmsMessage): Promise<SendResult> {
    // eslint-disable-next-line no-console
    console.log(`[sms] → ${msg.to} :: ${msg.body}`);
    return { ok: true, externalId: `console-${Date.now()}` };
  }
}

// ── Factory ────────────────────────────────────────────────────

export interface NotificationsConfig {
  emailProvider?: EmailProvider;
  smsProvider?: SmsProvider;
}

export class NotificationDispatcher {
  constructor(private readonly cfg: NotificationsConfig) {}
  email(msg: EmailMessage): Promise<SendResult> {
    return (this.cfg.emailProvider ?? new ConsoleEmailProvider()).send(msg);
  }
  sms(msg: SmsMessage): Promise<SendResult> {
    return (this.cfg.smsProvider ?? new ConsoleSmsProvider()).send(msg);
  }
}
