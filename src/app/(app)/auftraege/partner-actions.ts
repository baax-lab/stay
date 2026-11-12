"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { sendMail } from "@/lib/mail";
import { htmlToPdf } from "@/lib/pdf";
import { profilePdfHtml, profileTextHtml, profileTextPlain, profileToText } from "@/lib/profile-text";
import { logEvent } from "@/lib/services/events";
import { criteriaLabels } from "@/lib/services/criteria";
import { createPartnerAccess } from "@/lib/services/partner-access";
import type { ActionResult } from "./actions";

/** Suchprofil anonymisiert an Partner senden (Konzept §8.22). */
export async function sendProfileToPartnersAction(mandateId: string, formData: FormData): Promise<ActionResult> {
  const user = await requirePermission("sendExternal");
  const partnerIds = formData.getAll("partnerIds").filter((v): v is string => typeof v === "string");
  const intro = String(formData.get("intro") ?? "").trim() || null;
  const includeAccess = formData.get("includeAccess") === "on";
  if (partnerIds.length === 0) return { ok: false, error: "Keinen Partner ausgewählt" };

  const mandate = await prisma.mandate.findUniqueOrThrow({ where: { id: mandateId }, include: { profile: true } });
  if (!mandate.profile) return { ok: false, error: "Kein Suchprofil vorhanden" };
  const partners = await prisma.partner.findMany({ where: { id: { in: partnerIds } } });
  const regionRows = await prisma.region.findMany({ select: { key: true, name: true } });
  const regionNames = Object.fromEntries(regionRows.map((r) => [r.key, r.name]));
  const ref = `BS-${mandate.id.slice(-6).toUpperCase()}`;
  const labels = await criteriaLabels();

  // Sicherheitsnetz: Käufername darf nirgends im Versand auftauchen
  const forbidden = [mandate.buyerName, mandate.buyerEmail, mandate.buyerPhone].filter((x): x is string => Boolean(x && x.length > 3));

  const results: string[] = [];
  for (const partner of partners) {
    if (!partner.email) {
      results.push(`${partner.name}: keine E-Mail`);
      continue;
    }
    // Suchprofil-Text gibt es auf Deutsch und Englisch; ES/IT/FR erhalten Englisch
    const lang = partner.language === "de" ? "de" : "en";
    const t = profileToText(mandate.profile, regionNames, lang, ref, labels);
    let text = profileTextPlain(t, intro);
    let html = profileTextHtml(t, intro);
    if (forbidden.some((f) => text.includes(f) || html.includes(f))) {
      results.push(`${partner.name}: Versand gestoppt, Käuferdaten im Text`);
      continue;
    }
    if (includeAccess) {
      const { url } = await createPartnerAccess(partner.id, user, mandateId);
      const line = lang === "en" ? `Submit suitable properties directly via your partner access: ${url}` : `Passende Objekte können Sie direkt über Ihren Partnerzugang einreichen: ${url}`;
      text += `\n\n${line}`;
      html += `<p>${line.replace(url, `<a href="${url}">${url}</a>`)}</p>`;
    }
    const subject = lang === "en" ? `Search mandate ${ref}: ${t.lines[0][1]} in ${t.lines[2][1]}` : `Suchauftrag ${ref}: ${t.lines[0][1]} in ${t.lines[2][1]}`;
    const pdf = await htmlToPdf(profilePdfHtml(t, intro));
    const warn = !partner.agreementAt ? " (ohne Partnervereinbarung!)" : "";

    const mail = await sendMail({
      to: partner.email,
      subject,
      text,
      html,
      attachments: pdf ? [{ filename: `${ref}.pdf`, content: pdf, contentType: "application/pdf" }] : undefined,
      userId: user.id,
      purpose: "partner-profile",
      entity: "Mandate",
      entityId: mandateId,
    });

    await prisma.partnerSend.create({ data: { mandateId, partnerId: partner.id, sentById: user.id, language: lang, subject, body: text } });
    await logEvent(mandateId, "PARTNER_SEND", { partnerId: partner.id, partnerName: partner.name, language: lang, subject, sent: mail.sent, pdf: Boolean(pdf) }, user);
    await audit({ userId: user.id, action: "PARTNER_SEND", entity: "Mandate", entityId: mandateId, meta: { partnerId: partner.id, sent: mail.sent } });
    results.push(`${partner.name}: ${mail.sent ? "gesendet" : `protokolliert, nicht gesendet (${mail.error})`}${pdf ? "" : ", ohne PDF"}${warn}`);
  }

  revalidatePath(`/auftraege/${mandateId}`);
  return { ok: true, message: results.join(" · ") };
}

export async function markPartnerReplyAction(mandateId: string, sendId: string, formData: FormData): Promise<ActionResult> {
  await requirePermission("editMandates");
  await prisma.partnerSend.update({ where: { id: sendId }, data: { repliedAt: new Date(), replyNote: String(formData.get("replyNote") ?? "").trim() || null } });
  revalidatePath(`/auftraege/${mandateId}`);
  return { ok: true };
}
