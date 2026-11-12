"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { asLang } from "@/lib/i18n";
import { renderTemplatePdf } from "@/lib/services/pdf-render";
import { storeFile } from "@/lib/services/files";
import { logEvent } from "@/lib/services/events";
import type { ActionResult } from "@/components/ui/action-form";

/** Suchauftrag aus Vorlage als PDF im Suchauftrag ablegen (unsigniert; Unterschrift später über Baax Sign). */
export async function saveMandateDocumentFromTemplateAction(mandateId: string, lang: string): Promise<ActionResult> {
  const user = await requirePermission("editMandates");
  const l = asLang(lang);
  const pdf = await renderTemplatePdf("SUCHAUFTRAG", mandateId, l);
  if (!pdf) return { ok: false, error: "PDF konnte nicht erzeugt werden" };
  const file = new File([new Uint8Array(pdf)], `Suchauftrag-${l}-${new Date().toISOString().slice(0, 10)}.pdf`, { type: "application/pdf" });
  const stored = await storeFile(file, { entity: "Mandate", entityId: mandateId, kind: "SUCHAUFTRAG", userId: user.id });
  await prisma.mandateDocument.create({ data: { mandateId, kind: "SUCHAUFTRAG", fileId: stored.id, label: `Aus Vorlage (${l.toUpperCase()}, unsigniert)`, uploadedById: user.id } });
  await logEvent(mandateId, "TEMPLATE", { kind: "SUCHAUFTRAG", lang: l, fileId: stored.id }, user);
  await audit({ userId: user.id, action: "TEMPLATE_RENDER", entity: "Mandate", entityId: mandateId, meta: { saved: stored.id, lang: l } });
  revalidatePath(`/auftraege/${mandateId}`);
  return { ok: true, message: "Als Dokument abgelegt (unsigniert)." };
}

export async function saveTemplateAction(id: string, formData: FormData): Promise<ActionResult> {
  const user = await requirePermission("editFeeBands");
  const body = String(formData.get("body") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!body.trim() || !name) return { ok: false, error: "Name und Text sind Pflicht" };
  const t = await prisma.documentTemplate.update({ where: { id }, data: { body, name, active: formData.get("active") === "on", version: { increment: 1 }, updatedById: user.id } });
  await audit({ userId: user.id, action: "TEMPLATE_UPDATE", entity: "DocumentTemplate", entityId: id, meta: { kind: t.kind, lang: t.lang, version: t.version } });
  revalidatePath("/einstellungen/vorlagen");
  return { ok: true, message: `Gespeichert (Version ${t.version}).` };
}

export async function createTemplateLangAction(kind: string, lang: string): Promise<ActionResult> {
  const user = await requirePermission("editFeeBands");
  const base = await prisma.documentTemplate.findUnique({ where: { kind_lang: { kind, lang: "de" } } });
  if (!base) return { ok: false, error: "Keine deutsche Vorlage als Ausgang" };
  await prisma.documentTemplate.create({ data: { kind, lang, name: `${base.name} (${lang.toUpperCase()})`, body: base.body, updatedById: user.id } });
  revalidatePath("/einstellungen/vorlagen");
  return { ok: true, message: "Sprachfassung angelegt (Text zunächst Deutsch)." };
}
