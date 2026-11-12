"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { audit } from "@/lib/audit";
import { rateLimit } from "@/lib/rate-limit";
import { sendMail } from "@/lib/mail";
import { hashPortalToken } from "@/lib/portal";
import { createProperty } from "@/lib/services/properties";
import { storeFile } from "@/lib/services/files";
import { logEvent } from "@/lib/services/events";
import { lookupPartnerAccess, mandateRef, profilesForPartner } from "@/lib/services/partner-access";

/** Objekt-Einreichung über den Partnerzugang: legt Property mit source = PARTNER und knownSince an (Konzept §10). */

const schema = z.object({
  ref: z.string().max(40).optional(),
  title: z.string().trim().min(3).max(200),
  segment: z.enum(["FEWO", "APARTMENTHAUS", "PENSION_HOTEL"]),
  region: z.string().min(2).max(80),
  locality: z.string().trim().max(200).optional(),
  price: z.number().int().positive(),
  currency: z.enum(["EUR", "CHF", "GBP"]).default("EUR"),
  units: z.number().int().nonnegative().nullable(),
  livingArea: z.number().int().nonnegative().nullable(),
  licenseStatus: z.enum(["VORHANDEN", "BEANTRAGT", "FEHLT", "UNKLAR", "NICHT_NOETIG"]),
  occupancyPct: z.number().min(0).max(100).nullable(),
  adr: z.number().int().nonnegative().nullable(),
  revenueYear: z.number().int().nonnegative().nullable(),
  features: z.array(z.string().max(60)).max(40),
  description: z.string().trim().max(5000).optional(),
  link: z.string().trim().max(500).optional(),
  contact: z.string().trim().max(1000).optional(),
});

export type SubmitResult = { ok: true; date: string } | { ok: false; error: string };

export async function submitPropertyAction(token: string, formData: FormData): Promise<SubmitResult> {
  const r = await lookupPartnerAccess(token);
  if (r.state !== "valid") return { ok: false, error: "denied" };
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || undefined;
  if (!rateLimit(`partner-submit:${hashPortalToken(token)}`, 20, 60 * 60 * 1000).ok) return { ok: false, error: "rate" };

  const num = (k: string, float = false) => {
    const raw = String(formData.get(k) ?? "").trim().replace(/\s/g, "");
    if (!raw) return null;
    const v = Number(float ? raw.replace(",", ".") : raw.replace(/[.,](?=\d{3}\b)/g, "").replace(",", "."));
    return Number.isFinite(v) ? (float ? v : Math.round(v)) : null;
  };
  const parsed = schema.safeParse({
    ref: String(formData.get("ref") ?? "") || undefined,
    title: String(formData.get("title") ?? ""),
    segment: String(formData.get("segment") ?? ""),
    region: String(formData.get("region") ?? ""),
    locality: String(formData.get("locality") ?? "") || undefined,
    price: num("price") ?? 0,
    currency: String(formData.get("currency") ?? "EUR"),
    units: num("units"),
    livingArea: num("livingArea"),
    licenseStatus: String(formData.get("licenseStatus") ?? "UNKLAR"),
    occupancyPct: num("occupancyPct", true),
    adr: num("adr"),
    revenueYear: num("revenueYear"),
    features: formData.getAll("features").map(String),
    description: String(formData.get("description") ?? "") || undefined,
    link: String(formData.get("link") ?? "") || undefined,
    contact: String(formData.get("contact") ?? "") || undefined,
  });
  if (!parsed.success) return { ok: false, error: "invalid" };
  const d = parsed.data;

  const partner = r.partner;
  const region = await prisma.region.findUnique({ where: { key: d.region } });
  if (!region) return { ok: false, error: "invalid" };

  // Bezug zu einem Suchprofil nur, wenn dieses Profil dem Partner auch angezeigt wird
  const profiles = await profilesForPartner(partner, r.access.mandateId);
  const refMandate = d.ref ? profiles.find((p) => mandateRef(p.mandateId) === d.ref)?.mandateId : undefined;
  const now = new Date();
  const actor = { id: `partner:${partner.id}`, name: partner.name, email: partner.email ?? "", role: "PRAKTIKANT" as const };

  const { property, matching } = await createProperty(
    {
      title: d.title,
      segment: d.segment,
      country: region.country,
      region: region.key,
      locality: d.locality ?? null,
      price: d.price,
      currency: d.currency,
      units: d.units,
      livingArea: d.livingArea,
      licenseStatus: d.licenseStatus,
      occupancyPct: d.occupancyPct,
      adr: d.adr,
      revenueYear: d.revenueYear,
      features: d.features,
      description: [d.description, d.contact ? `Hinweis des Partners: ${d.contact}` : null].filter(Boolean).join("\n\n") || null,
      source: "PARTNER",
      sourceDetail: d.link ?? `Partnerzugang ${partner.name}`,
      knownSince: now,
      knownSourceNote: `Eingereicht über Partnerzugang von ${partner.name}${partner.company ? ` (${partner.company})` : ""} am ${now.toLocaleString("de-DE")}${d.ref ? `, Bezug ${d.ref}` : ""}`,
      partnerId: partner.id,
      offmarket: false,
    },
    actor,
  );
  await prisma.property.update({ where: { id: property.id }, data: { submittedViaAccessId: r.access.id } });

  // Fotos und Unterlagen
  const photos: string[] = [];
  const docs: string[] = [];
  for (const [field, kind, list] of [
    ["photos", "PHOTO", photos],
    ["documents", "DOCUMENT", docs],
  ] as const) {
    for (const f of formData.getAll(field)) {
      if (!(f instanceof File) || f.size === 0) continue;
      if (kind === "PHOTO" && !f.type.startsWith("image/")) continue;
      try {
        const s = await storeFile(f, { entity: "Property", entityId: property.id, kind, userId: actor.id });
        list.push(s.id);
      } catch {
        // ungültige Datei überspringen, Einreichung bleibt gültig
      }
    }
  }
  if (photos.length || docs.length) await prisma.property.update({ where: { id: property.id }, data: { photos, documents: docs } });

  await audit({ action: "PARTNER_SUBMIT", entity: "Property", entityId: property.id, meta: { partnerId: partner.id, accessId: r.access.id, ref: d.ref ?? null, matches: matching.created }, ip });

  // Verantwortliche informieren
  const owner = refMandate ? await prisma.mandate.findUnique({ where: { id: refMandate } }) : null;
  if (owner) await logEvent(owner.id, "PARTNER_SUBMISSION", { propertyId: property.id, propertyTitle: property.title, partnerName: partner.name }, { id: actor.id, name: partner.name });
  const to = owner?.ownerEmail ?? env.adminEmail;
  if (to) {
    await sendMail({
      to,
      subject: `Neues Objekt von ${partner.name}: ${property.title}`,
      text: `${partner.name} hat über den Partnerzugang ein Objekt eingereicht${d.ref ? ` (Bezug ${d.ref})` : ""}.\n\n${property.title}, ${region.name}, ${d.price.toLocaleString("de-DE")} ${d.currency}\nNeue Treffer: ${matching.created}\n\n${env.appUrl}/objekte/${property.id}`,
      purpose: "partner-submission",
      entity: "Property",
      entityId: property.id,
    });
  }

  revalidatePath(`/partner-zugang/${token}`);
  return { ok: true, date: now.toISOString() };
}
