import "server-only";
import { prisma } from "@/lib/db";
import { CRITERIA, type CriterionDef } from "@/lib/criteria";
import { EN_CRITERIA } from "@/lib/profile-text";

/** Kriterienkatalog aus der Datenbank (Phase 2), Rückfall auf die Konstante. */
export async function getCriteria(opts: { includeInactive?: boolean } = {}): Promise<Array<CriterionDef & { active: boolean; sort: number }>> {
  const rows = await prisma.criterion.findMany({ where: opts.includeInactive ? {} : { active: true }, orderBy: [{ group: "asc" }, { sort: "asc" }, { label: "asc" }] });
  if (rows.length === 0 && !opts.includeInactive) return CRITERIA.map((c, i) => ({ ...c, labelEn: EN_CRITERIA[c.key] ?? null, active: true, sort: i }));
  return rows;
}

/** Bezeichnungen für alle Schlüssel, auch inaktive (ältere Profile und Objekte verwenden sie weiter). */
export async function criteriaLabels(): Promise<{ de: Record<string, string>; en: Record<string, string> }> {
  const rows = await prisma.criterion.findMany();
  const de: Record<string, string> = Object.fromEntries(CRITERIA.map((c) => [c.key, c.label]));
  const en: Record<string, string> = { ...EN_CRITERIA };
  for (const r of rows) {
    de[r.key] = r.label;
    if (r.labelEn) en[r.key] = r.labelEn;
  }
  return { de, en };
}

export function slugKey(label: string): string {
  return label
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 40);
}
