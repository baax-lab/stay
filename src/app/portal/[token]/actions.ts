"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { rateLimit } from "@/lib/rate-limit";
import { sendMail } from "@/lib/mail";
import { createHubTask } from "@/lib/hub";
import { env } from "@/lib/env";
import { isBuyerRejectReason, hashPortalToken } from "@/lib/portal";
import { t } from "@/lib/i18n";
import { isReleased, lookupPortal, requestNewLink } from "@/lib/services/portal";
import { logEvent } from "@/lib/services/events";

/** Aktionen im Käuferportal (Konzept §9.1): merken, ablehnen mit Pflichtgrund, Besichtigung anfragen. */

export type PortalActionResult = { ok: boolean; error?: string };

async function ip() {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || undefined;
}

async function guard(token: string, propertyId: string) {
  const r = await lookupPortal(token);
  if (r.state !== "valid") return null;
  if (!rateLimit(`portal:${hashPortalToken(token)}`, 30, 10 * 60 * 1000).ok) return null;
  if (!(await isReleased(r.mandate.id, propertyId))) return null;
  const match = await prisma.match.findUnique({ where: { mandateId_propertyId: { mandateId: r.mandate.id, propertyId } }, include: { property: { select: { title: true } } } });
  if (!match || match.status === "GESCHLOSSEN") return null;
  return { mandate: r.mandate, access: r.access, match };
}

const buyer = (name: string) => ({ id: "portal", name: `Käufer (${name})` });

export async function buyerRememberAction(token: string, propertyId: string): Promise<PortalActionResult> {
  const g = await guard(token, propertyId);
  if (!g) return { ok: false, error: "denied" };
  await prisma.match.update({ where: { id: g.match.id }, data: { buyerAction: "GEMERKT", buyerActionAt: new Date() } });
  await logEvent(g.mandate.id, "BUYER_FEEDBACK", { propertyId, propertyTitle: g.match.property.title, action: "GEMERKT" }, buyer(g.mandate.buyerName));
  await audit({ action: "PORTAL_ACTION", entity: "Mandate", entityId: g.mandate.id, meta: { action: "GEMERKT", propertyId, accessId: g.access.id }, ip: await ip() });
  revalidatePath(`/portal/${token}`);
  return { ok: true };
}

export async function buyerRejectAction(token: string, propertyId: string, formData: FormData): Promise<PortalActionResult> {
  const category = String(formData.get("category") ?? "");
  const text = String(formData.get("text") ?? "").trim().slice(0, 1000) || null;
  if (!isBuyerRejectReason(category)) return { ok: false, error: "reason" };
  const g = await guard(token, propertyId);
  if (!g) return { ok: false, error: "denied" };
  const label = t("de", `reject_reasons.${category}`);
  await prisma.match.update({
    where: { id: g.match.id },
    data: { buyerAction: "ABGELEHNT", buyerReasonCategory: category, buyerReasonText: text, buyerActionAt: new Date(), status: "ABGELEHNT", rejectReason: `Käufer: ${label}${text ? `: ${text}` : ""}` },
  });
  await logEvent(g.mandate.id, "BUYER_FEEDBACK", { propertyId, propertyTitle: g.match.property.title, action: "ABGELEHNT", category, text }, buyer(g.mandate.buyerName));
  await audit({ action: "PORTAL_ACTION", entity: "Mandate", entityId: g.mandate.id, meta: { action: "ABGELEHNT", propertyId, category, accessId: g.access.id }, ip: await ip() });
  revalidatePath(`/portal/${token}`);
  return { ok: true };
}

export async function buyerViewingAction(token: string, propertyId: string, formData: FormData): Promise<PortalActionResult> {
  const note = String(formData.get("note") ?? "").trim().slice(0, 1000) || null;
  const g = await guard(token, propertyId);
  if (!g) return { ok: false, error: "denied" };
  await prisma.match.update({ where: { id: g.match.id }, data: { buyerAction: "BESICHTIGUNG", buyerReasonText: note, buyerActionAt: new Date() } });
  await logEvent(g.mandate.id, "BUYER_FEEDBACK", { propertyId, propertyTitle: g.match.property.title, action: "BESICHTIGUNG", text: note }, buyer(g.mandate.buyerName));
  await audit({ action: "PORTAL_ACTION", entity: "Mandate", entityId: g.mandate.id, meta: { action: "BESICHTIGUNG", propertyId, accessId: g.access.id }, ip: await ip() });

  // Besichtigung anfragen → Aufgabe im Hub, Info an Verantwortliche
  await createHubTask({
    contactId: g.mandate.hubContactId,
    title: `Besichtigung anfragen: ${g.match.property.title}`,
    description: `Käufer ${g.mandate.buyerName} wünscht eine Besichtigung (Suchauftrag ${g.mandate.title}).${note ? `\nHinweis: ${note}` : ""}`,
    dueAt: new Date(Date.now() + 86400000).toISOString(),
    assigneeId: g.mandate.ownerId,
    externalRef: `baax-stay:viewing:${g.match.id}`,
  });
  if (g.mandate.ownerEmail) {
    await sendMail({
      to: g.mandate.ownerEmail,
      subject: `Besichtigungsanfrage: ${g.match.property.title}`,
      text: `${g.mandate.buyerName} hat im Portal eine Besichtigung angefragt.\n\nObjekt: ${g.match.property.title}\nHinweis: ${note ?? "–"}\n\n${env.appUrl}/auftraege/${g.mandate.id}?tab=treffer`,
      purpose: "viewing-request",
      entity: "Mandate",
      entityId: g.mandate.id,
    });
  }
  revalidatePath(`/portal/${token}`);
  return { ok: true };
}

export async function requestNewLinkAction(token: string): Promise<PortalActionResult> {
  const addr = await ip();
  if (!rateLimit(`relink:${addr ?? "x"}`, 3, 60 * 60 * 1000).ok) return { ok: true };
  await requestNewLink(token, addr);
  return { ok: true };
}
