import "server-only";
import type { BuyerNotification, MandateStatus, NotificationKind } from "@prisma/client";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { sendMail } from "@/lib/mail";
import { asLang, fmtDate, fmtMoney, t, type Lang } from "@/lib/i18n";
import { logEvent } from "./events";
import { createPortalAccess } from "./portal";

/**
 * Benachrichtigungen an Käufer (Konzept §9.8): Mail mit Portal-Link bei neuem freigegebenem Objekt,
 * neuem Suchbericht und Statuswechsel – immer als Entwurf, Versand erst nach Freigabe durch einen Mitarbeiter.
 */

export const BUYER_RELEVANT_STATUS: MandateStatus[] = ["BEAUFTRAGT", "ANALYSE", "SUCHE", "PRUEFUNG", "VERHANDLUNG", "GEKAUFT", "NACHBETREUUNG", "PAUSIERT", "ABGESCHLOSSEN"];

type Payload = { propertyIds?: string[]; status?: MandateStatus; reportId?: string };

async function render(kind: NotificationKind, payload: Payload, mandateId: string): Promise<{ subject: string; body: string }> {
  const m = await prisma.mandate.findUniqueOrThrow({ where: { id: mandateId } });
  const lang: Lang = asLang(m.buyerLang);
  const greet = t(lang, "mail.greeting", { name: m.buyerName });
  if (kind === "OBJEKT") {
    const props = await prisma.property.findMany({ where: { id: { in: payload.propertyIds ?? [] } } });
    const lines = props.map((p) => `· ${(lang === "en" && p.titleEn) || p.title}, ${p.locality ?? p.region}, ${fmtMoney(lang, p.price, p.currency)}`);
    return { subject: t(lang, "mail.objects_subject"), body: [greet, "", t(lang, "mail.objects_body", { count: props.length }), ...lines].join("\n") };
  }
  if (kind === "BERICHT") {
    const r = await prisma.report.findUniqueOrThrow({ where: { id: payload.reportId! } });
    const title = t(lang, r.kind === "SUCHBERICHT" ? "report.search_title" : "report.market_title");
    const period = r.periodStart && r.periodEnd ? `${fmtDate(lang, r.periodStart)} – ${fmtDate(lang, r.periodEnd)}` : fmtDate(lang, r.createdAt);
    return { subject: t(lang, "mail.report_subject", { title }), body: [greet, "", t(lang, "mail.report_body", { title, period })].join("\n") };
  }
  if (kind === "STATUS") {
    const st = payload.status ?? m.status;
    return { subject: t(lang, "mail.status_subject"), body: [greet, "", t(lang, "mail.status_body", { status: t(lang, `status.${st}`), next: m.portalNextSteps || t(lang, `next_steps.${st}`) })].join("\n") };
  }
  return { subject: t(lang, "mail.link_subject"), body: greet };
}

async function upsertDraft(mandateId: string, kind: NotificationKind, merge: (p: Payload) => Payload) {
  const open = await prisma.buyerNotification.findFirst({ where: { mandateId, kind, status: "ENTWURF" }, orderBy: { createdAt: "desc" } });
  const payload = merge((open?.payload as Payload) ?? {});
  const { subject, body } = await render(kind, payload, mandateId);
  if (open) return prisma.buyerNotification.update({ where: { id: open.id }, data: { payload, subject, body } });
  return prisma.buyerNotification.create({ data: { mandateId, kind, payload, subject, body } });
}

/** Objekt an Käufer freigegeben → in den offenen Objekt-Entwurf aufnehmen. */
export async function draftObjectNotification(mandateId: string, propertyId: string) {
  return upsertDraft(mandateId, "OBJEKT", (p) => ({ ...p, propertyIds: Array.from(new Set([...(p.propertyIds ?? []), propertyId])) }));
}

export async function draftStatusNotification(mandateId: string, status: MandateStatus) {
  if (!BUYER_RELEVANT_STATUS.includes(status)) return null;
  return upsertDraft(mandateId, "STATUS", () => ({ status }));
}

export async function draftReportNotification(mandateId: string, reportId: string) {
  return prisma.buyerNotification.create({ data: { mandateId, kind: "BERICHT", payload: { reportId }, ...(await render("BERICHT", { reportId }, mandateId)) } });
}

/** Entwurf nach Sichtung senden: frischer Portal-Link (30 Tage), Mail mit Signatur, Protokoll. */
export async function sendNotification(id: string, user: { id: string; name?: string }, edits?: { subject?: string; body?: string }): Promise<{ ok: boolean; message: string; notification?: BuyerNotification }> {
  const n = await prisma.buyerNotification.findUniqueOrThrow({ where: { id }, include: { mandate: true } });
  if (n.status !== "ENTWURF") return { ok: false, message: "Benachrichtigung wurde bereits bearbeitet." };
  const to = n.mandate.buyerEmail;
  if (!to) return { ok: false, message: "Beim Suchauftrag ist keine E-Mail-Adresse des Käufers hinterlegt." };
  const lang = asLang(n.mandate.buyerLang);
  const subject = edits?.subject?.trim() || n.subject;
  const body = edits?.body?.trim() || n.body;
  const { url, access } = await createPortalAccess(n.mandateId, user, to);
  const text = [body, "", t(lang, "mail.portal_link", { date: fmtDate(lang, access.expiresAt) }), url, "", t(lang, "mail.closing")].join("\n");
  const mail = await sendMail({ to, subject, text, userId: user.id, purpose: `buyer-${n.kind.toLowerCase()}`, entity: "Mandate", entityId: n.mandateId });
  if (!mail.sent) return { ok: false, message: `Nicht gesendet: ${mail.error}. Der Entwurf bleibt erhalten.` };
  const updated = await prisma.buyerNotification.update({ where: { id }, data: { status: "GESENDET", subject, body, sentAt: new Date(), sentById: user.id, sentTo: to } });
  await logEvent(n.mandateId, "NOTIFICATION", { kind: n.kind, subject, to }, user);
  await audit({ userId: user.id, action: "EMAIL_SENT", entity: "Mandate", entityId: n.mandateId, meta: { notificationId: id, kind: n.kind } });
  return { ok: true, message: `An ${to} gesendet.`, notification: updated };
}

export async function discardNotification(id: string, user: { id: string }) {
  const n = await prisma.buyerNotification.update({ where: { id }, data: { status: "VERWORFEN" } });
  await audit({ userId: user.id, action: "MANDATE_UPDATE", entity: "Mandate", entityId: n.mandateId, meta: { notificationDiscarded: id } });
  return n;
}
