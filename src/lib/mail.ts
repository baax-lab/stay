import "server-only";
import nodemailer from "nodemailer";
import { readFile } from "node:fs/promises";
import { env } from "./env";
import { audit } from "./audit";

/**
 * SMTP-Versand mit Pflicht-HTML-Signatur der GmbH (Konzept §3.2).
 * Ohne SMTP-Konfiguration wird nicht gesendet; der Aufrufer bekommt { sent: false }.
 */

const DEFAULT_SIGNATURE = `
<table cellpadding="0" cellspacing="0" style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#0e3a47;margin-top:24px">
  <tr><td style="border-left:3px solid #19b5d4;padding-left:12px">
    <strong>Baax Immobilien GmbH</strong><br>
    Suchmakler für touristisch genutzte Immobilien<br>
    <a href="https://www.baax.de" style="color:#0b94b0">www.baax.de</a> · mail@baax.de<br>
    <span style="color:#5d6f76">Geschäftsführer: Maximilian Schmitzberger · Sitz und Handelsregister gemäß Impressum</span>
  </td></tr>
</table>`;

let signatureCache: string | undefined;

export async function mailSignature(): Promise<string> {
  if (signatureCache) return signatureCache;
  if (env.mail.signatureHtml) signatureCache = env.mail.signatureHtml;
  else if (env.mail.signatureFile) signatureCache = await readFile(env.mail.signatureFile, "utf8").catch(() => DEFAULT_SIGNATURE);
  else signatureCache = DEFAULT_SIGNATURE;
  return signatureCache;
}

function transporter() {
  return nodemailer.createTransport({
    host: env.mail.host,
    port: env.mail.port,
    secure: env.mail.secure,
    auth: env.mail.user ? { user: env.mail.user, pass: env.mail.pass } : undefined,
  });
}

export type MailInput = {
  to: string | string[];
  subject: string;
  text: string;
  html?: string;
  attachments?: Array<{ filename: string; content: Buffer; contentType: string }>;
  userId?: string | null;
  purpose: string;
  entity?: string;
  entityId?: string;
};

export function wrapHtml(bodyHtml: string, signature: string): string {
  return `<!doctype html><html lang="de"><body style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#1b2a30;line-height:1.5">${bodyHtml}${signature}</body></html>`;
}

export function textToHtml(text: string): string {
  return text
    .split(/\n{2,}/)
    .map((p) => `<p>${p.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/\n/g, "<br>")}</p>`)
    .join("");
}

export async function sendMail(input: MailInput): Promise<{ sent: boolean; error?: string }> {
  const signature = await mailSignature();
  const html = wrapHtml(input.html ?? textToHtml(input.text), signature);
  const textSig = signature.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const text = `${input.text}\n\n--\n${textSig}`;

  if (!env.mailConfigured) {
    await audit({ userId: input.userId, action: "EMAIL_SENT", entity: input.entity ?? "Mail", entityId: input.entityId, meta: { to: input.to, subject: input.subject, purpose: input.purpose, sent: false, reason: "SMTP nicht konfiguriert" } });
    return { sent: false, error: "SMTP nicht konfiguriert" };
  }
  try {
    await transporter().sendMail({ from: env.mail.from, to: input.to, subject: input.subject, text, html, attachments: input.attachments });
    await audit({ userId: input.userId, action: "EMAIL_SENT", entity: input.entity ?? "Mail", entityId: input.entityId, meta: { to: input.to, subject: input.subject, purpose: input.purpose, sent: true } });
    return { sent: true };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    await audit({ userId: input.userId, action: "EMAIL_SENT", entity: input.entity ?? "Mail", entityId: input.entityId, meta: { to: input.to, subject: input.subject, purpose: input.purpose, sent: false, error } });
    return { sent: false, error };
  }
}

/** SMTP-Verbindungstest für die Einstellungen (Anmeldung am Server, ohne zu senden). */
export async function verifyMailConnection(): Promise<{ ok: boolean; message: string }> {
  if (!env.mailConfigured) return { ok: false, message: "SMTP_HOST fehlt." };
  try {
    await transporter().verify();
    return { ok: true, message: `Anmeldung an ${env.mail.host}:${env.mail.port} erfolgreich.` };
  } catch (e) {
    return { ok: false, message: `SMTP-Fehler: ${e instanceof Error ? e.message : String(e)}` };
  }
}
