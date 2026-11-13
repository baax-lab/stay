import "server-only";
import { prisma } from "./db";
import { env } from "./env";
import { audit } from "./audit";
import { LEAD_SOURCE_LABEL, SEGMENT_LABEL } from "./labels";
import { dueInDays, leadToHubContactInput } from "./oidc";

/**
 * Client für die REST-API des Baax Hub (docs/API.md im Hub-Repository).
 *
 *   POST {HUB_URL}/api/v1/contacts  → { data: { hubId, … }, existing? }   (Dublette: 200 mit vorhandenem Kontakt)
 *   POST {HUB_URL}/api/v1/events    → Eintrag in der Timeline, optional mit Aufgabe für den Betreuer
 *
 * Der Hub hat keine eigenen Endpunkte für Aufgaben oder Termine: Aufgaben entstehen über `task` am Ereignis,
 * Termine (z. B. Reisen) erscheinen als Ereignis vom Typ „meeting“ in der Timeline.
 * Ohne HUB_API_TOKEN bleibt jeder Lead auf PENDING und kann später nachgereicht werden.
 */

export class HubNotConfiguredError extends Error {
  constructor() {
    super("Hub-API ist nicht eingerichtet (HUB_URL / HUB_API_TOKEN)");
    this.name = "HubNotConfiguredError";
  }
}

