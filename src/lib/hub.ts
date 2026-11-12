import "server-only";
import type { Lead } from "@prisma/client";
import { prisma } from "./db";
import { env } from "./env";
import { audit } from "./audit";
import { LEAD_ROLE_LABEL, LEAD_SOURCE_LABEL } from "./labels";

/**
 * Hub-API-Client (Kontakt anlegen + Aufgabe „Nachfassen“).
 *
 * Die konkreten Endpunkte des Hubs sind ein offener Punkt im Konzept (§14).
 * Annahme bis zur Klärung:
 *   POST {HUB_API_URL}/contacts   → { id }
 *   POST {HUB_API_URL}/tasks      → { id }
 * Authentifizierung: Authorization: Bearer {HUB_API_TOKEN}
 * Solange die API nicht konfiguriert ist, bleibt der Lead auf PENDING und kann
 * später per Button („Übergabe nachholen“) oder gesammelt übertragen werden.
 */

export class HubNotConfiguredError extends Error {
  constructor() {
    super("Hub-API ist nicht konfiguriert (HUB_API_URL / HUB_API_TOKEN)");
    this.name = "HubNotConfiguredError";
  }
}

async function hubFetch<T>(path: string, body: unknown): Promise<T> {
  if (!env.hub.apiConfigured) throw new HubNotConfiguredError();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const res = await fetch(`${env.hub.apiUrl}${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${env.hub.apiToken}`,
        "x-client": "baax-stay",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Hub antwortete ${res.status}: ${text.slice(0, 300)}`);
    }
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

export function leadToHubContact(lead: Lead) {
  return {
    externalId: lead.id,
    externalSystem: "baax-stay",
    name: lead.name,
    company: lead.company,
    email: lead.email,
    phone: lead.phone,
    type: lead.role,
    typeLabel: LEAD_ROLE_LABEL[lead.role],
    source: lead.source,
    sourceLabel: LEAD_SOURCE_LABEL[lead.source],
    sourceDetail: lead.sourceDetail,
    consentEmail: lead.consentEmail,
    consentAt: lead.consentAt,
    tags: ["Baax Stay", lead.source, ...(lead.segment ? [lead.segment] : [])],
    note: [lead.interest, lead.note].filter(Boolean).join("\n\n") || null,
  };
}

export function leadToHubTask(lead: Lead, hubContactId: string) {
  const due = new Date(lead.createdAt);
  due.setDate(due.getDate() + 2);
  return {
    contactId: hubContactId,
    title: `Nachfassen: ${lead.name}${lead.company ? ` (${lead.company})` : ""}`,
    description: `Kontakt aus Baax Stay, Quelle ${LEAD_SOURCE_LABEL[lead.source]}${lead.sourceDetail ? ` – ${lead.sourceDetail}` : ""}.${
      lead.interest ? `\nInteresse: ${lead.interest}` : ""
    }`,
    dueAt: due.toISOString(),
    assigneeId: lead.createdById !== "public" ? lead.createdById : null,
    externalRef: `baax-stay:lead:${lead.id}`,
  };
}

/** Allgemeine Aufgabe im Hub anlegen (Nachfassen, Kaufabwicklung, Nachgespräch, Besichtigungsanfrage). */
export async function createHubTask(task: { contactId?: string | null; title: string; description?: string | null; dueAt: string; assigneeId?: string | null; externalRef: string }): Promise<{ ok: boolean; id?: string; error?: string; configured: boolean }> {
  try {
    const r = await hubFetch<{ id: string }>("/tasks", task);
    return { ok: true, id: r.id, configured: true };
  } catch (e) {
    const configured = !(e instanceof HubNotConfiguredError);
    return { ok: false, error: e instanceof Error ? e.message : String(e), configured };
  }
}

export type SyncResult = { ok: true; hubContactId: string } | { ok: false; error: string; configured: boolean };

/** Einen Lead an den Hub übergeben. Setzt hubSync und hubContactId. */
export async function syncLeadToHub(leadId: string, userId: string | null): Promise<SyncResult> {
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) return { ok: false, error: "Lead nicht gefunden", configured: env.hub.apiConfigured };
  if (lead.hubSync === "SYNCED" && lead.hubContactId) return { ok: true, hubContactId: lead.hubContactId };

  try {
    let hubContactId = lead.hubContactId;
    if (!hubContactId) {
      const contact = await hubFetch<{ id: string }>("/contacts", leadToHubContact(lead));
      hubContactId = contact.id;
      await prisma.lead.update({ where: { id: lead.id }, data: { hubContactId } });
    }
    await hubFetch<{ id: string }>("/tasks", leadToHubTask(lead, hubContactId));
    await prisma.lead.update({
      where: { id: lead.id },
      data: { hubSync: "SYNCED", hubSyncError: null, hubSyncedAt: new Date() },
    });
    await audit({ userId, action: "HUB_SYNC", entity: "Lead", entityId: lead.id, meta: { ok: true, hubContactId } });
    return { ok: true, hubContactId };
  } catch (e) {
    const notConfigured = e instanceof HubNotConfiguredError;
    const error = e instanceof Error ? e.message : String(e);
    // Ohne Konfiguration bleibt der Lead bewusst PENDING (Konzept §7.7), sonst FAILED.
    await prisma.lead.update({
      where: { id: lead.id },
      data: { hubSync: notConfigured ? "PENDING" : "FAILED", hubSyncError: notConfigured ? null : error },
    });
    if (!notConfigured) {
      await audit({ userId, action: "HUB_SYNC", entity: "Lead", entityId: lead.id, meta: { ok: false, error } });
    }
    return { ok: false, error, configured: !notConfigured };
  }
}

/** Alle ausstehenden/fehlgeschlagenen Leads nachsenden (Button in der Liste, später Cron). */
export async function syncPendingLeads(userId: string | null, limit = 50): Promise<{ synced: number; failed: number; skipped: boolean }> {
  if (!env.hub.apiConfigured) return { synced: 0, failed: 0, skipped: true };
  const pending = await prisma.lead.findMany({
    where: { hubSync: { in: ["PENDING", "FAILED"] } },
    orderBy: { createdAt: "asc" },
    take: limit,
    select: { id: true },
  });
  let synced = 0;
  let failed = 0;
  for (const { id } of pending) {
    const r = await syncLeadToHub(id, userId);
    if (r.ok) synced++;
    else failed++;
  }
  return { synced, failed, skipped: false };
}
