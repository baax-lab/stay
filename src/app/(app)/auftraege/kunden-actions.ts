"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { extendExpiry } from "@/lib/portal";
import { previousMonth, type MarketReportContent, type SearchReportContent } from "@/lib/reports";
import { storeFile } from "@/lib/services/files";
import { createPortalAccess, sendPortalLink } from "@/lib/services/portal";
import { discardNotification, sendNotification } from "@/lib/services/notifications";
import { approveReport, createMarketReportDraft, createSearchReportDraft, refreshReport } from "@/lib/services/reports";
import type { ActionResult } from "@/components/ui/action-form";

/** Käuferportal, Benachrichtigungen und Berichte im Suchauftrag (Phase 1b). */

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const rev = (id: string) => revalidatePath(`/auftraege/${id}`);

export async function createPortalLinkAction(mandateId: string): Promise<{ ok: boolean; message: string; url?: string }> {
  const user = await requirePermission("sendExternal");
  const { url, access } = await createPortalAccess(mandateId, user);
  rev(mandateId);
  return { ok: true, message: `Link erstellt, gültig bis ${access.expiresAt.toLocaleDateString("de-DE")}. Er wird nur jetzt angezeigt.`, url };
}

export async function sendPortalLinkAction(mandateId: string): Promise<{ ok: boolean; message: string; url?: string }> {
  const user = await requirePermission("sendExternal");
  const r = await sendPortalLink(mandateId, user);
  rev(mandateId);
  return r;
}

export async function extendAccessAction(mandateId: string, accessId: string): Promise<ActionResult> {
  const user = await requirePermission("sendExternal");
  const a = await prisma.portalAccess.update({ where: { id: accessId }, data: { expiresAt: extendExpiry(), revokedAt: null } });
  await audit({ userId: user.id, action: "PORTAL_LINK", entity: "Mandate", entityId: mandateId, meta: { extended: accessId, expiresAt: a.expiresAt.toISOString() } });
  rev(mandateId);
  return { ok: true, message: `Verlängert bis ${a.expiresAt.toLocaleDateString("de-DE")}.` };
}

export async function revokeAccessAction(mandateId: string, accessId: string): Promise<ActionResult> {
  const user = await requirePermission("sendExternal");
  await prisma.portalAccess.update({ where: { id: accessId }, data: { revokedAt: new Date() } });
  await audit({ userId: user.id, action: "PORTAL_LINK", entity: "Mandate", entityId: mandateId, meta: { revoked: accessId } });
  rev(mandateId);
  return { ok: true, message: "Link widerrufen." };
}

export async function savePortalSettingsAction(mandateId: string, formData: FormData): Promise<ActionResult> {
  const user = await requirePermission("editMandates");
  const data: { buyerLang: string; ownerName: string | null; ownerPhone: string | null; ownerEmail: string | null; portalNextSteps: string | null; ownerPhotoFileId?: string } = {
    buyerLang: str(formData, "buyerLang") === "en" ? "en" : "de",
    ownerName: str(formData, "ownerName") || null,
    ownerPhone: str(formData, "ownerPhone") || null,
    ownerEmail: str(formData, "ownerEmail").toLowerCase() || null,
    portalNextSteps: str(formData, "portalNextSteps") || null,
  };
  const photo = formData.get("photo");
  if (photo instanceof File && photo.size > 0) {
    if (!photo.type.startsWith("image/")) return { ok: false, error: "Bitte ein Bild hochladen" };
    try {
      const stored = await storeFile(photo, { entity: "Mandate", entityId: mandateId, kind: "OWNER_PHOTO", userId: user.id });
      data.ownerPhotoFileId = stored.id;
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "Upload fehlgeschlagen" };
    }
  }
  await prisma.mandate.update({ where: { id: mandateId }, data });
  await audit({ userId: user.id, action: "MANDATE_UPDATE", entity: "Mandate", entityId: mandateId, meta: { field: "portal" } });
  rev(mandateId);
  return { ok: true, message: "Portal-Einstellungen gespeichert." };
}

