import { z } from "zod";

/** Budget grob (Konzept §7): Auswahl statt Zahlen. */
export const BUDGET_BANDS = [
  { key: "bis300", label: "bis 300 T€", min: null, max: 300_000 },
  { key: "300-1000", label: "300 T€ – 1 Mio. €", min: 300_000, max: 1_000_000 },
  { key: "1000-3000", label: "1 – 3 Mio. €", min: 1_000_000, max: 3_000_000 },
  { key: "ueber3000", label: "über 3 Mio. €", min: 3_000_000, max: null },
] as const;

export type BudgetBandKey = (typeof BUDGET_BANDS)[number]["key"];

export function budgetFromBand(key: string | null | undefined): { budgetMin: number | null; budgetMax: number | null } {
  const band = BUDGET_BANDS.find((b) => b.key === key);
  return { budgetMin: band?.min ?? null, budgetMax: band?.max ?? null };
}

export function bandFromBudget(min: number | null, max: number | null): BudgetBandKey | null {
  const band = BUDGET_BANDS.find((b) => b.min === min && b.max === max);
  return band?.key ?? null;
}

export function formatBudget(min: number | null, max: number | null): string {
  const band = bandFromBudget(min, max);
  if (band) return BUDGET_BANDS.find((b) => b.key === band)!.label;
  const f = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toLocaleString("de-DE")} Mio. €` : `${Math.round(n / 1000)} T€`);
  if (min && max) return `${f(min)} – ${f(max)}`;
  if (max) return `bis ${f(max)}`;
  if (min) return `ab ${f(min)}`;
  return "–";
}

/** E-Mail für Dubletten-Vergleich normalisieren. */
export function normalizeEmail(email: string | null | undefined): string | null {
  const e = email?.trim().toLowerCase();
  return e ? e : null;
}

/** Telefonnummer auf Ziffern (mit Ländervorwahl, wenn erkennbar) reduzieren. */
export function normalizePhone(phone: string | null | undefined, defaultCountry = "49"): string | null {
  if (!phone) return null;
  let digits = phone.replace(/[^\d+]/g, "");
  if (!digits) return null;
  if (digits.startsWith("00")) digits = "+" + digits.slice(2);
  if (digits.startsWith("+")) return digits.slice(1);
  if (digits.startsWith("0")) return defaultCountry + digits.slice(1);
  return digits;
}

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional();

export const leadInputSchema = z
  .object({
    clientId: z.string().trim().max(64).optional().nullable(),
    name: z.string().trim().min(2, "Name fehlt").max(200),
    company: optionalText(200),
    email: z
      .string()
      .trim()
      .max(200)
      .transform((v) => (v === "" ? null : v.toLowerCase()))
      .nullable()
      .optional()
      .refine((v) => !v || z.email().safeParse(v).success, "E-Mail ungültig"),
    phone: optionalText(50),
    role: z.enum(["KAEUFER", "VERKAEUFER", "PARTNER", "MULTIPLIKATOR"]),
    source: z.enum(["MESSE", "AGENTUR", "MULTIPLIKATOR", "WEBSITE", "EMPFEHLUNG", "LINKEDIN", "BESTAND", "SONSTIGES"]),
    sourceDetail: optionalText(200),
    interest: optionalText(2000),
    segment: z.enum(["FEWO", "APARTMENTHAUS", "PENSION_HOTEL"]).nullable().optional(),
    regions: z.array(z.string().trim().min(1).max(80)).max(20).default([]),
    budgetBand: z.enum(["bis300", "300-1000", "1000-3000", "ueber3000"]).nullable().optional(),
    consentEmail: z.boolean().default(false),
    note: optionalText(4000),
    // Formular-Ausbau
    language: z.enum(["de", "en", "it", "es", "fr", "nl"]).nullable().optional(),
    callbackAt: z
      .string()
      .trim()
      .max(40)
      .nullable()
      .optional()
      .transform((v) => (v ? new Date(v) : null))
      .refine((d) => d === null || !Number.isNaN(d.getTime()), "Rückruftermin ungültig"),
    timeHorizon: z.enum(["SOFORT", "MONATE_6", "MONATE_12", "SPAETER"]).nullable().optional(),
    financing: z.enum(["EIGENKAPITAL", "FINANZIERUNG", "OFFEN"]).nullable().optional(),
    contactChannel: z.enum(["TELEFON", "EMAIL", "WHATSAPP"]).nullable().optional(),
  })
  .refine((v) => Boolean(v.email || v.phone), {
    message: "Mindestens Telefon oder E-Mail angeben",
    path: ["phone"],
  });

export type LeadInput = z.input<typeof leadInputSchema>;
export type LeadParsed = z.output<typeof leadInputSchema>;

/** FormData aus dem Erfassungsformular in das Eingabeobjekt überführen. */
export function leadInputFromFormData(fd: FormData): LeadInput {
  const str = (k: string) => {
    const v = fd.get(k);
    return typeof v === "string" ? v : "";
  };
  const regions = str("regions")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return {
    clientId: str("clientId") || null,
    name: str("name"),
    company: str("company"),
    email: str("email"),
    phone: str("phone"),
    role: str("role") as LeadInput["role"],
    source: str("source") as LeadInput["source"],
    sourceDetail: str("sourceDetail"),
    interest: str("interest"),
    segment: (str("segment") || null) as LeadInput["segment"],
    regions,
    budgetBand: (str("budgetBand") || null) as LeadInput["budgetBand"],
    consentEmail: fd.get("consentEmail") === "on" || fd.get("consentEmail") === "true",
    note: str("note"),
    language: (str("language") || null) as LeadInput["language"],
    callbackAt: str("callbackAt") || null,
    timeHorizon: (str("timeHorizon") || null) as LeadInput["timeHorizon"],
    financing: (str("financing") || null) as LeadInput["financing"],
    contactChannel: (str("contactChannel") || null) as LeadInput["contactChannel"],
  };
}

/** CSV-Zelle sicher einschließen (RFC 4180, Formel-Injektion entschärfen). */
export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  let s = Array.isArray(value) ? value.join(", ") : value instanceof Date ? value.toISOString() : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  if (/[";\n\r]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}
