"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { DocumentKind, MandateStatus, MatchStatus, OfferResponse } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { can } from "@/lib/permissions";
import { calculateFee } from "@/lib/fees";
import { closingTemplate, type ChecklistItem } from "@/lib/checklists";
import { logEvent } from "@/lib/services/events";
import { changeMandateStatus, createMandate, createMandateFromLead, ensureFeeAgreement, ensureFollowUp } from "@/lib/services/mandates";
import { runMatchingForMandate, setMatchStatus } from "@/lib/services/matching";
import { storeFile, deleteFile } from "@/lib/services/files";
import { createHubTask } from "@/lib/hub";

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string };

function rev(id: string) {
  revalidatePath(`/auftraege/${id}`);
  revalidatePath("/auftraege");
  revalidatePath("/");
}

const str = (fd: FormData, k: string) => {
  const v = fd.get(k);
  return typeof v === "string" ? v.trim() : "";
};
const num = (fd: FormData, k: string): number | null => {
  const v = str(fd, k).replace(/[.\s€]/g, "").replace(",", ".");
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n) : null;
};

export async function createMandateAction(formData: FormData): Promise<void> {
  const user = await requirePermission("editMandates");
  const input = z
    .object({
      buyerName: z.string().min(2, "Name des Käufers fehlt").max(200),
      buyerEmail: z.string().max(200).optional(),
      buyerPhone: z.string().max(50).optional(),
      title: z.string().min(2, "Titel fehlt").max(200),
      referrerId: z.string().optional(),
    })
    .parse({ buyerName: str(formData, "buyerName"), buyerEmail: str(formData, "buyerEmail"), buyerPhone: str(formData, "buyerPhone"), title: str(formData, "title"), referrerId: str(formData, "referrerId") });
  const m = await createMandate(user, { ...input, referrerId: input.referrerId || null, buyerEmail: input.buyerEmail || null, buyerPhone: input.buyerPhone || null });
  redirect(`/auftraege/${m.id}`);
}

export async function convertLeadAction(leadId: string): Promise<void> {
  const user = await requirePermission("editMandates");
  const m = await createMandateFromLead(leadId, user, {});
  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/leads");
  redirect(`/auftraege/${m.id}?tab=erstgespraech`);
}

export async function changeStatusAction(mandateId: string, formData: FormData): Promise<ActionResult> {
  const user = await requirePermission("editMandates");
  const target = str(formData, "status") as MandateStatus;
  const r = await changeMandateStatus(mandateId, target, user, {
    endReason: str(formData, "endReason") || null,
    purchasePrice: num(formData, "purchasePrice"),
    propertyId: str(formData, "propertyId") || null,
  });
  rev(mandateId);
  return r.ok ? { ok: true, message: "Status geändert." } : r;
}

export async function setGwgAction(mandateId: string, formData: FormData): Promise<ActionResult> {
  const user = await requirePermission("editMandates");
  const type = str(formData, "gwgIdentType");
  const dateStr = str(formData, "gwgIdentifiedAt");
  if (!type || !dateStr) return { ok: false, error: "Art und Datum der Identifizierung angeben" };
  const at = new Date(dateStr);
  await prisma.mandate.update({ where: { id: mandateId }, data: { gwgIdentifiedAt: at, gwgIdentType: type } });
  await logEvent(mandateId, "GWG_SET", { type, at: at.toISOString() }, user);
  rev(mandateId);
  return { ok: true, message: "GwG-Identifizierung gespeichert." };
}

export async function saveHeaderAction(mandateId: string, formData: FormData): Promise<ActionResult> {
  const user = await requirePermission("editMandates");
  const title = str(formData, "title");
  if (!title) return { ok: false, error: "Titel fehlt" };
  const endDate = str(formData, "endDate");
  const startDate = str(formData, "startDate");
  await prisma.mandate.update({
    where: { id: mandateId },
    data: {
      title,
      buyerName: str(formData, "buyerName") || undefined,
      buyerEmail: str(formData, "buyerEmail") || null,
      buyerPhone: str(formData, "buyerPhone") || null,
      hubContactId: str(formData, "hubContactId") || null,
      ownerId: str(formData, "ownerId") || undefined,
      ownerName: str(formData, "ownerName") || undefined,
      referrerId: str(formData, "referrerId") || null,
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null,
    },
  });
  await audit({ userId: user.id, action: "MANDATE_UPDATE", entity: "Mandate", entityId: mandateId, meta: { field: "header" } });
  rev(mandateId);
  return { ok: true, message: "Gespeichert." };
}