export async function sendNotificationAction(mandateId: string, notificationId: string, formData: FormData): Promise<ActionResult> {
  const user = await requirePermission("sendExternal");
  const r = await sendNotification(notificationId, user, { subject: str(formData, "subject"), body: str(formData, "body") });
  rev(mandateId);
  return r.ok ? { ok: true, message: r.message } : { ok: false, error: r.message };
}

export async function discardNotificationAction(mandateId: string, notificationId: string): Promise<ActionResult> {
  const user = await requirePermission("editMandates");
  await discardNotification(notificationId, user);
  rev(mandateId);
  return { ok: true, message: "Verworfen." };
}

export async function createSearchReportAction(mandateId: string, formData: FormData): Promise<void> {
  const user = await requirePermission("editMandates");
  const mode = str(formData, "period");
  const now = new Date();
  const { start, end } = mode === "current" ? { start: new Date(now.getFullYear(), now.getMonth(), 1), end: now } : previousMonth(now);
  const r = await createSearchReportDraft(mandateId, start, end, user);
  redirect(`/auftraege/${mandateId}/berichte/${r.id}`);
}

export async function createMarketReportAction(mandateId: string): Promise<void> {
  const user = await requirePermission("editMandates");
  const r = await createMarketReportDraft(mandateId, user);
  redirect(`/auftraege/${mandateId}/berichte/${r.id}`);
}

export async function saveReportAction(mandateId: string, reportId: string, formData: FormData): Promise<ActionResult> {
  const user = await requirePermission("editMandates");
  const r = await prisma.report.findUniqueOrThrow({ where: { id: reportId } });
  if (r.status !== "ENTWURF") return { ok: false, error: "Freigegebene Berichte sind nicht mehr änderbar." };
  let content: SearchReportContent | MarketReportContent;
  if (r.kind === "SUCHBERICHT") {
    content = { ...(r.content as SearchReportContent), marketNote: str(formData, "marketNote"), nextSteps: str(formData, "nextSteps") };
  } else {
    const c = r.content as MarketReportContent;
    content = {
      intro: str(formData, "intro"),
      conclusion: str(formData, "conclusion"),
      regions: c.regions.map((reg) => ({ ...reg, priceLevel: str(formData, `priceLevel:${reg.key}`), occupancy: str(formData, `occupancy:${reg.key}`), risks: str(formData, `risks:${reg.key}`) })),
    };
  }
  await prisma.report.update({ where: { id: reportId }, data: { content, title: str(formData, "title") || r.title } });
  await audit({ userId: user.id, action: "REPORT_UPDATE", entity: "Report", entityId: reportId });
  revalidatePath(`/auftraege/${mandateId}/berichte/${reportId}`);
  return { ok: true, message: "Entwurf gespeichert." };
}

export async function refreshReportAction(mandateId: string, reportId: string): Promise<ActionResult> {
  await requirePermission("editMandates");
  await refreshReport(reportId);
  revalidatePath(`/auftraege/${mandateId}/berichte/${reportId}`);
  return { ok: true, message: "Zahlen und Listen neu berechnet, Freitexte behalten." };
}

export async function approveReportAction(mandateId: string, reportId: string, formData: FormData): Promise<ActionResult> {
  const user = await requirePermission("editMandates");
  const { notificationId } = await approveReport(reportId, user);
  let msg = "Freigegeben und im Portal sichtbar.";
  if (formData.get("notify") === "on") {
    const r = await sendNotification(notificationId, user);
    msg += r.ok ? ` Käufer informiert: ${r.message}` : ` Mail-Entwurf liegt unter Käuferportal bereit (${r.message}).`;
  } else msg += " Mail-Entwurf liegt unter „Käuferportal“ bereit.";
  rev(mandateId);
  redirect(`/auftraege/${mandateId}/berichte/${reportId}?ok=${encodeURIComponent(msg)}`);
}

export async function deleteReportAction(mandateId: string, reportId: string): Promise<void> {
  await requirePermission("editMandates");
  await prisma.report.deleteMany({ where: { id: reportId, status: "ENTWURF" } });
  redirect(`/auftraege/${mandateId}?tab=berichte`);
}
