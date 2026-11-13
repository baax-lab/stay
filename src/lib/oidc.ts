import type { LeadRole, Role } from "@prisma/client";
import { mapHubRole } from "./permissions";

/**
 * Reine Bausteine für die Anmeldung über den Baax Hub (OpenID Connect, Third-Party Initiated Login)
 * und für die Hub-API. Ablauf und Vorgaben: docs/SSO.md und docs/APP-ANBINDUNG.md im Hub-Repository.
 */

const trim = (url?: string | null) => (url ?? "").trim().replace(/\/+$/, "");

/** `iss` am Anmelde-Einstieg muss genau der Hub sein (Schrägstrich am Ende egal). */
export function issuerMatches(iss: string | null | undefined, hubUrl: string): boolean {
  return !!trim(iss) && trim(iss) === trim(hubUrl);
}

/** Zielseite nur innerhalb der eigenen App (gleiche Herkunft), sonst Startseite. Liefert Pfad + Query. */
export function safeTarget(target: string | null | undefined, appUrl: string): string {
  if (!target) return "/";
  try {
    const base = new URL(appUrl);
    const t = new URL(target, base);
    if (t.origin !== base.origin) return "/";
    const path = t.pathname + t.search;
    // nie zurück in die Anmeldung
    return path.startsWith("/auth/") ? "/" : path;
  } catch {
    return "/";
  }
}

function base64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function randomToken(bytes = 32): string {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return base64url(a);
}

/** PKCE S256: challenge = base64url(sha256(verifier)) */
export async function pkceChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return base64url(new Uint8Array(digest));
}

/** Rolle in Baax Stay aus den Hub-Angaben; Praktikanten-Kennzeichen geht vor (außer Admin). */
export function roleFromHubClaims(claims: { role?: unknown; intern?: unknown }): Role | null {
  const role = mapHubRole(claims.role);
  if (!role) return null;
  if (claims.intern === true && role !== "ADMIN") return "PRAKTIKANT";
  return role;
}

/** Fehler vom Hub verständlich machen. */
export function hubErrorMessage(error: string | null | undefined): string {
  if (error === "access_denied") return "Kein Zugang zu Baax Stay. Bitte bei der Leitung melden.";
  if (error === "login_required") return "Bitte zuerst im Baax Hub anmelden.";
  return "Anmeldung über den Hub fehlgeschlagen. Bitte Baax Stay erneut über den Hub öffnen.";
}

// --- Hub-API -----------------------------------------------------------------------------

const HUB_CONTACT_ROLE: Record<LeadRole, string> = {
  KAEUFER: "BUYER_INVESTOR",
  VERKAEUFER: "OWNER",
  PARTNER: "SERVICE_PROVIDER",
  MULTIPLIKATOR: "TIPSTER_PARTNER",
};

/** Name in Vor- und Nachname teilen (der Hub verlangt einen Nachnamen). */
export function splitName(name: string): { firstName: string | null; lastName: string } {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return { firstName: null, lastName: parts[0] ?? "Unbekannt" };
  return { firstName: parts.slice(0, -1).join(" "), lastName: parts[parts.length - 1] };
}

export type LeadForHub = {
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  role: LeadRole;
  sourceLabel: string;
  sourceDetail: string | null;
  segmentLabel: string | null;
  interest: string | null;
  note: string | null;
};

/** Kontakt für POST /api/v1/contacts. Einwilligung in E-Mail-Kontakt ist kein Newsletter, daher kein consentNewsletter. */
export function leadToHubContactInput(l: LeadForHub) {
  const { firstName, lastName } = splitName(l.name);
  const source = `Baax Stay: ${l.sourceLabel}${l.sourceDetail ? ` – ${l.sourceDetail}` : ""}`.slice(0, 120);
  const notes = [l.interest && `Interesse: ${l.interest}`, l.note].filter(Boolean).join("\n\n").slice(0, 4000);
  return {
    firstName,
    lastName: lastName.slice(0, 120),
    email: l.email || null,
    phone: l.phone || null,
    companyName: l.company || null,
    roles: [HUB_CONTACT_ROLE[l.role]],
    tags: ["Baax Stay", l.sourceLabel, ...(l.segmentLabel ? [l.segmentLabel] : [])].map((t) => t.slice(0, 40)),
    dataSource: source,
    ...(notes ? { notes } : {}),
  };
}

/** Fälligkeit als „in n Tagen“ für Aufgaben am Ereignis (POST /api/v1/events). */
export function dueInDays(dueAt: string | Date, now: Date = new Date()): number {
  const due = typeof dueAt === "string" ? new Date(dueAt) : dueAt;
  if (Number.isNaN(due.getTime())) return 0;
  return Math.max(0, Math.ceil((due.getTime() - now.getTime()) / 86_400_000));
}

/** Zeitkonstanter Vergleich für Tokens (Status-Endpoint). */
export function safeEqual(a: string, b: string): boolean {
  const ea = new TextEncoder().encode(a);
  const eb = new TextEncoder().encode(b);
  let diff = ea.length ^ eb.length;
  for (let i = 0; i < Math.max(ea.length, eb.length); i++) diff |= (ea[i] ?? 0) ^ (eb[i] ?? 0);
  return diff === 0;
}