export async function saveNoteAction(mandateId: string, formData: FormData): Promise<ActionResult> {
  const user = await requirePermission("editMandates");
  const note = str(formData, "note").slice(0, 8000) || null;
  await prisma.mandate.update({ where: { id: mandateId }, data: { note } });
  await logEvent(mandateId, "NOTE", { note }, user);
  rev(mandateId);
  return { ok: true, message: "Notiz gespeichert." };
}

const profileSchema = z.object({
  segments: z.array(z.enum(["FEWO", "APARTMENTHAUS", "PENSION_HOTEL"])),
  countries: z.array(z.string().length(2)),
  regions: z.array(z.string()),
  priceMin: z.number().int().nonnegative().nullable(),
  priceMax: z.number().int().positive("Preis bis fehlt"),
  usageGoal: z.enum(["RENDITE", "EIGENNUTZUNG", "KOMBINIERT", "EIGENBETRIEB"]),
  minUnits: z.number().int().nonnegative().nullable(),
  maxUnits: z.number().int().nonnegative().nullable(),
  licenseRequired: z.boolean(),
  mustCriteria: z.array(z.string()),
  wishCriteria: z.array(z.object({ key: z.string(), weight: z.number().int().min(1).max(3) })),
  financing: z.string().max(2000).nullable(),
  horizon: z.string().max(500).nullable(),
  active: z.boolean(),
});
export type ProfileInput = z.input<typeof profileSchema>;

export async function saveProfileAction(mandateId: string, input: ProfileInput): Promise<ActionResult & { matches?: number }> {
  const user = await requirePermission("editMandates");
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues.map((i) => i.message).join(", ") };
  const d = parsed.data;
  await prisma.searchProfile.upsert({
    where: { mandateId },
    update: { ...d, mustCriteria: d.mustCriteria, wishCriteria: d.wishCriteria },
    create: { mandateId, ...d, mustCriteria: d.mustCriteria, wishCriteria: d.wishCriteria },
  });
  await logEvent(mandateId, "PROFILE_SAVED", { priceMax: d.priceMax, segments: d.segments, countries: d.countries, regions: d.regions }, user);
  const m = await runMatchingForMandate(mandateId);
  rev(mandateId);
  return { ok: true, message: `Suchprofil gespeichert. ${m.created} neue Treffer, ${m.updated} aktualisiert.`, matches: m.created };
}

export async function saveInterviewAction(mandateId: string, notes: Record<string, unknown>, assessment: string | null): Promise<ActionResult> {
  const user = await requirePermission("editMandates");
  await prisma.mandate.update({ where: { id: mandateId }, data: { interviewNotes: notes as object, assessment } });
  await logEvent(mandateId, "INTERVIEW_SAVED", { assessment }, user);
  rev(mandateId);
  return { ok: true, message: "Erstgespräch gespeichert." };
}

export async function saveFeeAction(mandateId: string, formData: FormData): Promise<ActionResult> {
  const user = await requirePermission("viewFees");
  await ensureFeeAgreement(mandateId);
  const bandId = str(formData, "volumeBandId") || null;
  const data = {
    volumeBandId: bandId,
    baseFeeActive: formData.get("baseFeeActive") === "on",
    baseFee: num(formData, "baseFee") ?? 0,
    successFee: num(formData, "successFee") ?? 0,
    bonusPct: (Number(str(formData, "bonusPct").replace(",", ".")) || 0) / 100,
    bonusCapPct: (Number(str(formData, "bonusCapPct").replace(",", ".")) || 0) / 100,
    travelFlat: num(formData, "travelFlat"),
    sellerSideCommission: num(formData, "sellerSideCommission"),
    sellerSideCredited: num(formData, "sellerSideCredited"),
    note: str(formData, "note") || null,
    purchasePrice: num(formData, "purchasePrice"),
    askingPrice: num(formData, "askingPrice"),
    invoicedAt: str(formData, "invoicedAt") ? new Date(str(formData, "invoicedAt")) : null,
    paidAt: str(formData, "paidAt") ? new Date(str(formData, "paidAt")) : null,
  };
  const calc = calculateFee({ ...data, askingPrice: data.askingPrice, purchasePrice: data.purchasePrice });
  await prisma.feeAgreement.update({ where: { mandateId }, data: { ...data, bonusAmount: data.purchasePrice ? calc.bonus : null } });
  await logEvent(mandateId, "FEE_SAVED", { successFee: data.successFee, baseFeeActive: data.baseFeeActive, bonus: calc.bonus, total: calc.total }, user);
  await audit({ userId: user.id, action: "FEE_UPDATE", entity: "Mandate", entityId: mandateId });
  rev(mandateId);
  return { ok: true, message: "Honorar gespeichert." };
}

