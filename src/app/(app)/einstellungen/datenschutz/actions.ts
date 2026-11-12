"use server";

import { requirePermission } from "@/lib/auth";
import { parsePrivacyQuery } from "@/lib/privacy";
import { executeErasure, findSubjects, planErasure, subjectCount, type ErasureItem, type PrivacySubjects } from "@/lib/services/privacy";

export type PrivacyState =
  | { status: "idle" }
  | { status: "error"; error: string }
  | { status: "found"; q: string; subjects: PrivacySubjects; plan: ErasureItem[]; eraseError?: string }
  | { status: "erased"; q: string; result: Awaited<ReturnType<typeof executeErasure>>; plan: ErasureItem[] };

/**
 * Ein Einstieg für Suche und Löschung (Feld „intent“), damit die Seite genau einen Zustand hat.
 * Per POST, damit E-Mail-Adressen und Telefonnummern nicht in URLs und Server-Logs landen.
 */
export async function privacyAction(prev: PrivacyState, fd: FormData): Promise<PrivacyState> {
  const user = await requirePermission("handlePrivacyRequests");
  const q = parsePrivacyQuery(String(fd.get("q") ?? ""));
  if (!q) return { status: "error", error: "Bitte E-Mail, Telefonnummer, Name (mind. 3 Zeichen) oder Hub-Kontakt-ID eingeben." };

  if (fd.get("intent") !== "erase") {
    const subjects = await findSubjects(q);
    return { status: "found", q: q.raw, subjects, plan: await planErasure(subjects) };
  }

  const keep = (eraseError: string): PrivacyState => (prev.status === "found" ? { ...prev, eraseError } : { status: "error", error: eraseError });
  if (String(fd.get("confirm") ?? "").trim() !== "LÖSCHEN") return keep("Zur Bestätigung „LÖSCHEN“ eingeben.");
  // Plan serverseitig neu berechnen, nie dem Formular vertrauen
  const subjects = await findSubjects(q);
  if (!subjectCount(subjects)) return keep("Keine Datensätze (mehr) gefunden.");
  // Einzelne Treffer ausnehmen (z. B. Namensgleichheit)
  const excluded = new Set(fd.getAll("exclude").map(String));
  const plan = (await planErasure(subjects)).filter((i) => !excluded.has(`${i.entity}:${i.id}`));
  const result = await executeErasure(plan, user.id);
  return { status: "erased", q: q.raw, result, plan };
}
