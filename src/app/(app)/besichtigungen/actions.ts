"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Recommendation } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { averageRating, inspectionTemplate, type InspectionItem } from "@/lib/precheck";
import { copyStoredFile, deleteFile, storeFile } from "@/lib/services/files";
import { logEvent } from "@/lib/services/events";
import type { ActionResult } from "@/components/ui/action-form";

/** Besichtigungsprotokoll mobil am Objekt (Konzept §10). */

export async function createInspectionAction(formData: FormData): Promise<void> {
  const user = await requirePermission("editMandates");
  const propertyId = String(formData.get("propertyId") ?? "");
  const mandateId = String(formData.get("mandateId") ?? "") || null;
  const tripId = String(formData.get("tripId") ?? "") || null;
  const date = String(formData.get("date") ?? "");
  await prisma.property.findUniqueOrThrow({ where: { id: propertyId } });
  const i = await prisma.inspection.create({
    data: { propertyId, mandateId, tripId, date: date ? new Date(date) : new Date(), items: inspectionTemplate(), createdById: user.id, createdByName: user.name },
  });
  await audit({ userId: user.id, action: "INSPECTION_UPDATE", entity: "Inspection", entityId: i.id, meta: { created: true, propertyId, mandateId } });
  redirect(`/besichtigungen/${i.id}`);
}

export type InspectionPayload = {
  date: string;
  attendees: string;
  items: InspectionItem[];
  rating: number | null;
  recommendation: Recommendation | null;
  notes: string;
};

export async function saveInspectionAction(id: string, payload: InspectionPayload, complete: boolean): Promise<ActionResult> {
  const user = await requirePermission("editMandates");
  const insp = await prisma.inspection.findUniqueOrThrow({ where: { id }, include: { property: { select: { title: true } } } });
  if (insp.status === "ABGESCHLOSSEN" && !complete) return { ok: false, error: "Protokoll ist abgeschlossen." };
  const items = payload.items.map((i) => ({ key: i.key, label: i.label, rating: i.rating && i.rating >= 1 && i.rating <= 5 ? i.rating : null, note: i.note?.trim() || null }));
  const rating = payload.rating ?? (averageRating(items) != null ? Math.round(averageRating(items)!) : null);
  if (complete && !payload.recommendation) return { ok: false, error: "Für den Abschluss bitte eine Empfehlung wählen." };
  await prisma.inspection.update({
    where: { id },
    data: {
      date: payload.date ? new Date(payload.date) : insp.date,
      attendees: payload.attendees.trim() || null,
      items,
      rating,
      recommendation: payload.recommendation,
      notes: payload.notes.trim() || null,
      ...(complete ? { status: "ABGESCHLOSSEN" } : {}),
    },
  });
  if (complete && insp.mandateId) {
    // Besichtigung am Treffer vermerken und im Verlauf protokollieren
    await prisma.match.updateMany({ where: { mandateId: insp.mandateId, propertyId: insp.propertyId }, data: { viewingAt: payload.date ? new Date(payload.date) : insp.date, viewingNote: `Protokoll: ${rating ?? "–"}/5, ${payload.recommendation}` } });
    await logEvent(insp.mandateId, "INSPECTION", { inspectionId: id, propertyTitle: insp.property.title, rating, recommendation: payload.recommendation }, user);
  }
  await audit({ userId: user.id, action: "INSPECTION_UPDATE", entity: "Inspection", entityId: id, meta: { complete } });
  revalidatePath(`/besichtigungen/${id}`);
  return { ok: true, message: complete ? "Protokoll abgeschlossen." : "Gespeichert." };
}

export async function uploadInspectionPhotosAction(id: string, formData: FormData): Promise<ActionResult> {
  const user = await requirePermission("editMandates");
  const insp = await prisma.inspection.findUniqueOrThrow({ where: { id } });
  const ids: string[] = [];
  const errors: string[] = [];
  for (const f of formData.getAll("photos")) {
    if (!(f instanceof File) || f.size === 0) continue;
    if (!f.type.startsWith("image/")) {
      errors.push(`${f.name}: kein Bild`);
      continue;
    }
    try {
      ids.push((await storeFile(f, { entity: "Inspection", entityId: id, kind: "PHOTO", userId: user.id })).id);
    } catch (e) {
      errors.push(`${f.name}: ${e instanceof Error ? e.message : "Fehler"}`);
    }
  }
  if (ids.length) await prisma.inspection.update({ where: { id }, data: { photos: [...((insp.photos as string[]) ?? []), ...ids] } });
  revalidatePath(`/besichtigungen/${id}`);
  return ids.length ? { ok: true, message: `${ids.length} Foto(s) gespeichert.${errors.length ? ` ${errors.join(", ")}` : ""}` } : { ok: false, error: errors.join(", ") || "Kein Foto gewählt" };
}

export async function deleteInspectionPhotoAction(id: string, fileId: string): Promise<ActionResult> {
  await requirePermission("editMandates");
  const insp = await prisma.inspection.findUniqueOrThrow({ where: { id } });
  await prisma.inspection.update({ where: { id }, data: { photos: (insp.photos as string[]).filter((x) => x !== fileId) } });
  await deleteFile(fileId);
  revalidatePath(`/besichtigungen/${id}`);
  return { ok: true };
}

/** Fotos der Besichtigung als Objektfotos übernehmen (Kopie, damit Portal und Dossier sie zeigen können). */
export async function adoptInspectionPhotosAction(id: string): Promise<ActionResult> {
  const user = await requirePermission("editProperty");
  const insp = await prisma.inspection.findUniqueOrThrow({ where: { id }, include: { property: true } });
  const photos = (insp.photos as string[]) ?? [];
  if (!photos.length) return { ok: false, error: "Keine Fotos vorhanden" };
  const copies: string[] = [];
  for (const fileId of photos) copies.push((await copyStoredFile(fileId, { entity: "Property", entityId: insp.propertyId, kind: "PHOTO", userId: user.id })).id);
  await prisma.property.update({ where: { id: insp.propertyId }, data: { photos: [...((insp.property.photos as string[]) ?? []), ...copies] } });
  await audit({ userId: user.id, action: "FILE_UPLOAD", entity: "Property", entityId: insp.propertyId, meta: { fromInspection: id, count: copies.length } });
  revalidatePath(`/objekte/${insp.propertyId}`);
  return { ok: true, message: `${copies.length} Foto(s) ins Objekt übernommen.` };
}
