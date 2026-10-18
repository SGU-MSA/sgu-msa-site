import "server-only";
import { createTransport } from "nodemailer";
import type { WarningMailer } from "./contract";

/** Gmail's SMTP submission port with STARTTLS (owner guide §10). */
const GMAIL_SMTP_HOST = "smtp.gmail.com";
const GMAIL_SMTP_PORT = 587;
/** Seconds to wait for Gmail; the nightly route has 60 in all. */
const CONNECTION_TIMEOUT_MS = 10_000;
const GREETING_TIMEOUT_MS = 10_000;
const SOCKET_TIMEOUT_MS = 10_000;

type Settings = { address: string; appPassword: string };
/** The one call the adapter makes (Nodemailer's `Transporter.sendMail`). */
type Transport = {
  sendMail(message: {
    from: { name: string; address: string };
    to: string;
    subject: string;
    text: string;
  }): Promise<unknown>;
};

/** Nodemailer's SMTP settings for the MSA Gmail. */
export function gmailSmtpOptions({ address, appPassword }: Settings) {
  return {
    host: GMAIL_SMTP_HOST,
    port: GMAIL_SMTP_PORT,
    secure: false,
    requireTLS: true,
    auth: { user: address, pass: appPassword },
    connectionTimeout: CONNECTION_TIMEOUT_MS,
    greetingTimeout: GREETING_TIMEOUT_MS,
    socketTimeout: SOCKET_TIMEOUT_MS,
  } as const;
}

/**
 * The daily check's warning email through the MSA Gmail (daily-check
 * contract D-14, D-15): from "SGU MSA website" (the MSA Gmail) to the same
 * address, plain text, no Bcc, no tracking. Wired only in Vercel Production;
 * the app password comes from the composition point and is never logged or
 * returned. An authentication failure (a revoked or wrong app password) is
 * `rejected`; anything else is `unavailable`.
 */
export function createGmailWarningMailer(
  settings: Settings,
  transport: Transport = createTransport(gmailSmtpOptions(settings)),
): WarningMailer {
  return {
    async send({ subject, text }) {
      try {
        await transport.sendMail({
          from: { name: "SGU MSA website", address: settings.address },
          to: settings.address,
          subject,
          text,
        });
        return { ok: true, delivery: "email" };
      } catch (error) {
        const code = (error as { code?: unknown } | null)?.code;
        return {
          ok: false,
          reason: code === "EAUTH" ? "rejected" : "unavailable",
        };
      }
    },
  };
}
