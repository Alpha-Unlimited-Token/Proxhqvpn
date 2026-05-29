import nodemailer from "nodemailer";
import { logger } from "./logger";

const SMTP_HOST  = process.env.SMTP_HOST  || "smtp.gmail.com";
const SMTP_PORT  = parseInt(process.env.SMTP_PORT || "465", 10);
const SMTP_USER  = process.env.SMTP_USER  || process.env.ADMIN_EMAILS?.split(",")[0]?.trim() || "";
const SMTP_PASS  = process.env.SMTP_PASS  || "";
const FROM_NAME  = "ProxhqVPN";
const FROM_ADDR  = SMTP_USER;

let _transport: nodemailer.Transporter | null = null;

function getTransport(): nodemailer.Transporter | null {
  if (!SMTP_PASS || !SMTP_USER) return null;
  if (_transport) return _transport;
  _transport = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
  return _transport;
}

interface MailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
}

export async function sendMail(opts: MailOptions): Promise<void> {
  const transport = getTransport();
  if (!transport) {
    logger.warn("sendMail: no SMTP credentials configured (set SMTP_USER + SMTP_PASS) — skipping");
    return;
  }
  try {
    await transport.sendMail({
      from: `"${FROM_NAME}" <${FROM_ADDR}>`,
      to: Array.isArray(opts.to) ? opts.to.join(", ") : opts.to,
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
    });
    logger.info({ to: opts.to, subject: opts.subject }, "sendMail: email sent");
  } catch (err: any) {
    logger.error({ err, to: opts.to, subject: opts.subject }, "sendMail: failed to send email");
  }
}

export function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "").split(",").map(e => e.trim()).filter(Boolean);
}