async function hubFetch<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<{ status: number; json: T }> {
  if (!env.hub.apiConfigured) throw new HubNotConfiguredError();
  const res = await fetch(`${env.hub.apiUrl}${path}`, {
    method,
    headers: { authorization: `Bearer ${env.hub.apiToken}`, ...(body ? { "content-type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(10_000),
  });
  const json = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(`Hub antwortete ${res.status}${json?.error ? `: ${String(json.error).slice(0, 200)}` : ""}`);
  return { status: res.status, json };
}

/** Fehlertext mit Ursache („fetch failed“ allein hilft niemandem). */
export function errText(e: unknown): string {
  if (!(e instanceof Error)) return String(e);
  const cause = (e as Error & { cause?: { code?: string; message?: string; errors?: { code?: string; message?: string }[] } }).cause;
  const detail = cause?.code || cause?.errors?.[0]?.code || cause?.message || cause?.errors?.[0]?.message;
  return detail && !e.message.includes(detail) ? `${e.message} (${detail})` : e.message;
}

type HubEvent = {
  contact: { hubId: string };
  type: "note" | "call" | "meeting" | "email" | "document" | "deal" | "webhook";
  title: string;
  body?: string | null;
  url?: string | null;
  occurredAt?: string;
  task?: { title: string; dueInDays: number };
};

async function postEvent(e: HubEvent): Promise<{ taskId?: string | null }> {
  const r = await hubFetch<{ data?: { taskId?: string | null } }>("POST", "/events", {
    ...e,
    title: e.title.slice(0, 200),
    ...(e.task ? { task: { ...e.task, title: e.task.title.slice(0, 200) } } : {}),
  });
  return { taskId: r.json.data?.taskId ?? null };
}

type HubResult = { ok: boolean; id?: string; error?: string; configured: boolean };

/**
 * Aufgabe im Hub (Nachfassen, Kaufabwicklung, Nachgespräch, Besichtigungsanfrage) als Ereignis mit Aufgabe.
 * Ohne Hub-Kontakt nicht möglich; das zählt nicht als Fehler (configured: false).
 */
export async function createHubTask(task: { contactId?: string | null; title: string; description?: string | null; dueAt: string; assigneeId?: string | null; externalRef: string }): Promise<HubResult> {
  if (!env.hub.apiConfigured) return { ok: false, error: new HubNotConfiguredError().message, configured: false };
  if (!task.contactId) return { ok: false, error: "Kein Hub-Kontakt verknüpft", configured: false };
  try {
    const r = await postEvent({
      contact: { hubId: task.contactId },
      type: "note",
      title: task.title,
      body: task.description ?? null,
      task: { title: task.title, dueInDays: dueInDays(task.dueAt) },
    });
    return { ok: true, id: r.taskId ?? undefined, configured: true };
  } catch (e) {
    return { ok: false, error: errText(e), configured: true };
  }
}

/** Termin (z. B. Reise) als Ereignis „meeting“ in der Timeline des Kontakts; einen Kalender-Endpunkt hat der Hub nicht. */
export async function createHubAppointment(a: { contactId?: string | null; title: string; start: string; end?: string | null; location?: string | null; description?: string | null; ownerId?: string | null; externalRef: string }): Promise<HubResult> {
  if (!env.hub.apiConfigured) return { ok: false, error: new HubNotConfiguredError().message, configured: false };
  if (!a.contactId) return { ok: false, error: "Kein Hub-Kontakt verknüpft", configured: false };
  const fmt = (iso: string) => new Date(iso).toLocaleString("de-DE", { timeZone: "Europe/Berlin", dateStyle: "medium", timeStyle: "short" });
  const body = [`Termin: ${fmt(a.start)}${a.end ? ` bis ${fmt(a.end)}` : ""}`, a.location && `Ort: ${a.location}`, a.description].filter(Boolean).join("\n");
  try {
    await postEvent({ contact: { hubId: a.contactId }, type: "meeting", title: a.title, body, occurredAt: a.start });
    return { ok: true, configured: true };
  } catch (e) {
    return { ok: false, error: errText(e), configured: true };
  }
}

export type SyncResult = { ok: true; hubContactId: string } | { ok: false; error: string; configured: boolean };

/** Lead an den Hub übergeben: Kontakt anlegen (Dublette liefert den vorhandenen) und Aufgabe „Nachfassen“. */
export async function syncLeadToHub(leadId: string, userId: string | null): Promise<SyncResult> {
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) return { ok: false, error: "Lead nicht gefunden", configured: env.hub.apiConfigured };
  if (lead.hubSync === "SYNCED" && lead.hubContactId) return { ok: true, hubContactId: lead.hubContactId };

  try {
    let hubContactId = lead.hubContactId;
    let existing = false;
    if (!hubContactId) {
      const r = await hubFetch<{ data?: { hubId?: string }; existing?: boolean }>(
        "POST",
        "/contacts",
        leadToHubContactInput({
          name: lead.name,
          company: lead.company,
          email: lead.email,
          phone: lead.phone,
          role: lead.role,
          sourceLabel: LEAD_SOURCE_LABEL[lead.source],
          sourceDetail: lead.sourceDetail,
          segmentLabel: lead.segment ? SEGMENT_LABEL[lead.segment] : null,
          interest: lead.interest,
          note: lead.note,
        }),
      );
      if (!r.json.data?.hubId) throw new Error("Hub lieferte keine Kontakt-ID");
      hubContactId = r.json.data.hubId;
      existing = r.json.existing === true;
      await prisma.lead.update({ where: { id: lead.id }, data: { hubContactId } });
    }
    await postEvent({
      contact: { hubId: hubContactId },
      type: "note",
      title: existing ? "Erneuter Kontakt über Baax Stay" : "Neuer Kontakt über Baax Stay",
      body: [`Quelle: ${LEAD_SOURCE_LABEL[lead.source]}${lead.sourceDetail ? ` – ${lead.sourceDetail}` : ""}`, lead.interest && `Interesse: ${lead.interest}`].filter(Boolean).join("\n"),
      url: `${env.appUrl}/leads/${lead.id}`,
      occurredAt: lead.createdAt.toISOString(),
      task: { title: `Nachfassen: ${lead.name}`, dueInDays: 2 },
    });
    await prisma.lead.update({ where: { id: lead.id }, data: { hubSync: "SYNCED", hubSyncError: null, hubSyncedAt: new Date() } });
    await audit({ userId, action: "HUB_SYNC", entity: "Lead", entityId: lead.id, meta: { ok: true, hubContactId, existing } });
    return { ok: true, hubContactId };
  } catch (e) {
    const notConfigured = e instanceof HubNotConfiguredError;
    const error = errText(e);
    // Ohne Konfiguration bleibt der Lead bewusst PENDING (Konzept §7.7), sonst FAILED.
    await prisma.lead.update({ where: { id: lead.id }, data: { hubSync: notConfigured ? "PENDING" : "FAILED", hubSyncError: notConfigured ? null : error } });
    if (!notConfigured) await audit({ userId, action: "HUB_SYNC", entity: "Lead", entityId: lead.id, meta: { ok: false, error } });
    return { ok: false, error, configured: !notConfigured };
  }
}

/** Alle ausstehenden/fehlgeschlagenen Leads nachsenden (Button in der Liste). */
export async function syncPendingLeads(userId: string | null, limit = 50): Promise<{ synced: number; failed: number; skipped: boolean }> {
  if (!env.hub.apiConfigured) return { synced: 0, failed: 0, skipped: true };
  const pending = await prisma.lead.findMany({ where: { hubSync: { in: ["PENDING", "FAILED"] } }, orderBy: { createdAt: "asc" }, take: limit, select: { id: true } });
  let synced = 0;
  let failed = 0;
  for (const { id } of pending) {
    const r = await syncLeadToHub(id, userId);
    if (r.ok) synced++;
    else failed++;
  }
  return { synced, failed, skipped: false };
}

/** Verbindungstest für die Einstellungen: Anmeldung (Discovery) und API (Kontakte lesen). Legt nichts an. */
export async function testHubConnection(): Promise<{ ok: boolean; message: string; ms?: number }> {
  if (!env.hub.url) return { ok: false, message: "HUB_URL fehlt." };
  const started = Date.now();
  const parts: string[] = [];
  let ok = true;
  try {
    const res = await fetch(`${env.hub.url}/.well-known/openid-configuration`, { signal: AbortSignal.timeout(10_000) });
    const doc = (await res.json().catch(() => ({}))) as { issuer?: string };
    if (res.ok && doc.issuer) {
      parts.push(env.hub.ssoConfigured ? `Anmeldung bereit (Issuer ${doc.issuer})` : "Hub erreichbar, HUB_CLIENT_ID oder HUB_CLIENT_SECRET fehlt");
    } else {
      ok = false;
      parts.push(`Anmeldedienst antwortete ${res.status}`);
    }
    if (!env.hub.ssoConfigured) ok = false;
  } catch (e) {
    return { ok: false, message: `Hub nicht erreichbar: ${errText(e)}` };
  }
  if (!env.hub.apiToken) {
    parts.push("API: HUB_API_TOKEN fehlt, Leads bleiben „ausstehend“");
    ok = false;
  } else {
    try {
      await hubFetch("GET", "/contacts?limit=1");
      parts.push("API: Zugriff ok");
    } catch (e) {
      ok = false;
      parts.push(`API: ${errText(e)}`);
    }
  }
  return { ok, message: parts.join(" · "), ms: Date.now() - started };
}