export async function matchStatusAction(mandateId: string, matchId: string, status: MatchStatus, rejectReason: string | null, channel?: string): Promise<ActionResult> {
  const user = await requirePermission("editMandates");
  const r = await setMatchStatus(matchId, status, user, { rejectReason, channel });
  rev(mandateId);
  if (r.ok) return { ok: true, message: status === "AN_KAEUFER" ? "Objekt vorgestellt, Angebotspreis eingefroren." : "Treffer aktualisiert." };
  return { ok: false, error: r.error };
}

export async function setViewingAction(mandateId: string, matchId: string, formData: FormData): Promise<ActionResult> {
  const user = await requirePermission("editMandates");
  const at = str(formData, "viewingAt");
  const note = str(formData, "viewingNote") || null;
  const m = await prisma.match.update({ where: { id: matchId }, data: { viewingAt: at ? new Date(at) : null, viewingNote: note }, include: { property: { select: { title: true } } } });
  await logEvent(mandateId, "VIEWING_SET", { propertyTitle: m.property.title, at: at || null, note }, user);
  rev(mandateId);
  return { ok: true, message: "Besichtigung gespeichert." };
}

export async function addOfferAction(mandateId: string, formData: FormData): Promise<ActionResult> {
  const user = await requirePermission("editMandates");
  const propertyId = str(formData, "propertyId");
  const amount = num(formData, "amount");
  const madeAt = str(formData, "madeAt");
  if (!propertyId || !amount || !madeAt) return { ok: false, error: "Objekt, Betrag und Datum angeben" };
  const offer = await prisma.offer.create({
    data: { mandateId, propertyId, amount, madeAt: new Date(madeAt), conditions: str(formData, "conditions") || null, note: str(formData, "note") || null, createdById: user.id },
    include: { property: { select: { title: true } } },
  });
  await logEvent(mandateId, "OFFER", { propertyTitle: offer.property.title, amount, conditions: offer.conditions }, user);
  rev(mandateId);
  return { ok: true, message: "Angebot erfasst." };
}

export async function respondOfferAction(mandateId: string, offerId: string, formData: FormData): Promise<ActionResult> {
  const user = await requirePermission("editMandates");
  const response = str(formData, "response") as OfferResponse;
  const counterAmount = num(formData, "counterAmount");
  if (response === "GEGENANGEBOT" && !counterAmount) return { ok: false, error: "Gegenangebot braucht einen Betrag" };
  const offer = await prisma.offer.update({ where: { id: offerId }, data: { response, counterAmount, note: str(formData, "note") || undefined }, include: { property: { select: { title: true } } } });
  await logEvent(mandateId, "OFFER", { propertyTitle: offer.property.title, amount: offer.amount, response, counterAmount }, user);
  rev(mandateId);
  return { ok: true, message: "Antwort gespeichert." };
}

export async function ensureClosingAction(mandateId: string, propertyId: string): Promise<ActionResult> {
  await requirePermission("editMandates");
  const property = await prisma.property.findUniqueOrThrow({ where: { id: propertyId } });
  await prisma.closing.upsert({
    where: { mandateId },
    update: {},
    create: { mandateId, propertyId, country: property.country, checklist: closingTemplate(property.country) },
  });
  rev(mandateId);
  return { ok: true, message: "Kaufabwicklung angelegt." };
}

export async function updateClosingAction(mandateId: string, formData: FormData): Promise<ActionResult> {
  const user = await requirePermission("editMandates");
  const closing = await prisma.closing.findUniqueOrThrow({ where: { mandateId } });
  const items = (closing.checklist as ChecklistItem[]).map((item) => {
    const done = formData.get(`done:${item.key}`) === "on";
    const dueAt = str(formData, `due:${item.key}`) || null;
    return { ...item, done, doneAt: done ? (item.doneAt ?? new Date().toISOString()) : null, dueAt, note: str(formData, `note:${item.key}`) || null };
  });
  const notaryDate = str(formData, "notaryDate");
  const handoverDate = str(formData, "handoverDate");
  await prisma.closing.update({
    where: { mandateId },
    data: { checklist: items, notaryDate: notaryDate ? new Date(notaryDate) : null, handoverDate: handoverDate ? new Date(handoverDate) : null },
  });

  // Fällige offene Punkte → Aufgabe im Hub (einmalig je Punkt)
  const mandate = await prisma.mandate.findUniqueOrThrow({ where: { id: mandateId } });
  for (const item of items) {
    if (!item.done && item.dueAt && !item.hubTaskAt) {
      const r = await createHubTask({ contactId: mandate.hubContactId, title: `Kaufabwicklung ${mandate.title}: ${item.label}`, dueAt: new Date(item.dueAt).toISOString(), assigneeId: mandate.ownerId, externalRef: `baax-stay:closing:${mandateId}:${item.key}` });
      if (r.ok) item.hubTaskAt = new Date().toISOString();
    }
  }
  await prisma.closing.update({ where: { mandateId }, data: { checklist: items } });

  if (handoverDate) await ensureFollowUp(mandateId, new Date(handoverDate));

  await logEvent(mandateId, "CLOSING_UPDATE", { done: items.filter((i) => i.done).length, total: items.length, notaryDate: notaryDate || null, handoverDate: handoverDate || null }, user);
  rev(mandateId);
  return { ok: true, message: "Kaufabwicklung gespeichert." };
}

