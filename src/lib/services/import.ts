import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { normalizeEmail, normalizePhone } from "@/lib/leads";
import type { ImportScope } from "@/lib/csv";
import type { SessionUser } from "@/lib/session";
import { findDuplicates } from "./lead-service-bridge";
import { createProperty, findPropertyDuplicates, type PropertyInput } from "./properties";
import { CRITERIA } from "@/lib/criteria";

/** CSV-Import (Konzept §8.24): Zuordnung → Vorschau mit Dubletten → Speichern. Nur Leitung/Admin, protokolliert. */

export type ImportRow = Record<string, string>;
export type PreviewRow = { index: number; data: Record<string, unknown>; errors: string[]; duplicates: Array<{ id: string; label: string }> };

const yes = (v: string | undefined) => /^(ja|yes|true|1|x)$/i.test((v ?? "").trim());
const int = (v: string | undefined) => {
  const s = (v ?? "").replace(/[^\d,.-]/g, "").replace(/\.(?=\d{3}\b)/g, "").replace(",", ".");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n) : null;
};
const dateOf = (v: string | undefined) => {
  const s = (v ?? "").trim();
  if (!s) return null;
  const de = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/);
  const d = de ? new Date(Number(de[3].length === 2 ? "20" + de[3] : de[3]), Number(de[2]) - 1, Number(de[1])) : new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
};
const list = (v: string | undefined) => (v ?? "").split(/[,;|]/).map((s) => s.trim()).filter(Boolean);

const ROLE: Record<string, string> = { käufer: "KAEUFER", kaeufer: "KAEUFER", buyer: "KAEUFER", verkäufer: "VERKAEUFER", verkaeufer: "VERKAEUFER", seller: "VERKAEUFER", partner: "PARTNER", multiplikator: "MULTIPLIKATOR" };
const SOURCE = ["MESSE", "AGENTUR", "MULTIPLIKATOR", "WEBSITE", "EMPFEHLUNG", "LINKEDIN", "BESTAND", "SONSTIGES"];
const SEGMENT: Record<string, string> = { fewo: "FEWO", ferienwohnung: "FEWO", apartment: "FEWO", wohnung: "FEWO", apartmenthaus: "APARTMENTHAUS", mehrfamilienhaus: "APARTMENTHAUS", pension: "PENSION_HOTEL", hotel: "PENSION_HOTEL", "pension_hotel": "PENSION_HOTEL" };
const LICENSE: Record<string, string> = { vorhanden: "VORHANDEN", ja: "VORHANDEN", yes: "VORHANDEN", beantragt: "BEANTRAGT", fehlt: "FEHLT", nein: "FEHLT", no: "FEHLT", unklar: "UNKLAR", "nicht nötig": "NICHT_NOETIG", "nicht noetig": "NICHT_NOETIG" };
const OSOURCE = ["PARTNER", "AGENTUR", "PORTAL", "OFFMARKET", "DIREKT"];
const PTYPE = ["MAKLER", "AGENTUR", "ANWALT", "NOTAR", "FINANZIERER", "SONSTIGES"];

function pick<T extends string>(v: string | undefined, allowed: T[], fallback: T): T {
  const u = (v ?? "").trim().toUpperCase();
  return (allowed as string[]).includes(u) ? (u as T) : fallback;
}

