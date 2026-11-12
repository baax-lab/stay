"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { PartnerType, ReferrerType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { audit } from "@/lib/audit";
import type { ActionResult } from "@/components/ui/action-form";
import { createPartnerAccess, sendPartnerAccess, PARTNER_ACCESS_DAYS } from "@/lib/services/partner-access";
import { extendExpiry } from "@/lib/portal";
import { validRating } from "@/lib/partner-stats";

const str = (fd: FormData, k: string) => {
  const v = fd.get(k);
  return typeof v === "string" ? v.trim() : "";
};

function partnerData(fd: FormData) {
  return {
    name: str(fd, "name"),
    company: str(fd, "company") || null,
    email: str(fd, "email").toLowerCase() || null,
    phone: str(fd, "phone") || null,
    language: ["de", "en", "es", "it", "fr"].includes(str(fd, "language")) ? str(fd, "language") : "de",
    type: (str(fd, "type") || "MAKLER") as PartnerType,
    country: str(fd, "country").toUpperCase(),
    regions: fd.getAll("regions").filter((v): v is string => typeof v === "string" && v !== ""),
    licenseNote: str(fd, "licenseNote") || null,
    commissionSplit: str(fd, "commissionSplit") || null,
    agreementAt: str(fd, "agreementAt") ? new Date(str(fd, "agreementAt")) : null,
    active: fd.get("active") !== "off",
    note: str(fd, "note") || null,
  };
}

export async function createPartnerAction(formData: FormData): Promise<void> {
  const user = await requirePermission("editPartners");
  const data = partnerData(formData);
  if (!data.name || data.country.length !== 2) throw new Error("Name und Land sind Pflicht");
  const p = await prisma.partner.create({ data });
  await audit({ userId: user.id, action: "MANDATE_UPDATE", entity: "Partner", entityId: p.id, meta: { created: true } });
  redirect(`/partner/${p.id}`);
}

export async function updatePartnerAction(id: string, formData: FormData): Promise<ActionResult> {
  const user = await requirePermission("editPartners");
  const data = partnerData(formData);
  if (!data.name || data.country.length !== 2) return { ok: false, error: "Name und Land sind Pflicht" };
  await prisma.partner.update({ where: { id }, data });
  await audit({ userId: user.id, action: "MANDATE_UPDATE", entity: "Partner", entityId: id });
  revalidatePath(`/partner/${id}`);
  revalidatePath("/partner");
  return { ok: true, message: "Partner gespeichert." };
}

function referrerData(fd: FormData) {
  const pct = str(fd, "rewardPct").replace(",", ".");
  const flat = str(fd, "rewardFlat").replace(/[.\s€]/g, "");
  return {
    name: str(fd, "name"),
    company: str(fd, "company") || null,
    email: str(fd, "email").toLowerCase() || null,
    phone: str(fd, "phone") || null,
    hubContactId: str(fd, "hubContactId") || null,
    type: (str(fd, "type") || "TIPPGEBER") as ReferrerType,
    rewardRule: str(fd, "rewardRule") || null,
    rewardPct: pct ? Number(pct) / 100 : null,
    rewardFlat: flat ? Number(flat) : null,
    active: fd.get("active") !== "off",
    note: str(fd, "note") || null,
  };
}

export async function createReferrerAction(formData: FormData): Promise<void> {
  const user = await requirePermission("editPartners");
  const data = referrerData(formData);
  if (!data.name) throw new Error("Name ist Pflicht");
  const r = await prisma.referrer.create({ data });
  await audit({ userId: user.id, action: "MANDATE_UPDATE", entity: "Referrer", entityId: r.id, meta: { created: true } });
  redirect(`/tippgeber/${r.id}`);
}

export async function updateReferrerAction(id: string, formData: FormData): Promise<ActionResult> {
  const user = await requirePermission("editPartners");
  const data = referrerData(formData);
  if (!data.name) return { ok: false, error: "Name ist Pflicht" };
  await prisma.referrer.update({ where: { id }, data });
  await audit({ userId: user.id, action: "MANDATE_UPDATE", entity: "Referrer", entityId: id });
  revalidatePath(`/tippgeber/${id}`);
  revalidatePath("/tippgeber");
  return { ok: true, message: "Gespeichert." };
}

