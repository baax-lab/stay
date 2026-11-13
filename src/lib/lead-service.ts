import "server-only";
import type { Lead, Prisma } from "@prisma/client";
import { prisma } from "./db";
import { audit } from "./audit";
import { budgetFromBand, leadInputSchema, normalizeEmail, normalizePhone, type LeadInput, type LeadParsed } from "./leads";

export type DuplicateHit = Pick<Lead, "id" | "name" | "email" | "phone" | "company" | "createdAt" | "status">;

/** Mögliche Dubletten: gleiche E-Mail oder gleiche (normalisierte) Telefonnummer. */
export async function findDuplicates(input: { email?: string | null; phone?: string | null }, excludeId?: string): Promise<DuplicateHit[]> {
  const email = normalizeEmail(input.email);
  const phone = normalizePhone(input.phone);
  if (!email && !phone) return [];

  const or: Prisma.LeadWhereInput[] = [];
  if (email) or.push({ email: { equals: email, mode: "insensitive" } });
  if (phone) or.push({ phoneNorm: phone });

  const candidates = await prisma.lead.findMany({
    where: { OR: or, ...(excludeId ? { NOT: { id: excludeId } } : {}) },
    select: { id: true, name: true, email: true, phone: true, company: true, createdAt: true, status: true },
    orderBy: { createdAt: "asc" },
    take: 10,
  });

  return candidates;
}

export type CreateLeadResult =
  | { ok: true; lead: Lead; duplicates: DuplicateHit[]; alreadyExisted: boolean }
  | { ok: false; errors: Record<string, string> };

export function toFieldErrors(error: { issues: Array<{ path: PropertyKey[]; message: string }> }): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!errors[key]) errors[key] = issue.message;
  }
  return errors;
}

export async function createLead(
  raw: LeadInput,
  ctx: { userId: string; ip?: string | null; publicForm?: boolean },
): Promise<CreateLeadResult> {
  const parsed = leadInputSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, errors: toFieldErrors(parsed.error) };
  const data: LeadParsed = parsed.data;

  // Idempotenz für Offline-Nachsendung: gleiche clientId → gleicher Lead.
  if (data.clientId) {
    const existing = await prisma.lead.findUnique({ where: { clientId: data.clientId } });
    if (existing) return { ok: true, lead: existing, duplicates: [], alreadyExisted: true };
  }

  const duplicates = await findDuplicates({ email: data.email, phone: data.phone });
  const { budgetMin, budgetMax } = budgetFromBand(data.budgetBand);

  const lead = await prisma.lead.create({
    data: {
      clientId: data.clientId ?? null,
      name: data.name,
      company: data.company ?? null,
      email: data.email ?? null,
      phone: data.phone ?? null,
      phoneNorm: normalizePhone(data.phone),
      role: data.role,
      source: data.source,
      sourceDetail: data.sourceDetail ?? null,
      interest: data.interest ?? null,
      segment: data.segment ?? null,
      regions: data.regions,
      budgetMin,
      budgetMax,
      consentEmail: data.consentEmail,
      consentAt: data.consentEmail ? new Date() : null,
      note: data.note ?? null,
      language: data.language ?? null,
      callbackAt: data.callbackAt ?? null,
      timeHorizon: data.timeHorizon ?? null,
      financing: data.financing ?? null,
      contactChannel: data.contactChannel ?? null,
      createdById: ctx.userId,
      duplicateOfId: duplicates[0]?.id ?? null,
    },
  });

  await audit({
    userId: ctx.publicForm ? null : ctx.userId,
    action: ctx.publicForm ? "LEAD_PUBLIC_CREATE" : "LEAD_CREATE",
    entity: "Lead",
    entityId: lead.id,
    meta: { source: lead.source, sourceDetail: lead.sourceDetail, duplicates: duplicates.map((d) => d.id) },
    ip: ctx.ip,
  });

  return { ok: true, lead, duplicates, alreadyExisted: false };
}

/** Lead mit einem bestehenden zusammenführen: leere Felder des Ziels auffüllen, Quelle als VERWORFEN markieren. */
export async function mergeLead(sourceId: string, targetId: string, userId: string): Promise<Lead> {
  if (sourceId === targetId) throw new Error("Lead kann nicht mit sich selbst zusammengeführt werden");
  const [source, target] = await Promise.all([
    prisma.lead.findUniqueOrThrow({ where: { id: sourceId } }),
    prisma.lead.findUniqueOrThrow({ where: { id: targetId } }),
  ]);

  const fill = <T>(a: T | null, b: T | null) => a ?? b;
  const merged = await prisma.$transaction(async (tx) => {
    const updated = await tx.lead.update({
      where: { id: target.id },
      data: {
        company: fill(target.company, source.company),
        email: fill(target.email, source.email),
        phone: fill(target.phone, source.phone),
        phoneNorm: fill(target.phoneNorm, source.phoneNorm),
        interest: [target.interest, source.interest].filter(Boolean).join("\n---\n") || null,
        segment: fill(target.segment, source.segment),
        regions: Array.from(new Set([...target.regions, ...source.regions])),
        budgetMin: fill(target.budgetMin, source.budgetMin),
        budgetMax: fill(target.budgetMax, source.budgetMax),
        consentEmail: target.consentEmail || source.consentEmail,
        consentAt: target.consentAt ?? source.consentAt,
        note: [target.note, source.note].filter(Boolean).join("\n---\n") || null,
      },
    });
    await tx.lead.update({
      where: { id: source.id },
      data: { status: "VERWORFEN", duplicateOfId: target.id, note: [source.note, `Zusammengeführt mit ${target.id}`].filter(Boolean).join("\n") },
    });
    return updated;
  });

  await audit({ userId, action: "LEAD_MERGE", entity: "Lead", entityId: target.id, meta: { from: source.id } });
  return merged;
}
