"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { createHubAppointment } from "@/lib/hub";
import { TRIP_COST_CATEGORIES, type TripCostCategory } from "@/lib/trips";
import { deleteFile, storeFile } from "@/lib/services/files";
import { logEvent } from "@/lib/services/events";
import type { ActionResult } from "@/components/ui/action-form";

/** Reisen und Reisekosten je Suchauftrag (Konzept §10). */

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const rev = (id: string) => revalidatePath(`/auftraege/${id}`);

export async function createTripAction(mandateId: string, formData: FormData): Promise<ActionResult> {
  const user = await requirePermission("editMandates");
  const title = str(formData, "title");
  const start = str(formData, "startDate");
  if (!title || !start) return { ok: false, error: "Titel und Beginn angeben" };
  const end = str(formData, "endDate");
  const trip = await prisma.trip.create({
    data: {
      mandateId,
      title,
      destination: str(formData, "destination") || null,
      startDate: new Date(start),
      endDate: end ? new Date(end) : null,
      travelers: str(formData, "travelers") || null,
      billable: formData.get("billable") === "on",
      note: str(formData, "note") || null,
      createdById: user.id,
    },
  });
  const mandate = await prisma.mandate.findUniqueOrThrow({ where: { id: mandateId } });
  const hub = await createHubAppointment({ contactId: mandate.hubContactId, title: `Reise: ${title}`, start: trip.startDate.toISOString(), end: trip.endDate?.toISOString() ?? null, location: trip.destination, description: `Suchauftrag ${mandate.title}`, ownerId: mandate.ownerId, externalRef: `baax-stay:trip:${trip.id}` });
  await logEvent(mandateId, "TRIP", { tripId: trip.id, title, destination: trip.destination, start: start }, user);
  await audit({ userId: user.id, action: "TRIP_UPDATE", entity: "Mandate", entityId: mandateId, meta: { tripId: trip.id, hub: hub.ok } });
  rev(mandateId);
  return { ok: true, message: `Reise angelegt${hub.ok ? " und als Termin im Hub eingetragen" : ""}.` };
}

export async function addTripCostAction(mandateId: string, tripId: string, formData: FormData): Promise<ActionResult> {
  const user = await requirePermission("editMandates");
  const category = str(formData, "category") as TripCostCategory;
  const amount = Number(str(formData, "amount").replace(/\./g, "").replace(",", "."));
  if (!TRIP_COST_CATEGORIES.includes(category) || !(amount > 0)) return { ok: false, error: "Kategorie und Betrag angeben" };
  let receiptFileId: string | null = null;
  const receipt = formData.get("receipt");
  if (receipt instanceof File && receipt.size > 0) {
    try {
      receiptFileId = (await storeFile(receipt, { entity: "Trip", entityId: tripId, kind: "RECEIPT", userId: user.id })).id;
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "Beleg konnte nicht gespeichert werden" };
    }
  }
  await prisma.tripCost.create({ data: { tripId, category, amount: Math.round(amount), description: str(formData, "description") || null, date: str(formData, "date") ? new Date(str(formData, "date")) : new Date(), receiptFileId } });
  await audit({ userId: user.id, action: "TRIP_UPDATE", entity: "Mandate", entityId: mandateId, meta: { tripId, category, amount } });
  rev(mandateId);
  return { ok: true, message: "Kosten erfasst." };
}

export async function deleteTripCostAction(mandateId: string, costId: string): Promise<ActionResult> {
  await requirePermission("editMandates");
  const c = await prisma.tripCost.delete({ where: { id: costId } });
  if (c.receiptFileId) await deleteFile(c.receiptFileId);
  rev(mandateId);
  return { ok: true };
}

export async function toggleTripBillableAction(mandateId: string, tripId: string): Promise<ActionResult> {
  await requirePermission("editMandates");
  const t = await prisma.trip.findUniqueOrThrow({ where: { id: tripId } });
  await prisma.trip.update({ where: { id: tripId }, data: { billable: !t.billable } });
  rev(mandateId);
  return { ok: true, message: t.billable ? "Nicht mehr abrechenbar." : "Abrechenbar." };
}

export async function deleteTripAction(mandateId: string, tripId: string): Promise<ActionResult> {
  await requirePermission("editMandates");
  const costs = await prisma.tripCost.findMany({ where: { tripId } });
  for (const c of costs) if (c.receiptFileId) await deleteFile(c.receiptFileId);
  await prisma.trip.delete({ where: { id: tripId } });
  rev(mandateId);
  return { ok: true, message: "Reise gelöscht." };
}
