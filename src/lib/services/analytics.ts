import "server-only";
import type { MandateStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { calculateFee } from "@/lib/fees";
import { averageRatings } from "@/lib/partner-stats";
import { daysToPurchase, feesByMonth, funnelBySource, funnelTotals, inRange, monthKey, PURCHASED, statusDurations, type StatusEvent } from "@/lib/analytics";

/** Daten für die Auswertung (Konzept §10, Phase 3) im gewählten Zeitraum. */
export async function loadAnalytics(from: Date, to: Date, includeFees: boolean) {
  const [leads, mandatesNoLead, mandates, statusEvents, referrers, partners] = await Promise.all([
    prisma.lead.findMany({ where: { createdAt: { gte: from, lte: to } }, select: { source: true, status: true, createdAt: true, referrerId: true, mandate: { select: { contractSignedAt: true, status: true } } } }),
    prisma.mandate.findMany({ where: { leadId: null, createdAt: { gte: from, lte: to } }, select: { contractSignedAt: true, status: true } }),
    prisma.mandate.findMany({ where: { createdAt: { gte: from, lte: to } }, select: { id: true, createdAt: true, status: true, referrerId: true, title: true, fee: true, closing: { select: { notaryDate: true, propertyId: true } } } }),
    prisma.mandateEvent.findMany({ where: { type: "STATUS_CHANGE" }, select: { mandateId: true, payload: true, createdAt: true } }),
    prisma.referrer.findMany({ include: { rewards: true } }),
    prisma.partner.findMany({ include: { ratings: true, sends: { select: { sentAt: true, repliedAt: true } }, properties: { select: { id: true, createdAt: true, _count: { select: { presentations: true } } } } } }),
  ]);

  const events: StatusEvent[] = statusEvents
    .map((e) => ({ mandateId: e.mandateId, from: (e.payload as { from?: MandateStatus }).from as MandateStatus, to: (e.payload as { to?: MandateStatus }).to as MandateStatus, at: e.createdAt }))
    .filter((e) => e.from && e.to);

  const funnel = funnelBySource(leads, mandatesNoLead);
  const totals = funnelTotals(funnel);
  const durations = statusDurations(mandates, events);
  const toPurchase = daysToPurchase(mandates, events);

  const leadsByMonth = new Map<string, number>();
  for (const l of leads) leadsByMonth.set(monthKey(l.createdAt), (leadsByMonth.get(monthKey(l.createdAt)) ?? 0) + 1);

  // Honorar je Monat: alle Käufe mit Kaufdatum im Zeitraum (unabhängig vom Anlagedatum des Auftrags)
  let fees: ReturnType<typeof feesByMonth> = [];
  let feeTotal = 0;
  const feeByMandate = new Map<string, number>();
  if (includeFees) {
    const bought = await prisma.mandate.findMany({ where: { status: { in: PURCHASED }, fee: { purchasePrice: { not: null } } }, include: { fee: true, closing: true, _count: { select: { trips: { where: { billable: true } } } } } });
    const items = bought
      .map((m) => {
        const ev = events.filter((e) => e.mandateId === m.id && e.to === "GEKAUFT").sort((a, b) => b.at.getTime() - a.at.getTime())[0];
        const date = m.closing?.notaryDate ?? ev?.at ?? m.fee!.updatedAt;
        const total = calculateFee({ ...m.fee!, askingPrice: m.fee!.askingPrice, purchasePrice: m.fee!.purchasePrice, trips: m._count.trips }).total;
        feeByMandate.set(m.id, total);
        return { date, total, invoicedAt: m.fee!.invoicedAt, paidAt: m.fee!.paidAt, referrerId: m.referrerId };
      })
      .filter((i) => inRange(i.date, from, to));
    fees = feesByMonth(items);
    feeTotal = items.reduce((s, i) => s + i.total, 0);
  }

  const referrerRows = referrers
    .map((r) => {
      const rl = leads.filter((l) => l.referrerId === r.id);
      const rm = mandates.filter((m) => m.referrerId === r.id);
      const purchases = rm.filter((m) => PURCHASED.includes(m.status));
      const rewardsInRange = r.rewards.filter((w) => inRange(w.createdAt, from, to));
      return {
        id: r.id,
        name: r.name,
        type: r.type,
        leads: rl.length,
        mandates: rm.length,
        purchases: purchases.length,
        rewardsOpen: rewardsInRange.filter((w) => !w.paidAt).reduce((s, w) => s + w.amount, 0),
        rewardsPaid: rewardsInRange.filter((w) => w.paidAt).reduce((s, w) => s + w.amount, 0),
        feeVolume: includeFees ? purchases.reduce((s, m) => s + (feeByMandate.get(m.id) ?? 0), 0) : null,
      };
    })
    .filter((r) => r.leads + r.mandates + r.rewardsOpen + r.rewardsPaid > 0)
    .sort((a, b) => b.purchases - a.purchases || b.mandates - a.mandates || b.leads - a.leads);

  const allClosings = await prisma.closing.findMany({ select: { propertyId: true, mandate: { select: { status: true } } } });
  const partnerRows = partners
    .map((p) => {
      const props = p.properties.filter((x) => inRange(x.createdAt, from, to));
      const propIds = new Set(p.properties.map((x) => x.id));
      const sends = p.sends.filter((s) => inRange(s.sentAt, from, to));
      const avg = averageRatings(p.ratings);
      return {
        id: p.id,
        name: p.name,
        country: p.country,
        submitted: props.length,
        presented: props.filter((x) => x._count.presentations > 0).length,
        purchases: allClosings.filter((c) => propIds.has(c.propertyId) && PURCHASED.includes(c.mandate.status)).length,
        sends: sends.length,
        replies: sends.filter((s) => s.repliedAt).length,
        rating: avg.score,
        ratings: avg.count,
      };
    })
    .filter((p) => p.submitted + p.sends + p.purchases + p.ratings > 0)
    .sort((a, b) => b.purchases - a.purchases || b.presented - a.presented || b.submitted - a.submitted);

  return {
    funnel,
    totals,
    durations,
    toPurchase,
    leadsByMonth: [...leadsByMonth.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([month, count]) => ({ month, count })),
    fees,
    feeTotal,
    referrerRows,
    partnerRows,
    counts: { leads: leads.length, mandates: mandates.length, purchases: mandates.filter((m) => PURCHASED.includes(m.status)).length },
  };
}

export function parseRange(sp: { from?: string; to?: string; preset?: string }, now: Date = new Date()): { from: Date; to: Date; label: string } {
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  if (sp.from || sp.to) {
    const from = sp.from ? new Date(sp.from) : new Date(2000, 0, 1);
    const to = sp.to ? new Date(`${sp.to}T23:59:59`) : end;
    return { from, to, label: `${from.toLocaleDateString("de-DE")} – ${to.toLocaleDateString("de-DE")}` };
  }
  if (sp.preset === "90") return { from: new Date(now.getTime() - 90 * 86400000), to: end, label: "letzte 90 Tage" };
  if (sp.preset === "alle") return { from: new Date(2000, 0, 1), to: end, label: "gesamter Zeitraum" };
  return { from: new Date(now.getFullYear(), 0, 1), to: end, label: `Jahr ${now.getFullYear()}` };
}
