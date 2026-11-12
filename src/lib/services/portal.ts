import "server-only";
import type { Mandate, PortalAccess } from "@prisma/client";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { audit } from "@/lib/audit";
import { sendMail } from "@/lib/mail";
import { asLang, fmtDate, t, type Lang } from "@/lib/i18n";
import { accessState, extendExpiry, generatePortalToken, hashPortalToken, looksLikeToken, type AccessState } from "@/lib/portal";
import { logEvent } from "./events";

export function portalUrl(token: string): string {
  return `${env.appUrl}/portal/${token}`;
}

/** Neuen Magic Link anlegen. Der Klartext-Token existiert nur in der Rückgabe (für Anzeige oder Mail). */
export async function createPortalAccess(mandateId: string, user: { id: string; name?: string }, sentTo?: string | null): Promise<{ token: string; url: string; access: PortalAccess }> {
  const { token, hash } = generatePortalToken();
  const access = await prisma.portalAccess.create({ data: { mandateId, tokenHash: hash, expiresAt: extendExpiry(), createdById: user.id, sentTo: sentTo ?? null } });
  await audit({ userId: user.id, action: "PORTAL_LINK", entity: "Mandate", entityId: mandateId, meta: { accessId: access.id, sentTo: sentTo ?? null } });
  await logEvent(mandateId, "PORTAL_LINK", { accessId: access.id, expiresAt: access.expiresAt.toISOString(), sentTo: sentTo ?? null }, user);
  return { token, url: portalUrl(token), access };
}

export function portalLinkMailText(lang: Lang, buyerName: string, url: string, expiresAt: Date, intro: string): string {
  return [t(lang, "mail.greeting", { name: buyerName }), "", intro, "", t(lang, "mail.portal_link", { date: fmtDate(lang, expiresAt) }), url, "", t(lang, "mail.closing")].join("\n");
}

/** Link erzeugen und per Mail (mit Signatur) an den Käufer senden. */
export async function sendPortalLink(mandateId: string, user: { id: string; name?: string }): Promise<{ ok: boolean; message: string; url?: string }> {
  const mandate = await prisma.mandate.findUniqueOrThrow({ where: { id: mandateId } });
  if (!mandate.buyerEmail) return { ok: false, message: "Beim Suchauftrag ist keine E-Mail-Adresse des Käufers hinterlegt." };
  const lang = asLang(mandate.buyerLang);
  const { url, access } = await createPortalAccess(mandateId, user, mandate.buyerEmail);
  const mail = await sendMail({
    to: mandate.buyerEmail,
    subject: t(lang, "mail.link_subject"),
    text: portalLinkMailText(lang, mandate.buyerName, url, access.expiresAt, t(lang, "mail.link_body")),
    userId: user.id,
    purpose: "portal-link",
    entity: "Mandate",
    entityId: mandateId,
  });
  await logEvent(mandateId, "EMAIL_SENT", { purpose: "portal-link", to: mandate.buyerEmail, sent: mail.sent }, user);
  return mail.sent
    ? { ok: true, message: `Link an ${mandate.buyerEmail} gesendet (gültig bis ${fmtDate("de", access.expiresAt)}).`, url }
    : { ok: false, message: `Link erstellt, Mail nicht gesendet (${mail.error}). Link manuell weitergeben:`, url };
}

export type ResolvedPortal =
  | { state: "valid"; access: PortalAccess; mandate: Mandate }
  | { state: Exclude<AccessState, "valid">; access: PortalAccess; mandate: Mandate }
  | { state: "unknown" };

/** Token auflösen, ohne Zugriff zu zählen (für Aktionen und Dateien). */
export async function lookupPortal(token: string): Promise<ResolvedPortal> {
  if (!looksLikeToken(token)) return { state: "unknown" };
  const access = await prisma.portalAccess.findUnique({ where: { tokenHash: hashPortalToken(token) }, include: { mandate: true } });
  if (!access) return { state: "unknown" };
  const state = accessState(access);
  const { mandate, ...rest } = access;
  return { state, access: rest, mandate } as ResolvedPortal;
}

/** Token auflösen und den Seitenaufruf protokollieren (Konzept §9 Abnahme: Portal-Zugriffe werden protokolliert). */
export async function openPortal(token: string, ip: string | undefined, page: string): Promise<ResolvedPortal> {
  const r = await lookupPortal(token);
  if (r.state === "unknown") {
    await audit({ action: "PORTAL_DENIED", entity: "PortalAccess", meta: { reason: "unknown", page }, ip });
    return r;
  }
  if (r.state !== "valid") {
    await audit({ action: "PORTAL_DENIED", entity: "Mandate", entityId: r.mandate.id, meta: { reason: r.state, accessId: r.access.id, page }, ip });
    return r;
  }
  await prisma.portalAccess.update({ where: { id: r.access.id }, data: { lastSeenAt: new Date(), viewCount: { increment: 1 } } });
  await audit({ action: "PORTAL_VIEW", entity: "Mandate", entityId: r.mandate.id, meta: { accessId: r.access.id, page }, ip });
  return r;
}

/** Abgelaufener (nicht widerrufener) Link: neuen Link an die hinterlegte Adresse senden. Keine Auskunft, ob eine Adresse existiert. */
export async function requestNewLink(token: string, ip?: string): Promise<void> {
  const r = await lookupPortal(token);
  if (r.state !== "expired" || !r.mandate.buyerEmail) {
    await audit({ action: "PORTAL_DENIED", entity: "PortalAccess", meta: { reason: `relink-${r.state}` }, ip });
    return;
  }
  const lang = asLang(r.mandate.buyerLang);
  const system = { id: "portal", name: "Käuferportal" };
  const { url, access } = await createPortalAccess(r.mandate.id, system, r.mandate.buyerEmail);
  await sendMail({
    to: r.mandate.buyerEmail,
    subject: t(lang, "mail.link_subject"),
    text: portalLinkMailText(lang, r.mandate.buyerName, url, access.expiresAt, t(lang, "mail.link_body")),
    purpose: "portal-relink",
    entity: "Mandate",
    entityId: r.mandate.id,
  });
}

/** Für den Käufer freigegebene Objekte: Vorstellung (Presentation) vorhanden. */
export async function releasedObjects(mandateId: string) {
  const presentations = await prisma.presentation.findMany({
    where: { mandateId },
    orderBy: { sentAt: "desc" },
    include: { property: true },
  });
  const matches = await prisma.match.findMany({ where: { mandateId, propertyId: { in: presentations.map((p) => p.propertyId) } } });
  return presentations
    .filter((p) => p.property.active)
    .map((p) => ({ presentation: p, property: p.property, match: matches.find((m) => m.propertyId === p.propertyId) ?? null }));
}

export async function isReleased(mandateId: string, propertyId: string): Promise<boolean> {
  return Boolean(await prisma.presentation.findUnique({ where: { mandateId_propertyId: { mandateId, propertyId } } }));
}
