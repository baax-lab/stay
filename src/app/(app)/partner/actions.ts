"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { PartnerType, ReferrerType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { audit } from "@/lib/audit";
import type { ActionResult } from "@/components/ui/action-form";

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
    language: str(fd, "language") === "en" ? "en" : "de",
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