export async function saveFollowUpAction(mandateId: string, followUpId: string, formData: FormData): Promise<ActionResult> {
  const user = await requirePermission("editMandates");
  const done = formData.get("done") === "on";
  await prisma.followUp.update({
    where: { id: followUpId },
    data: {
      doneAt: done ? new Date() : null,
      feedback: str(formData, "feedback") || null,
      referralGiven: formData.get("referralGiven") === "on",
      nextMandateWanted: formData.get("nextMandateWanted") === "on",
      dueAt: str(formData, "dueAt") ? new Date(str(formData, "dueAt")) : undefined,
    },
  });
  await logEvent(mandateId, "FOLLOWUP", { done, referralGiven: formData.get("referralGiven") === "on", nextMandateWanted: formData.get("nextMandateWanted") === "on" }, user);
  rev(mandateId);
  return { ok: true, message: "Nachbetreuung gespeichert." };
}

export async function createFollowUpAction(mandateId: string, formData: FormData): Promise<ActionResult> {
  await requirePermission("editMandates");
  const dueAt = str(formData, "dueAt");
  if (!dueAt) return { ok: false, error: "Datum fehlt" };
  await prisma.followUp.create({ data: { mandateId, dueAt: new Date(dueAt) } });
  rev(mandateId);
  return { ok: true };
}

export async function uploadDocumentAction(mandateId: string, formData: FormData): Promise<ActionResult> {
  const user = await requirePermission("editMandates");
  const kind = str(formData, "kind") as DocumentKind;
  if (kind === "GWG_NACHWEIS" && !can.viewGwgDocuments(user.role)) return { ok: false, error: "GwG-Nachweise nur durch Leitung/Admin" };
  const file = formData.get("file");
  if (!(file instanceof File)) return { ok: false, error: "Keine Datei gewählt" };
  try {
    const stored = await storeFile(file, { entity: "Mandate", entityId: mandateId, kind, userId: user.id });
    await prisma.mandateDocument.create({ data: { mandateId, kind, fileId: stored.id, label: str(formData, "label") || null, uploadedById: user.id } });
    await logEvent(mandateId, "DOCUMENT", { kind, fileName: stored.fileName }, user);
    await audit({ userId: user.id, action: "FILE_UPLOAD", entity: "Mandate", entityId: mandateId, meta: { kind, fileId: stored.id } });
    rev(mandateId);
    return { ok: true, message: "Dokument hochgeladen." };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Upload fehlgeschlagen" };
  }
}

export async function deleteDocumentAction(mandateId: string, documentId: string): Promise<ActionResult> {
  const user = await requirePermission("editMandates");
  const doc = await prisma.mandateDocument.findUniqueOrThrow({ where: { id: documentId } });
  if (doc.kind === "GWG_NACHWEIS" && !can.viewGwgDocuments(user.role)) return { ok: false, error: "Keine Berechtigung" };
  await prisma.mandateDocument.delete({ where: { id: documentId } });
  await deleteFile(doc.fileId);
  await audit({ userId: user.id, action: "FILE_DELETE", entity: "Mandate", entityId: mandateId, meta: { fileId: doc.fileId } });
  rev(mandateId);
  return { ok: true };
}

export async function markRewardAction(mandateId: string, rewardId: string, field: "dueAt" | "paidAt", value: string | null): Promise<ActionResult> {
  await requirePermission("viewRewards");
  await prisma.referralReward.update({ where: { id: rewardId }, data: { [field]: value ? new Date(value) : null } });
  rev(mandateId);
  revalidatePath("/tippgeber");
  return { ok: true };
}
