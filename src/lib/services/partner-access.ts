import "server-only";
import type { Partner, PartnerAccess } from "@prisma/client";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { audit } from "@/lib/audit";
import { sendMail } from "@/lib/mail";
import { accessState, extendExpiry, generatePortalToken, hashPortalToken, looksLikeToken, type AccessState } from "@/lib/portal";
import { ACTIVE_STATUSES } from "@/lib/mandates";
import { asPartnerLang, partnerLocale, tp } from "@/lib/i18n/partner";

/** Partnerzugang per Link (Konzept §10, Modell „AccessLink“): Token nur gehasht, 90 Tage gültig. */
export const PARTNER_ACCESS_DAYS = 90;

export function partnerAccessUrl(token: string): string {
  return `${env.appUrl}/partner-zugang/${token}`;
}

export async function createPartnerAccess(partnerId: string, user: { id: string }, mandateId?: string | null): Promise<{ token: string; url: string; access: PartnerAccess }> {
  const { token, hash } = generatePortalToken();
  const access = await prisma.partnerAccess.create({ data: { partnerId, mandateId: mandateId ?? null, tokenHash: hash, expiresAt: extendExpiry(new Date(), PARTNER_ACCESS_DAYS), createdById: user.id } });
  await audit({ userId: user.id, action: "PORTAL_LINK", entity: "Partner", entityId: partnerId, meta: { accessId: access.id, mandateId: mandateId ?? null } });
  return { token, url: partnerAccessUrl(token), access };
}

export async function sendPartnerAccess(partnerId: string, user: { id: string }): Promise<{ ok: boolean; message: string; url?: string }> {
  const partner = await prisma.partner.findUniqueOrThrow({ where: { id: partnerId } });
  if (!partner.email) return { ok: false, message: "Beim Partner ist keine E-Mail-Adresse hinterlegt." };
  const lang = asPartnerLang(partner.language);
  const { url, access } = await createPartnerAccess(partnerId, user);
  const mail = await sendMail({
    to: partner.email,
    subject: tp(lang, "mail_subject"),
    text: tp(lang, "mail_body", { name: partner.name, url, date: access.expiresAt.toLocaleDateString(partnerLocale(lang)) }),
    userId: user.id,
    purpose: "partner-access",
    entity: "Partner",
    entityId: partnerId,
  });
  return mail.sent ? { ok: true, message: `Link an ${partner.email} gesendet.`, url } : { ok: false, message: `Link erstellt, Mail nicht gesendet (${mail.error}). Link manuell weitergeben:`, url };
}

export type PartnerPortal = { state: "valid"; access: PartnerAccess; partner: Partner } | { state: Exclude<AccessState, "valid"> | "unknown" };

export async function lookupPartnerAccess(token: string): Promise<PartnerPortal> {
  if (!looksLikeToken(token)) return { state: "unknown" };
  const a = await prisma.partnerAccess.findUnique({ where: { tokenHash: hashPortalToken(token) }, include: { partner: true } });
  if (!a || !a.partner.active) return { state: "unknown" };
  const st = accessState(a);
  if (st !== "valid") return { state: st };
  const { partner, ...access } = a;
  return { state: "valid", access, partner };
}

export async function openPartnerAccess(token: string, ip?: string): Promise<PartnerPortal> {
  const r = await lookupPartnerAccess(token);
  if (r.state !== "valid") {
    await audit({ action: "PORTAL_DENIED", entity: "PartnerAccess", meta: { reason: r.state }, ip });
    return r;
  }
  await prisma.partnerAccess.update({ where: { id: r.access.id }, data: { lastSeenAt: new Date(), viewCount: { increment: 1 } } });
  await audit({ action: "PORTAL_VIEW", entity: "Partner", entityId: r.partner.id, meta: { accessId: r.access.id }, ip });
  return r;
}

/** Anonymisierte Suchprofile, die zum Partner passen (Land, Regionen) oder auf die der Link beschränkt ist. */
export async function profilesForPartner(partner: Partner, mandateId: string | null) {
  const profiles = await prisma.searchProfile.findMany({
    where: { active: true, mandate: { status: { in: ACTIVE_STATUSES }, ...(mandateId ? { id: mandateId } : {}) } },
    include: { mandate: { select: { id: true } } },
  });
  return profiles.filter((p) => {
    if (mandateId) return true;
    const countryOk = p.countries.length === 0 || p.countries.includes(partner.country);
    const regionOk = partner.regions.length === 0 || p.regions.length === 0 || p.regions.some((r) => partner.regions.includes(r)) || !p.regions.some((r) => r.startsWith(partner.country.toLowerCase() + "-"));
    return countryOk && regionOk;
  });
}

export function mandateRef(mandateId: string): string {
  return `BS-${mandateId.slice(-6).toUpperCase()}`;
}
