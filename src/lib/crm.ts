/**
 * Outbound messaging boundary (ARCHITECTURE.md §2.5) — the ONLY file that knows
 * which provider, if any, delivers messages for us.
 *
 * **The portal does not depend on one.** `leads` is the record: every lead is
 * written to MySQL before this module is ever called, the panel reads it from
 * there, and a failed or absent push loses nothing. What a provider adds is
 * *outbound* delivery — a login code, a "you have a new lead" ping — not
 * storage.
 *
 * So the provider is optional by construction, and `isMessagingConfigured()`
 * is how the rest of the app asks. Nothing may assume a message can be sent:
 * the publish flow checks first and skips verification when it cannot deliver,
 * rather than issuing a code nobody receives.
 *
 * **Two channels, and they are not interchangeable.**
 *
 *  - **Email — the buyer's and the lister's channel.** Sweden is email-first:
 *    someone will fill in a form and expect an email reply, and being asked to
 *    WhatsApp a stranger about a €400 000 purchase reads as unserious. So the
 *    OTP and every transactional message go out over SMTP (nodemailer, against
 *    the mailbox named in `SMTP_*`).
 *  - **The outbound webhook — the operator's and the CRM's channel.** Lead
 *    pushes and "go look" alerts still POST JSON wherever the founder points
 *    them, exactly as before.
 *
 * WhatsApp has not disappeared, it has changed sides: Spanish agencies live on
 * it, so it is the AGENCY-facing channel now (`CONTACT_WHATSAPP`,
 * `agencies.phone`) and never the buyer's. Nothing in this file sends one.
 *
 * Both halves are provider-agnostic so the options stay open — swapping SMTP
 * for Resend or Postmark is a class in this file and an env var, not an
 * architecture change.
 *
 * **The one rule that outranks the rest: never log or return a line that says
 * a message was delivered when it was not.** A dev-console fallback that
 * claims success in production is how a publisher gets told "we sent you a
 * code" that nobody could ever receive.
 */
import { createTransport, type Transporter } from "nodemailer";

export interface LeadPayload {
  leadType:
    | "buyer"
    | "renter"
    | "seller"
    | "valuation"
    | "developer"
    | "agent_signup";
  vertical: string;
  name?: string;
  /** Required, and the reply channel — the inverse of the inherited shape. */
  email: string;
  phone?: string;
  message?: string;
  utm?: Record<string, string>;
  listing?: {
    publicId: string;
    title: string;
    url: string;
    priceEur: number;
    operation: string;
  };
  project?: { slug: string; name: string };
  routedTo: "agency" | "agent" | "owner" | "internal" | "developer";
}

/**
 * A ping to the person running the portal — not a CRM record.
 *
 * The founder is a solo operator, so a new lead or a listing waiting for
 * review is discovered by opening /admin and looking. This is the outbound
 * half of that: when a webhook is configured, the same channel that carries
 * leads carries a "go look" alert, distinguishable by its `event` so a
 * downstream flow can route it wherever the operator actually reads.
 *
 * Optional by construction, exactly like every other outbound message here: no
 * provider means no alert, never a logged line pretending to be one.
 */
export interface OperatorAlert {
  kind: "new_lead" | "review_submitted";
  /** One line, already in the operator's language. */
  title: string;
  detail?: string;
  /** Absolute URL of the screen that acts on it. */
  url?: string;
}

export interface CrmResult {
  ok: boolean;
  /** Provider-side contact id (stored as leads.ghl_contact_id). */
  contactId?: string;
  error?: string;
}

export interface CrmProvider {
  pushLead(lead: LeadPayload): Promise<CrmResult>;
  notifyOperator(alert: OperatorAlert): Promise<CrmResult>;
}

/**
 * Generic outbound webhook (the shape GoHighLevel's inbound webhooks accept,
 * and a trivial target for anything else that speaks JSON over HTTPS).
 */
class WebhookProvider implements CrmProvider {
  constructor(private webhookUrl: string) {}

  async pushLead(lead: LeadPayload): Promise<CrmResult> {
    return this.post({ event: "lead", ...lead });
  }

  async notifyOperator(alert: OperatorAlert): Promise<CrmResult> {
    return this.post({ event: "operator_alert", ...alert });
  }

  private async post(body: unknown): Promise<CrmResult> {
    try {
      const res = await fetch(this.webhookUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) return { ok: false, error: `webhook ${res.status}` };
      const data = (await res.json().catch(() => ({}))) as {
        contact_id?: string;
      };
      return { ok: true, contactId: data.contact_id };
    } catch (e) {
      return { ok: false, error: String(e) };
    }
  }
}

/**
 * No provider configured. Lead pushes are a no-op success — the lead is
 * already stored, and there is nothing to deliver it to.
 */
class NoProvider implements CrmProvider {
  async pushLead(lead: LeadPayload): Promise<CrmResult> {
    if (process.env.NODE_ENV !== "production") {
      console.info("[messaging:dev] lead", JSON.stringify(lead));
    }
    return { ok: true };
  }
  /**
   * Reports failure, unlike pushLead: a lead push has nothing left to deliver
   * once the row is stored, but an alert that was never sent is simply an
   * alert that was never sent. The /admin badges are what the operator has
   * without a provider, and they are always there.
   */
  async notifyOperator(alert: OperatorAlert): Promise<CrmResult> {
    if (process.env.NODE_ENV !== "production") {
      console.info("[messaging:dev] operator alert", JSON.stringify(alert));
    }
    return { ok: false, error: "no messaging provider configured" };
  }
}

