"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Availability } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { createProperty, setAvailability, updateProperty, type PropertyInput } from "@/lib/services/properties";
import { deleteFile, storeFile } from "@/lib/services/files";
import type { ActionResult } from "@/components/ui/action-form";

const schema = z.object({
  title: z.string().trim().min(2, "Titel fehlt").max(200),
  segment: z.enum(["FEWO", "APARTMENTHAUS", "PENSION_HOTEL"]),
  country: z.string().length(2),
  region: z.string().min(2, "Region fehlt"),
  locality: z.string().trim().max(200).nullable(),
  address: z.string().trim().max(300).nullable(),
  price: z.number().int().positive("Preis fehlt"),
  currency: z.string().length(3).default("EUR"),
  units: z.number().int().nonnegative().nullable(),
  livingArea: z.number().int().nonnegative().nullable(),
  licenseStatus: z.enum(["VORHANDEN", "BEANTRAGT", "FEHLT", "UNKLAR", "NICHT_NOETIG"]),
  licenseNote: z.string().trim().max(1000).nullable(),
  occupancyPct: z.number().min(0).max(100).nullable(),
  adr: z.number().int().nonnegative().nullable(),
  revenueYear: z.number().int().nonnegative().nullable(),
  features: z.array(z.string()),
  description: z.string().trim().max(5000).nullable(),
  source: z.enum(["PARTNER", "AGENTUR", "PORTAL", "OFFMARKET", "DIREKT"]),
  sourceDetail: z.string().trim().max(300).nullable(),
  knownSourceNote: z.string().trim().max(500).nullable(),
  knownSince: z.string().nullable().optional(),
  sellerLeadId: z.string().nullable(),
  offmarket: z.boolean(),
  referrerId: z.string().nullable(),
  partnerId: z.string().nullable(),
});

export type PropertyFormInput = z.input<typeof schema>;

export type SaveResult = { ok: true; id: string; duplicates: Array<{ id: string; title: string }>; matches: number; partnerWarning: string | null } | { ok: false; error: string };

async function partnerWarning(partnerId: string | null): Promise<string | null> {
  if (!partnerId) return null;
  const p = await prisma.partner.findUnique({ where: { id: partnerId } });
  return p && !p.agreementAt ? `Partner ${p.name} hat keine Partnervereinbarung. Provisionsanspruch klären.` : null;
}

export async function createPropertyAction(input: PropertyFormInput): Promise<SaveResult> {
  const user = await requirePermission("createProperty");
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues.map((i) => i.message).join(", ") };
  const d = parsed.data;
  const data: PropertyInput = { ...d, knownSince: d.knownSince ? new Date(d.knownSince) : null };
  const { property, duplicates, matching } = await createProperty(data, user);
  revalidatePath("/objekte");
  revalidatePath("/auftraege");
  return { ok: true, id: property.id, duplicates: duplicates.map((x) => ({ id: x.id, title: x.title })), matches: matching.created, partnerWarning: await partnerWarning(d.partnerId) };
}

export async function updatePropertyAction(id: string, input: PropertyFormInput): Promise<SaveResult> {
  const user = await requirePermission("editProperty");
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues.map((i) => i.message).join(", ") };
  const d = parsed.data;
  const { knownSince, knownSourceNote, ...rest } = d;
  const data: Partial<PropertyInput> = { ...rest };
  // Vorkenntnis nur durch Admin; sonst werden die Felder ignoriert
  if (user.role === "ADMIN" && (knownSince || knownSourceNote !== undefined)) {
    const before = await prisma.property.findUniqueOrThrow({ where: { id } });
    const ks = knownSince ? new Date(knownSince) : before.knownSince;
    if (ks.getTime() !== before.knownSince.getTime() || knownSourceNote !== before.knownSourceNote) {
      data.knownSince = ks;
      data.knownSourceNote = knownSourceNote;
    }
  }
  try {
    const { matching } = await updateProperty(id, data, user);
    revalidatePath(`/objekte/${id}`);
    revalidatePath("/objekte");
    return { ok: true, id, duplicates: [], matches: matching.created, partnerWarning: await partnerWarning(d.partnerId) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Speichern fehlgeschlagen" };
  }
}

export async function setAvailabilityAction(id: string, availability: Availability): Promise<ActionResult> {
  const user = await requirePermission("editProperty");
  const closed = await setAvailability(id, availability, user);
  revalidatePath(`/objekte/${id}`);
  revalidatePath("/objekte");
  revalidatePath("/auftraege");
  return { ok: true, message: closed > 0 ? `Verfügbarkeit gesetzt, ${closed} offene Treffer geschlossen.` : "Verfügbarkeit gesetzt." };
}

export async function uploadPropertyFilesAction(id: string, formData: FormData): Promise<ActionResult> {
  const user = await requirePermission("createProperty");
  const kind = formData.get("kind") === "DOCUMENT" ? "DOCUMENT" : "PHOTO";
  const files = formData.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) return { ok: false, error: "Keine Datei gewählt" };
  const property = await prisma.property.findUniqueOrThrow({ where: { id } });
  const ids: string[] = [];
  const errors: string[] = [];
  for (const f of files) {
    try {
      const stored = await storeFile(f, { entity: "Property", entityId: id, kind, userId: user.id });
      ids.push(stored.id);
    } catch (e) {
      errors.push(`${f.name}: ${e instanceof Error ? e.message : "Fehler"}`);
    }
  }
  const field = kind === "PHOTO" ? "photos" : "documents";
  const existing = Array.isArray(property[field]) ? (property[field] as string[]) : [];
  await prisma.property.update({ where: { id }, data: { [field]: [...existing, ...ids] } });
  await audit({ userId: user.id, action: "FILE_UPLOAD", entity: "Property", entityId: id, meta: { kind, count: ids.length } });
  revalidatePath(`/objekte/${id}`);
  return ids.length > 0 ? { ok: true, message: `${ids.length} Datei(en) hochgeladen.${errors.length ? " Fehler: " + errors.join(", ") : ""}` } : { ok: false, error: errors.join(", ") };
}

export async function deletePropertyFileAction(id: string, fileId: string): Promise<ActionResult> {
  const user = await requirePermission("editProperty");
  const property = await prisma.property.findUniqueOrThrow({ where: { id } });
  const photos = (property.photos as string[]).filter((x) => x !== fileId);
  const documents = (property.documents as string[]).filter((x) => x !== fileId);
  await prisma.property.update({ where: { id }, data: { photos, documents } });
  await deleteFile(fileId);
  await audit({ userId: user.id, action: "FILE_DELETE", entity: "Property", entityId: id, meta: { fileId } });
  revalidatePath(`/objekte/${id}`);
  return { ok: true };
}

export async function markDuplicateAction(id: string, originalId: string | null): Promise<ActionResult> {
  const user = await requirePermission("editProperty");
  await prisma.property.update({ where: { id }, data: { duplicateOfId: originalId } });
  await audit({ userId: user.id, action: "PROPERTY_UPDATE", entity: "Property", entityId: id, meta: { duplicateOfId: originalId } });
  revalidatePath(`/objekte/${id}`);
  return { ok: true, message: originalId ? "Als Dublette markiert." : "Dubletten-Markierung entfernt." };
}

export async function deletePropertyAction(id: string): Promise<void> {
  const user = await requirePermission("editProperty");
  await prisma.property.update({ where: { id }, data: { active: false, availability: "ZURUECKGEZOGEN" } });
  await audit({ userId: user.id, action: "PROPERTY_UPDATE", entity: "Property", entityId: id, meta: { active: false } });
  revalidatePath("/objekte");
  redirect("/objekte");
}
