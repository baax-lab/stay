"use server";

import { revalidatePath } from "next/cache";
import type { LeadStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { mergeLead } from "@/lib/lead-service";
import { syncLeadToHub, syncPendingLeads } from "@/lib/hub";

const ALLOWED_STATUS: LeadStatus[] = ["NEU", "KONTAKTIERT", "ERSTGESPRAECH", "VERWORFEN"];

export async function updateLeadStatusAction(leadId: string, status: LeadStatus): Promise<void> {
  const user = await requirePermission("editLead");
  if (!ALLOWED_STATUS.includes(status)) throw new Error("Status nicht erlaubt (UMGEWANDELT wird über den Suchauftrag gesetzt)");
  const before = await prisma.lead.findUniqueOrThrow({ where: { id: leadId }, select: { status: true } });
  await prisma.lead.update({ where: { id: leadId }, data: { status } });
  await audit({ userId: user.id, action: "LEAD_UPDATE", entity: "Lead", entityId: leadId, meta: { field: "status", from: before.status, to: status } });
  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/leads");
}

export async function updateLeadNoteAction(leadId: string, formData: FormData): Promise<void> {
  const user = await requirePermission("editLead");
  const note = String(formData.get("note") ?? "").trim().slice(0, 4000) || null;
  await prisma.lead.update({ where: { id: leadId }, data: { note } });
  await audit({ userId: user.id, action: "LEAD_UPDATE", entity: "Lead", entityId: leadId, meta: { field: "note" } });
  revalidatePath(`/leads/${leadId}`);
}

export async function mergeLeadAction(sourceId: string, targetId: string): Promise<void> {
  const user = await requirePermission("editLead");
  await mergeLead(sourceId, targetId, user.id);
  revalidatePath("/leads");
  revalidatePath(`/leads/${sourceId}`);
  revalidatePath(`/leads/${targetId}`);
}

export async function syncLeadAction(leadId: string): Promise<{ ok: boolean; message: string }> {
  const user = await requirePermission("syncHub");
  const r = await syncLeadToHub(leadId, user.id);
  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/leads");
  if (r.ok) return { ok: true, message: "An den Hub übergeben." };
  return { ok: false, message: r.configured ? `Übergabe fehlgeschlagen: ${r.error}` : "Hub-Schnittstelle ist noch nicht konfiguriert. Lead bleibt vorgemerkt." };
}

export async function syncAllPendingAction(): Promise<{ ok: boolean; message: string }> {
  const user = await requirePermission("syncHub");
  const r = await syncPendingLeads(user.id);
  revalidatePath("/leads");
  if (r.skipped) return { ok: false, message: "Hub-Schnittstelle ist noch nicht konfiguriert." };
  return { ok: r.failed === 0, message: `${r.synced} übergeben, ${r.failed} fehlgeschlagen.` };
}
