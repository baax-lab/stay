import "server-only";
import { z } from "zod";
import { prisma } from "./db";

export const activeEventSchema = z.object({
  active: z.boolean().default(true),
  source: z.enum(["MESSE", "AGENTUR", "MULTIPLIKATOR", "WEBSITE", "EMPFEHLUNG", "LINKEDIN", "BESTAND", "SONSTIGES"]).default("MESSE"),
  sourceDetail: z.string().trim().max(200).default(""),
});
export type ActiveEvent = z.output<typeof activeEventSchema>;

const DEFAULT_EVENT: ActiveEvent = { active: false, source: "SONSTIGES", sourceDetail: "" };

export async function getActiveEvent(): Promise<ActiveEvent> {
  const row = await prisma.setting.findUnique({ where: { key: "activeEvent" } });
  if (!row) return DEFAULT_EVENT;
  const parsed = activeEventSchema.safeParse(row.value);
  return parsed.success ? parsed.data : DEFAULT_EVENT;
}

export async function setActiveEvent(value: ActiveEvent, userId: string): Promise<void> {
  await prisma.setting.upsert({
    where: { key: "activeEvent" },
    update: { value, updatedBy: userId },
    create: { key: "activeEvent", value, updatedBy: userId },
  });
}

/** Kennungen für das QR-Formular: ?q=<key> → Quelle und Detail. Pflegbar als Einstellung. */
export const publicSourceSchema = z.record(
  z.string().regex(/^[a-z0-9_-]{2,40}$/),
  z.object({
    source: z.enum(["MESSE", "AGENTUR", "MULTIPLIKATOR", "WEBSITE", "EMPFEHLUNG", "LINKEDIN", "BESTAND", "SONSTIGES"]),
    sourceDetail: z.string().trim().max(200),
  }),
);
export type PublicSources = z.output<typeof publicSourceSchema>;

const DEFAULT_PUBLIC_SOURCES: PublicSources = {
  superstay26: { source: "MESSE", sourceDetail: "SuperStay LIVE 2026" },
  web: { source: "WEBSITE", sourceDetail: "baax.de" },
  linkedin: { source: "LINKEDIN", sourceDetail: "LinkedIn" },
};

export async function getPublicSources(): Promise<PublicSources> {
  const row = await prisma.setting.findUnique({ where: { key: "publicSources" } });
  if (!row) return DEFAULT_PUBLIC_SOURCES;
  const parsed = publicSourceSchema.safeParse(row.value);
  return parsed.success ? parsed.data : DEFAULT_PUBLIC_SOURCES;
}

export async function setPublicSources(value: PublicSources, userId: string): Promise<void> {
  await prisma.setting.upsert({
    where: { key: "publicSources" },
    update: { value, updatedBy: userId },
    create: { key: "publicSources", value, updatedBy: userId },
  });
}

export const goalSchema = z.object({
  mandates: z.number().int().min(1).default(3),
  days: z.number().int().min(1).default(90),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).default("2026-11-20"),
});
export type Goal = z.output<typeof goalSchema>;

export async function getGoal(): Promise<Goal> {
  const row = await prisma.setting.findUnique({ where: { key: "goal" } });
  const parsed = goalSchema.safeParse(row?.value ?? {});
  return parsed.success ? parsed.data : goalSchema.parse({});
}

export async function setGoal(value: Goal, userId: string): Promise<void> {
  await prisma.setting.upsert({ where: { key: "goal" }, update: { value, updatedBy: userId }, create: { key: "goal", value, updatedBy: userId } });
}

/**
 * Rechtstexte für öffentliche Seiten (Interessenformular, Datenschutzhinweise, Portal).
 * Leerer Datenschutztext = eingebauter Standardtext. Format: Absätze durch Leerzeilen, „## “ am Zeilenanfang = Zwischenüberschrift.
 */
export const legalSchema = z.object({
  privacyText: z.string().max(20_000).default(""),
  imprintUrl: z
    .string()
    .trim()
    .max(300)
    .refine((v) => v === "" || /^https:\/\//.test(v), "Impressum-Link muss mit https:// beginnen")
    .default("https://www.baax.de/impressum"),
  contactEmail: z.string().trim().max(200).default("mail@baax.de"),
});
export type LegalTexts = z.output<typeof legalSchema>;

export async function getLegalTexts(): Promise<LegalTexts> {
  const row = await prisma.setting.findUnique({ where: { key: "legal" } });
  const parsed = legalSchema.safeParse(row?.value ?? {});
  return parsed.success ? parsed.data : legalSchema.parse({});
}

export async function setLegalTexts(value: LegalTexts, userId: string): Promise<void> {
  await prisma.setting.upsert({ where: { key: "legal" }, update: { value, updatedBy: userId }, create: { key: "legal", value, updatedBy: userId } });
}
