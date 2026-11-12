"use client";

import type { LeadInput } from "./leads";

/**
 * Offline-Puffer für die Lead-Erfassung (Konzept §7.4).
 * Leads, die ohne Netz gespeichert werden, landen in IndexedDB und werden
 * automatisch an POST /api/leads nachgesendet (idempotent über clientId).
 */

const DB_NAME = "baax-stay";
const STORE = "pendingLeads";
export const PENDING_EVENT = "stay:pending-changed";

export type PendingLead = {
  clientId: string;
  payload: LeadInput;
  createdAt: number;
  attempts: number;
  lastError?: string;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") return reject(new Error("IndexedDB nicht verfügbar"));
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE, { keyPath: "clientId" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const req = fn(t.objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
        t.oncomplete = () => db.close();
      }),
  );
}

function notify() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(PENDING_EVENT));
}

export function newClientId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function addPending(item: PendingLead): Promise<void> {
  await tx("readwrite", (s) => s.put(item));
  notify();
}

export async function listPending(): Promise<PendingLead[]> {
  try {
    const all = await tx<PendingLead[]>("readonly", (s) => s.getAll());
    return all.sort((a, b) => a.createdAt - b.createdAt);
  } catch {
    return [];
  }
}

export async function countPending(): Promise<number> {
  try {
    return await tx<number>("readonly", (s) => s.count());
  } catch {
    return 0;
  }
}

export async function removePending(clientId: string): Promise<void> {
  await tx("readwrite", (s) => s.delete(clientId));
  notify();
}

export async function markAttempt(clientId: string, error: string): Promise<void> {
  const item = await tx<PendingLead | undefined>("readonly", (s) => s.get(clientId));
  if (!item) return;
  await tx("readwrite", (s) => s.put({ ...item, attempts: item.attempts + 1, lastError: error }));
  notify();
}

export type SubmitOutcome =
  | { kind: "saved"; id: string; alreadyExisted: boolean; duplicates: Array<{ id: string; name: string }> }
  | { kind: "invalid"; errors: Record<string, string> }
  | { kind: "unauthorized" }
  | { kind: "network"; error: string };

/** Sendet einen Lead an die API. Netzfehler werden vom Validierungsfehler unterschieden. */
export async function submitLead(payload: LeadInput, timeoutMs = 8000): Promise<SubmitOutcome> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch("/api/leads", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
      credentials: "same-origin",
    });
    if (res.status === 401 || res.status === 403) return { kind: "unauthorized" };
    if (res.status === 422) {
      const data = (await res.json()) as { errors?: Record<string, string> };
      return { kind: "invalid", errors: data.errors ?? { form: "Eingabe ungültig" } };
    }
    if (!res.ok) return { kind: "network", error: `Server antwortete ${res.status}` };
    const data = (await res.json()) as { id: string; alreadyExisted: boolean; duplicates: Array<{ id: string; name: string }> };
    return { kind: "saved", id: data.id, alreadyExisted: data.alreadyExisted, duplicates: data.duplicates ?? [] };
  } catch (e) {
    return { kind: "network", error: e instanceof Error ? e.message : "Netzfehler" };
  } finally {
    clearTimeout(timer);
  }
}

let syncing = false;

/** Alle wartenden Leads nachsenden. Gibt die Anzahl erfolgreich übertragener zurück. */
export async function flushPending(): Promise<{ sent: number; remaining: number }> {
  if (syncing) return { sent: 0, remaining: await countPending() };
  syncing = true;
  let sent = 0;
  try {
    if (typeof navigator !== "undefined" && navigator.onLine === false) return { sent: 0, remaining: await countPending() };
    for (const item of await listPending()) {
      const outcome = await submitLead(item.payload);
      if (outcome.kind === "saved") {
        await removePending(item.clientId);
        sent++;
      } else if (outcome.kind === "invalid") {
        // Ungültige Daten bleiben liegen und werden in der Liste mit Fehler angezeigt.
        await markAttempt(item.clientId, Object.values(outcome.errors).join(", "));
      } else if (outcome.kind === "unauthorized") {
        await markAttempt(item.clientId, "Bitte neu anmelden");
        break;
      } else {
        await markAttempt(item.clientId, outcome.error);
        break; // Netz weiter weg, später erneut
      }
    }
  } finally {
    syncing = false;
  }
  return { sent, remaining: await countPending() };
}