export async function setRewardDateAction(rewardId: string, field: "dueAt" | "paidAt", formData: FormData): Promise<ActionResult> {
  await requirePermission("viewRewards");
  const v = str(formData, field);
  const r = await prisma.referralReward.update({ where: { id: rewardId }, data: { [field]: v ? new Date(v) : null } });
  revalidatePath(`/tippgeber/${r.referrerId}`);
  revalidatePath(`/auftraege/${r.mandateId}`);
  return { ok: true, message: "Gespeichert." };
}

export async function createRewardAction(referrerId: string, formData: FormData): Promise<ActionResult> {
  await requirePermission("viewRewards");
  const mandateId = str(formData, "mandateId");
  const amount = Number(str(formData, "amount").replace(/[.\s€]/g, ""));
  if (!mandateId || !amount) return { ok: false, error: "Suchauftrag und Betrag angeben" };
  await prisma.referralReward.create({ data: { referrerId, mandateId, amount, basis: str(formData, "basis") || "manuell" } });
  revalidatePath(`/tippgeber/${referrerId}`);
  return { ok: true, message: "Prämie angelegt." };
}

// ---------- Phase 2: Partnerzugang und Bewertung ----------

export async function createPartnerAccessAction(partnerId: string, mandateId: string | null): Promise<{ ok: boolean; message: string; url?: string }> {
  const user = await requirePermission("sendExternal");
  const { url, access } = await createPartnerAccess(partnerId, user, mandateId);
  revalidatePath(`/partner/${partnerId}`);
  return { ok: true, message: `Link erstellt, gültig bis ${access.expiresAt.toLocaleDateString("de-DE")}. Er wird nur jetzt angezeigt.`, url };
}

export async function sendPartnerAccessAction(partnerId: string): Promise<{ ok: boolean; message: string; url?: string }> {
  const user = await requirePermission("sendExternal");
  const r = await sendPartnerAccess(partnerId, user);
  revalidatePath(`/partner/${partnerId}`);
  return r;
}

export async function extendPartnerAccessAction(partnerId: string, accessId: string): Promise<ActionResult> {
  const user = await requirePermission("sendExternal");
  await prisma.partnerAccess.update({ where: { id: accessId }, data: { expiresAt: extendExpiry(new Date(), PARTNER_ACCESS_DAYS), revokedAt: null } });
  await audit({ userId: user.id, action: "PORTAL_LINK", entity: "Partner", entityId: partnerId, meta: { extended: accessId } });
  revalidatePath(`/partner/${partnerId}`);
  return { ok: true, message: "Verlängert." };
}

export async function revokePartnerAccessAction(partnerId: string, accessId: string): Promise<ActionResult> {
  const user = await requirePermission("sendExternal");
  await prisma.partnerAccess.update({ where: { id: accessId }, data: { revokedAt: new Date() } });
  await audit({ userId: user.id, action: "PORTAL_LINK", entity: "Partner", entityId: partnerId, meta: { revoked: accessId } });
  revalidatePath(`/partner/${partnerId}`);
  return { ok: true, message: "Widerrufen." };
}

export async function ratePartnerAction(partnerId: string, formData: FormData): Promise<ActionResult> {
  const user = await requirePermission("editPartners");
  const n = (k: string) => Number(formData.get(k));
  const data = { reliability: n("reliability"), quality: n("quality"), speed: n("speed") };
  if (!validRating(data.reliability) || !validRating(data.quality) || !validRating(data.speed)) return { ok: false, error: "Bitte alle drei Bewertungen (1–5) wählen" };
  const mandateId = str(formData, "mandateId") || null;
  await prisma.partnerRating.create({ data: { partnerId, mandateId, ...data, comment: str(formData, "comment") || null, ratedById: user.id, ratedByName: user.name } });
  await audit({ userId: user.id, action: "PARTNER_RATING", entity: "Partner", entityId: partnerId, meta: { ...data, mandateId } });
  revalidatePath(`/partner/${partnerId}`);
  revalidatePath("/partner");
  return { ok: true, message: "Bewertung gespeichert." };
}