/** URL of the outbound webhook, if one is configured. */
function webhookUrl(): string | undefined {
  // GHL_WEBHOOK_URL is the historical name; either works.
  return process.env.LEAD_WEBHOOK_URL || process.env.GHL_WEBHOOK_URL;
}

export function getCrm(): CrmProvider {
  const url = webhookUrl();
  return url ? new WebhookProvider(url) : new NoProvider();
}

/* ------------------------------------------------------------------ */
/* Email — the buyer's and the lister's channel                        */
/* ------------------------------------------------------------------ */

export interface MailMessage {
  to: string;
  subject: string;
  /** Plain text. Every message this portal sends is short enough to be one. */
  text: string;
}

export interface MailTransport {
  send(message: MailMessage): Promise<CrmResult>;
}

/** The SMTP settings, when all of the required ones are present. */
interface SmtpConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
}

/**
 * Read the SMTP settings, or null when the mailbox is not configured.
 *
 * All-or-nothing on purpose. A half-filled set (host but no password, say) is
 * a deployment that *believes* it can send mail and cannot, which is the state
 * this file exists to make impossible — so it reads as "no transport" and the
 * caller degrades, rather than throwing at the first send.
 */
function smtpConfig(): SmtpConfig | null {
  const host = process.env.SMTP_HOST?.trim();
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS;
  const from = process.env.EMAIL_FROM?.trim() || user;
  if (!host || !user || !pass || !from) return null;
  // 587 (STARTTLS) is what Hostinger's mailboxes take; 465 is implicit TLS.
  const port = Number(process.env.SMTP_PORT) || 587;
  return { host, port, user, pass, from };
}

/**
 * Real delivery, over SMTP.
 *
 * The transporter is built once per process rather than per message:
 * nodemailer pools connections, and re-handshaking TLS for every login code
 * would put a second of latency inside a server action.
 */
class SmtpTransport implements MailTransport {
  private transporter: Transporter;

  constructor(private config: SmtpConfig) {
    this.transporter = createTransport({
      host: config.host,
      port: config.port,
      // Implicit TLS on 465; STARTTLS (upgraded by nodemailer) everywhere else.
      secure: config.port === 465,
      auth: { user: config.user, pass: config.pass },
    });
  }

  async send(message: MailMessage): Promise<CrmResult> {
    try {
      await this.transporter.sendMail({
        from: this.config.from,
        to: message.to,
        subject: message.subject,
        text: message.text,
      });
      return { ok: true };
    } catch (e) {
      // Returned, never swallowed: a caller that told a visitor "check your
      // inbox" has to be able to find out that nothing was sent.
      return { ok: false, error: String(e) };
    }
  }
}

/**
 * No mailbox configured.
 *
 * In development it prints the message and reports success, so the OTP flow is
 * exercisable on a laptop with no credentials. In production it reports
 * **failure** and prints nothing: the old console fallback claimed the code
 * had been sent and logged it server-side, which meant the wizard told a
 * publisher "we sent you a code" that nobody could ever receive — a dead end
 * that looked like success. Callers use `isMailConfigured()` to skip
 * verification entirely instead of issuing a code into the void.
 */
class DevConsoleMail implements MailTransport {
  async send(message: MailMessage): Promise<CrmResult> {
    if (process.env.NODE_ENV !== "production") {
      console.info(
        `[mail:dev] → ${message.to} · ${message.subject}\n${message.text}`,
      );
      return { ok: true };
    }
    return { ok: false, error: "no SMTP transport configured" };
  }
}

let cachedMail: MailTransport | null = null;

export function getMail(): MailTransport {
  if (!cachedMail) {
    const config = smtpConfig();
    cachedMail = config ? new SmtpTransport(config) : new DevConsoleMail();
  }
  return cachedMail;
}

/**
 * Whether an email can actually be delivered. `true` in development without
 * any configuration, because the console transport really does show the
 * message to the person running it — that is a delivery, to the only recipient
 * a dev machine has.
 */
export function isMailConfigured(): boolean {
  return Boolean(smtpConfig()) || process.env.NODE_ENV !== "production";
}

/**
 * Whether outbound messages can actually be delivered.
 *
 * Email, specifically: this drives the OTP flows, and the webhook has never
 * been able to deliver a login code to a person. A deployment with a webhook
 * and no mailbox can push leads to a CRM and still cannot verify anybody, and
 * saying otherwise here would put the publish wizard back in the dead end the
 * rule above exists to prevent.
 */
export function isMessagingConfigured(): boolean {
  return isMailConfigured();
}

/**
 * The login/verification code, by email.
 *
 * Swedish, because everyone who receives one is reading a Swedish site. The
 * copy is deliberately here and not in `sv.ts`: the dictionary is the UI's,
 * this is the transport's own envelope, and a message that cannot be sent
 * must not be able to ship without the text that says what it is.
 */
export async function sendOtpEmail(
  to: string,
  code: string,
): Promise<CrmResult> {
  return getMail().send({
    to,
    subject: `${code} är din kod till flyttatillspanien.se`,
    text: [
      `Din kod är ${code}.`,
      "",
      "Koden gäller i 10 minuter och kan bara användas en gång.",
      "Om du inte bad om den kan du bortse från det här mejlet.",
    ].join("\n"),
  });
}

/**
 * Fire-and-forget operator alert. Never throws and never reports back: no
 * caller may fail, retry or slow a request because a ping did not land — the
 * lead or the pending listing is already in MySQL, which is the record.
 */
export async function alertOperator(alert: OperatorAlert): Promise<void> {
  try {
    await getCrm().notifyOperator(alert);
  } catch {
    /* an undelivered ping is not worth an error page */
  }
}
