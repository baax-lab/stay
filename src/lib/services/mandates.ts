import "server-only";
import type { MandateStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { checkTransition, defaultEndDate } from "@/lib/mandates";
import { calculateFee, referralReward, suggestBand } from "@/lib/fees";
import { closingTemplate } from "@/lib/checklists";
import type { SessionUser } from "@/lib/session";
import { logEvent } from "./events";
import { runMatchingForMandate } from "./matching";
import { draftStatusNotification } from "./notifications";

/** Lead in Suchauftrag umwandeln (Konzept §8.1). */
export async function createMandateFromLead(leadId: string, user: SessionUser, input: { title?: string }) {
  const lead = await prisma.lead.findUniqueOrThrow({ where: { id: leadId }, include: { mandate: true } });
  if (lead.mandate) return lead.mandate;
  if (lead.role !== "KAEUFER") throw new Error("Nur Käufer-Leads werden zu Suchaufträgen; Verkäufer werden zu Objekten");

  const title = input.title?.trim() || [lead.segment ? SEGMENT_SHORT[lead.segment] : null, lead.regions[0], lead.name].filter(Boolean).join(" ");

  const mandate = await prisma.$transaction(async (tx) => {
    const m = await tx.mandate.create({
      data: {
        leadId: lead.id,
        hubContactId: lead.hubContactId,
        buyerName: lead.name,
        buyerEmail: lead.email,
        buyerPhone: lead.phone,
        title,
        ownerId: user.id,
        ownerName: user.name,
        ownerEmail: user.email,
        referrerId: lead.referrerId,
        note: lead.note,
        profile: {
          create: {
            segments: lead.segment ? [lead.segment] : [],
            countries: [],
            regions: [],
            priceMin: lead.budgetMin,
            priceMax: lead.budgetMax ?? lead.budgetMin ?? 1_000_000,
            mustCriteria: [],
            wishCriteria: [],
            active: false, // erst nach Pflege des Suchprofils aktiv
          },
        },
      },
    });
    await tx.lead.update({ where: { id: lead.id }, data: { status: "UMGEWANDELT" } });
    return m;
  });

  await logEvent(mandate.id, "CREATED", { fromLeadId: lead.id, buyerName: lead.name }, user);
  await audit({ userId: user.id, action: "MANDATE_CREATE", entity: "Mandate", entityId: mandate.id, meta: { leadId } });
  return mandate;
}

const SEGMENT_SHORT = { FEWO: "FeWo", APARTMENTHAUS: "Apartmenthaus", PENSION_HOTEL: "Pension/Hotel" } as const;

export async function createMandate(user: SessionUser, input: { buyerName: string; buyerEmail?: string | null; buyerPhone?: string | null; title: string; hubContactId?: string | null; referrerId?: string | null }) {
  const mandate = await prisma.mandate.create({
    data: {
      buyerName: input.buyerName,
      buyerEmail: input.buyerEmail ?? null,
      buyerPhone: input.buyerPhone ?? null,
      hubContactId: input.hubContactId ?? null,
      title: input.title,
      ownerId: user.id,
      ownerName: user.name,
        ownerEmail: user.email,
      referrerId: input.referrerId ?? null,
      profile: { create: { segments: [], priceMax: 1_000_000, mustCriteria: [], wishCriteria: [], active: false } },
    },
  });
  await logEvent(mandate.id, "CREATED", { buyerName: input.buyerName }, user);
  await audit({ userId: user.id, action: "MANDATE_CREATE", entity: "Mandate", entityId: mandate.id });
  return mandate;
}

export type ChangeStatusResult = { ok: true } | { ok: false; error: string };

/** Statuswechsel mit allen Folgeaktionen (Konzept §5, §8.2, §8.6, §8.11, §8.16, §8.17). */
export async function changeMandateStatus(
  mandateId: string,
  target: MandateStatus,
  user: SessionUser,
  opts: { endReason?: string | null; purchasePrice?: number | null; propertyId?: string | null } = {},
): Promise<ChangeStatusResult> {
  const mandate = await prisma.mandate.findUniqueOrThrow({ where: { id: mandateId }, include: { fee: true, profile: true, referrer: true, presentations: true } });
  const check = checkTransition(mandate, target, opts);
  if (!check.ok) return { ok: false, error: check.reason };

  const data: Prisma.MandateUpdateInput = { status: target };
  if (target === "PAUSIERT") data.statusBeforePause = mandate.status;
  if (mandate.status === "PAUSIERT") data.statusBeforePause = null;
  if (target === "BEENDET_OHNE_KAUF") data.endReason = opts.endReason?.trim();
  if (target === "BEAUFTRAGT") {
    const start = mandate.startDate ?? new Date();
    data.startDate = start;
    data.endDate = mandate.endDate ?? defaultEndDate(start);
    data.contractSignedAt = mandate.contractSignedAt ?? new Date();
  }

  await prisma.mandate.update({ where: { id: mandateId }, data });

  if (target === "BEAUFTRAGT" || target === "SUCHE") {
    await prisma.searchProfile.update({ where: { mandateId }, data: { active: true } }).catch(() => undefined);
    await runMatchingForMandate(mandateId);
  }

  if (target === "GEKAUFT" && opts.purchasePrice) {
    await settlePurchase(mandateId, opts.purchasePrice, opts.propertyId ?? null, user);
  }

  if (target === "ABGESCHLOSSEN" || target === "BEENDET_OHNE_KAUF") {
    await prisma.searchProfile.update({ where: { mandateId }, data: { active: false } }).catch(() => undefined);
    await prisma.match.updateMany({ where: { mandateId, status: { in: ["NEU", "GEPRUEFT"] } }, data: { status: "GESCHLOSSEN" } });
  }

  await logEvent(mandateId, "STATUS_CHANGE", { from: mandate.status, to: target, endReason: opts.endReason ?? null, purchasePrice: opts.purchasePrice ?? null }, user);
  await draftStatusNotification(mandateId, target);
  await audit({ userId: user.id, action: "MANDATE_UPDATE", entity: "Mandate", entityId: mandateId, meta: { status: target } });
  return { ok: true };
}

/** Bei GEKAUFT: Kaufpreis eintragen, Honorar inkl. Bonus berechnen, Prämie vorschlagen, Kaufabwicklung anlegen. */
async function settlePurchase(mandateId: string, purchasePrice: number, propertyId: string | null, user: SessionUser) {
  const mandate = await prisma.mandate.findUniqueOrThrow({ where: { id: mandateId }, include: { fee: true, referrer: true, presentations: true, offers: { orderBy: { madeAt: "desc" } }, closing: true } });

  // Gekauftes Objekt: explizit, sonst aus angenommenem Angebot, sonst aus Kaufabwicklung
  const boughtPropertyId = propertyId ?? mandate.offers.find((o) => o.response === "ANGENOMMEN")?.propertyId ?? mandate.closing?.propertyId ?? mandate.presentations[0]?.propertyId ?? null;
  const presentation = boughtPropertyId ? mandate.presentations.find((p) => p.propertyId === boughtPropertyId) : undefined;
  const askingPrice = presentation?.askingPrice ?? (boughtPropertyId ? (await prisma.property.findUnique({ where: { id: boughtPropertyId } }))?.price ?? null : null);

  const fee = mandate.fee ?? (await ensureFeeAgreement(mandateId));
  const calc = calculateFee({ ...fee, askingPrice, purchasePrice });
  await prisma.feeAgreement.update({ where: { mandateId }, data: { purchasePrice, askingPrice, bonusAmount: calc.bonus } });

  if (boughtPropertyId) {
    await prisma.property.update({ where: { id: boughtPropertyId }, data: { availability: "VERKAUFT" } });
    if (!mandate.closing) {
      const property = await prisma.property.findUniqueOrThrow({ where: { id: boughtPropertyId } });
      await prisma.closing.create({ data: { mandateId, propertyId: boughtPropertyId, country: property.country, checklist: closingTemplate(property.country) } });
    }
  }

  // Prämie für Tippgeber vorschlagen (Konzept §8.11)
  if (mandate.referrer && !(await prisma.referralReward.findFirst({ where: { mandateId, referrerId: mandate.referrer.id } }))) {
    const net = calc.successFee + calc.bonus - calc.sellerSideCredited;
    const reward = referralReward(mandate.referrer, Math.max(0, net));
    if (reward.amount > 0) {
      await prisma.referralReward.create({ data: { referrerId: mandate.referrer.id, mandateId, amount: reward.amount, basis: reward.basis } });
      await logEvent(mandateId, "REWARD", { referrerId: mandate.referrer.id, referrerName: mandate.referrer.name, amount: reward.amount, basis: reward.basis }, user);
    }
  }

  await logEvent(mandateId, "FEE_SAVED", { purchasePrice, askingPrice, bonus: calc.bonus, total: calc.total, propertyId: boughtPropertyId }, user);
}

export async function ensureFeeAgreement(mandateId: string) {
  const existing = await prisma.feeAgreement.findUnique({ where: { mandateId } });
  if (existing) return existing;
  const profile = await prisma.searchProfile.findUnique({ where: { mandateId } });
  const bands = await prisma.feeBand.findMany();
  const band = suggestBand(bands, profile?.priceMax ?? 0);
  return prisma.feeAgreement.create({
    data: {
      mandateId,
      volumeBandId: band?.id ?? null,
      baseFeeActive: false,
      baseFee: band?.baseFee ?? 0,
      successFee: band?.successFee ?? 0,
      bonusPct: band?.bonusPct ?? 0.1,
      bonusCapPct: band?.bonusCapPct ?? 0.25,
    },
  });
}

/** FollowUp drei Monate nach Übergabe (Konzept §8.17). */
export async function ensureFollowUp(mandateId: string, handoverDate: Date) {
  const existing = await prisma.followUp.findFirst({ where: { mandateId } });
  if (existing) return existing;
  const due = new Date(handoverDate);
  due.setMonth(due.getMonth() + 3);
  return prisma.followUp.create({ data: { mandateId, dueAt: due } });
}
