"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { deriveLicenseLight } from "@/lib/license";
import type { ActionResult } from "@/components/ui/action-form";

/** Länder- und Regionswissen pflegen (Phase 3, Leitung/Admin). */

const s = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim() || null;
const n = (fd: FormData, k: string, float = false) => {
  const raw = String(fd.get(k) ?? "").trim().replace(/\s/g, "");
  if (!raw) return null;
  const v = Number(float ? raw.replace(",", ".") : raw.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(v) ? (float ? v : Math.round(v)) : null;
};

export async function saveCountryAction(code: string, formData: FormData): Promise<ActionResult> {
  const user = await requirePermission("editEventSetting");
  const reviewed = formData.get("reviewed") === "on";
  await prisma.country.upsert({
    where: { code },
    update: {
      name: s(formData, "name") ?? code,
      nameEn: s(formData, "nameEn"),
      currency: (s(formData, "currency") ?? "EUR").toUpperCase(),
      overview: s(formData, "overview"),
      buyingProcess: s(formData, "buyingProcess"),
      foreignBuyers: s(formData, "foreignBuyers"),
      taxesNote: s(formData, "taxesNote"),
      typicalDuration: s(formData, "typicalDuration"),
      financingNote: s(formData, "financingNote"),
      sources: s(formData, "sources"),
      ...(reviewed ? { reviewedAt: new Date(), reviewedByName: user.name } : {}),
    },
    create: { code, name: s(formData, "name") ?? code },
  });
  await audit({ userId: user.id, action: "SETTING_UPDATE", entity: "Country", entityId: code, meta: { reviewed } });
  revalidatePath(`/wissen/${code}`);
  revalidatePath("/wissen");
  return { ok: true, message: reviewed ? "Gespeichert und als geprüft markiert." : "Gespeichert." };
}

export async function saveRegionKnowledgeAction(key: string, formData: FormData): Promise<ActionResult> {
  const user = await requirePermission("editEventSetting");
  const reviewed = formData.get("reviewed") === "on";
  const region = await prisma.region.update({
    where: { key },
    data: {
      licenseRule: s(formData, "licenseRule"),
      description: s(formData, "description"),
      rentalRules: s(formData, "rentalRules"),
      secondHomeRules: s(formData, "secondHomeRules"),
      taxNote: s(formData, "taxNote"),
      seasonality: s(formData, "seasonality"),
      pricePerSqmMin: n(formData, "pricePerSqmMin"),
      pricePerSqmMax: n(formData, "pricePerSqmMax"),
      occupancyMin: n(formData, "occupancyMin", true),
      occupancyMax: n(formData, "occupancyMax", true),
      adrMin: n(formData, "adrMin"),
      adrMax: n(formData, "adrMax"),
      airportNote: s(formData, "airportNote"),
      risks: s(formData, "risks"),
      sources: s(formData, "sources"),
      focus: formData.get("focus") === "on",
      ...(reviewed ? { reviewedAt: new Date(), reviewedByName: user.name } : {}),
    },
  });
  // Ampel der Objekte dieser Region an die (ggf. geänderte) Kurzregel anpassen
  const props = await prisma.property.findMany({ where: { region: key }, select: { id: true, licenseStatus: true } });
  for (const p of props) await prisma.property.update({ where: { id: p.id }, data: { licenseLight: deriveLicenseLight(p.licenseStatus, region.licenseRule).light } });
  await audit({ userId: user.id, action: "SETTING_UPDATE", entity: "Region", entityId: key, meta: { reviewed, knowledge: true } });
  revalidatePath(`/wissen/region/${key}`);
  revalidatePath(`/wissen/${region.country}`);
  return { ok: true, message: reviewed ? "Gespeichert und als geprüft markiert." : "Gespeichert." };
}
