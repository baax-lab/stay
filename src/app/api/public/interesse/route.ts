import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { rateLimit } from "@/lib/rate-limit";
import { getPublicSources } from "@/lib/settings";
import { createLead } from "@/lib/lead-service";

/**
 * Öffentliches Interessenformular (QR-Code). Spam-Schutz: Honeypot, Mindestdauer, Rate-Limit pro IP.
 * Legt einen Lead mit Quelle aus ?q=<kennung> an (Standard: WEBSITE).
 */
const schema = z.object({
  q: z.string().regex(/^[a-z0-9_-]{2,40}$/).nullable().optional(),
  name: z.string().trim().min(2, "Bitte Namen angeben").max(200),
  email: z.string().trim().toLowerCase().pipe(z.email("Bitte gültige E-Mail angeben")),
  phone: z.string().trim().max(50).optional().default(""),
  role: z.enum(["KAEUFER", "VERKAEUFER", "PARTNER", "MULTIPLIKATOR"]),
  interest: z.string().trim().max(2000).optional().default(""),
  region: z.string().trim().max(500).optional().default(""),
  budgetBand: z.enum(["bis300", "300-1000", "1000-3000", "ueber3000"]).nullable().optional(),
  // Formular-Ausbau: Vorschlag fürs Suchprofil und Sprache des Kontakts
  lang: z.enum(["de", "en"]).optional().default("de"),
  segment: z.enum(["FEWO", "APARTMENTHAUS", "PENSION_HOTEL"]).nullable().optional(),
  timeHorizon: z.enum(["SOFORT", "MONATE_6", "MONATE_12", "SPAETER"]).nullable().optional(),
  financing: z.enum(["EIGENKAPITAL", "FINANZIERUNG", "OFFEN"]).nullable().optional(),
  contactChannel: z.enum(["TELEFON", "EMAIL", "WHATSAPP"]).nullable().optional(),
  consent: z.boolean(),
  website: z.string().max(200).optional().default(""),
  elapsedMs: z.number().optional(),
});

function ip(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
}

export async function POST(req: NextRequest) {
  const addr = ip(req);
  // 20 Anfragen je 10 Minuten: auf der Messe teilen sich viele Besucher eine IP (WLAN/NAT)
  const rl = rateLimit(`interesse:${addr}`, 20, 10 * 60 * 1000);
  if (!rl.ok) {
    return NextResponse.json({ error: "Zu viele Anfragen. Bitte in einigen Minuten erneut versuchen." }, { status: 429, headers: { "retry-after": String(rl.retryAfterSec) } });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ungültige Anfrage" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const i of parsed.error.issues) errors[String(i.path[0] ?? "form")] ??= i.message;
    return NextResponse.json({ error: "Bitte Eingaben prüfen.", errors }, { status: 422 });
  }
  const d = parsed.data;

  // Honeypot ausgefüllt oder unmenschlich schnell: still „annehmen“, aber nichts speichern.
  if (d.website || (d.elapsedMs !== undefined && d.elapsedMs < 1500)) {
    return NextResponse.json({ ok: true });
  }

  if (!d.consent) {
    return NextResponse.json({ error: "Bitte Eingaben prüfen.", errors: { consent: "Ohne Einwilligung können wir Sie nicht kontaktieren." } }, { status: 422 });
  }

  const sources = await getPublicSources();
  const src = (d.q && sources[d.q]) || { source: "WEBSITE" as const, sourceDetail: d.q ? `Interessenformular (${d.q})` : "Interessenformular" };

  const result = await createLead(
    {
      name: d.name,
      email: d.email,
      phone: d.phone || null,
      role: d.role,
      source: src.source,
      sourceDetail: src.sourceDetail,
      interest: d.interest || null,
      regions: d.region ? d.region.split(/[,;/]/).map((s) => s.trim()).filter(Boolean).slice(0, 15) : [],
      budgetBand: d.budgetBand ?? null,
      segment: d.segment ?? null,
      timeHorizon: d.timeHorizon ?? null,
      financing: d.financing ?? null,
      contactChannel: d.contactChannel ?? null,
      language: d.lang,
      consentEmail: true,
      note: null,
    },
    { userId: "public", ip: addr, publicForm: true },
  );

  if (!result.ok) return NextResponse.json({ error: "Bitte Eingaben prüfen.", errors: result.errors }, { status: 422 });

  // Hub-Übergabe nicht im Request des Interessenten abwarten; läuft über „Übergabe nachholen“ bzw. Cron.
  return NextResponse.json({ ok: true });
}