export async function previewImport(scope: ImportScope, rows: ImportRow[]): Promise<PreviewRow[]> {
  const regions = await prisma.region.findMany();
  const regionKey = (v: string | undefined, country: string) => {
    const s = (v ?? "").trim().toLowerCase();
    if (!s) return null;
    const hit = regions.find((r) => r.key === s) ?? regions.find((r) => r.name.toLowerCase() === s && r.country === country) ?? regions.find((r) => r.name.toLowerCase().includes(s) && r.country === country);
    return hit?.key ?? null;
  };
  const featureKey = (v: string): string | null => {
    const s = v.trim().toLowerCase().replace(/\s+/g, "_");
    return CRITERIA.find((c) => c.key === s || c.label.toLowerCase() === v.trim().toLowerCase())?.key ?? null;
  };

  const out: PreviewRow[] = [];
  for (const [index, r] of rows.entries()) {
    const errors: string[] = [];
    const duplicates: Array<{ id: string; label: string }> = [];
    let data: Record<string, unknown> = {};

    if (scope === "leads") {
      const email = normalizeEmail(r.email);
      const phone = r.phone?.trim() || null;
      if (!r.name?.trim()) errors.push("Name fehlt");
      if (!email && !phone) errors.push("Telefon oder E-Mail fehlt");
      data = {
        name: r.name?.trim(),
        company: r.company?.trim() || null,
        email,
        phone,
        role: ROLE[(r.role ?? "").trim().toLowerCase()] ?? "KAEUFER",
        source: pick(r.source, SOURCE, "BESTAND"),
        sourceDetail: r.sourceDetail?.trim() || "CSV-Import",
        interest: r.interest?.trim() || null,
        segment: SEGMENT[(r.segment ?? "").trim().toLowerCase()] ?? null,
        regions: list(r.regions),
        budgetMin: int(r.budgetMin),
        budgetMax: int(r.budgetMax),
        consentEmail: yes(r.consentEmail),
        note: r.note?.trim() || null,
      };
      if (!errors.length) for (const d of await findDuplicates({ email, phone })) duplicates.push({ id: d.id, label: `${d.name} (${d.email ?? d.phone})` });
    } else if (scope === "objekte") {
      const country = (r.country ?? "").trim().toUpperCase().slice(0, 2);
      const region = regionKey(r.region, country);
      const price = int(r.price);
      if (!r.title?.trim()) errors.push("Titel fehlt");
      if (country.length !== 2) errors.push("Land fehlt (ISO-Code)");
      if (!region) errors.push(`Region „${r.region ?? ""}“ unbekannt`);
      if (!price) errors.push("Preis fehlt");
      const segment = SEGMENT[(r.segment ?? "").trim().toLowerCase()];
      if (!segment) errors.push("Segment unbekannt");
      const features = list(r.features).map(featureKey).filter((x): x is string => Boolean(x));
      data = {
        title: r.title?.trim(),
        segment,
        country,
        region,
        locality: r.locality?.trim() || null,
        address: r.address?.trim() || null,
        price,
        units: int(r.units),
        livingArea: int(r.livingArea),
        licenseStatus: LICENSE[(r.licenseStatus ?? "").trim().toLowerCase()] ?? "UNKLAR",
        occupancyPct: int(r.occupancyPct),
        adr: int(r.adr),
        revenueYear: int(r.revenueYear),
        features,
        source: pick(r.source, OSOURCE, "PORTAL"),
        sourceDetail: r.sourceDetail?.trim() || "CSV-Import",
        knownSince: dateOf(r.knownSince)?.toISOString() ?? null,
        knownSourceNote: r.knownSourceNote?.trim() || null,
        offmarket: yes(r.offmarket),
        description: r.description?.trim() || null,
      };
      if (!errors.length && price) {
        for (const d of await findPropertyDuplicates({ country, locality: data.locality as string | null, address: data.address as string | null, price, units: data.units as number | null })) {
          duplicates.push({ id: d.id, label: `${d.title} (${d.price.toLocaleString("de-DE")} €, seit ${d.knownSince.toLocaleDateString("de-DE")})` });
        }
      }
    } else {
      const country = (r.country ?? "").trim().toUpperCase().slice(0, 2);
      if (!r.name?.trim()) errors.push("Name fehlt");
      if (country.length !== 2) errors.push("Land fehlt (ISO-Code)");
      data = {
        name: r.name?.trim(),
        company: r.company?.trim() || null,
        email: normalizeEmail(r.email),
        phone: r.phone?.trim() || null,
        language: (r.language ?? "").trim().toLowerCase() === "en" ? "en" : "de",
        type: pick(r.type, PTYPE, "MAKLER"),
        country,
        regions: list(r.regions).map((v) => regionKey(v, country)).filter((x): x is string => Boolean(x)),
        licenseNote: r.licenseNote?.trim() || null,
        commissionSplit: r.commissionSplit?.trim() || null,
        agreementAt: dateOf(r.agreementAt)?.toISOString() ?? null,
        note: r.note?.trim() || null,
      };
      const email = data.email as string | null;
      if (email) {
        const ex = await prisma.partner.findFirst({ where: { email } });
        if (ex) duplicates.push({ id: ex.id, label: `${ex.name} (${ex.email})` });
      }
    }
    out.push({ index, data, errors, duplicates });
  }
  return out;
}

export async function commitImport(scope: ImportScope, rows: PreviewRow[], opts: { skipDuplicates: boolean }, user: SessionUser): Promise<{ created: number; skipped: number }> {
  let created = 0;
  let skipped = 0;
  for (const row of rows) {
    if (row.errors.length || (opts.skipDuplicates && row.duplicates.length)) {
      skipped++;
      continue;
    }
    const d = row.data;
    if (scope === "leads") {
      await prisma.lead.create({
        data: {
          ...(d as Prisma.LeadUncheckedCreateInput),
          phoneNorm: normalizePhone(d.phone as string | null),
          consentAt: d.consentEmail ? new Date() : null,
          duplicateOfId: row.duplicates[0]?.id ?? null,
          createdById: user.id,
        },
      });
    } else if (scope === "objekte") {
      const input = { ...(d as unknown as PropertyInput), knownSince: d.knownSince ? new Date(d.knownSince as string) : null };
      await createProperty(input, user);
    } else {
      await prisma.partner.create({ data: { ...(d as Prisma.PartnerUncheckedCreateInput), agreementAt: d.agreementAt ? new Date(d.agreementAt as string) : null } });
    }
    created++;
  }
  await audit({ userId: user.id, action: "IMPORT", entity: scope, meta: { created, skipped, total: rows.length } });
  return { created, skipped };
}
