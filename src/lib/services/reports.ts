import "server-only";
import type { Report } from "@prisma/client";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { selectCostRules } from "@/lib/costs";
import { groupRejected, knowledgeToMarket, rejectGroup, type MarketReportContent, type RejectedEntry, type SearchReportContent } from "@/lib/reports";
import { BUYER_REJECT_REASONS } from "@/lib/portal";
import { ACTIVE_STATUSES } from "@/lib/mandates";
import { t } from "@/lib/i18n";
import { logEvent } from "./events";
import { draftReportNotification } from "./notifications";

type User = { id: string; name?: string };

/** Suchbericht (Konzept §9.6): gesichtet, vorgestellt, aussortiert mit Grund, Marktbeobachtung, nächste Schritte. */
export async function buildSearchReport(mandateId: string, start: Date, end: Date, keep?: Partial<SearchReportContent>): Promise<SearchReportContent> {
  const mandate = await prisma.mandate.findUniqueOrThrow({ where: { id: mandateId }, include: { profile: true } });
  const countries = mandate.profile?.countries ?? [];
  const reviewedCount = await prisma.property.count({ where: { createdAt: { gte: start, lte: end }, ...(countries.length ? { country: { in: countries } } : {}) } });

  const presentations = await prisma.presentation.findMany({ where: { mandateId, sentAt: { gte: start, lte: end } }, include: { property: true }, orderBy: { sentAt: "asc" } });
  const rejectedMatches = await prisma.match.findMany({
    where: {
      mandateId,
      OR: [
        { status: { in: ["ABGELEHNT", "GESCHLOSSEN"] }, updatedAt: { gte: start, lte: end } },
        { buyerAction: "ABGELEHNT", buyerActionAt: { gte: start, lte: end } },
      ],
    },
    include: { property: true },
  });

  const rejected: RejectedEntry[] = rejectedMatches.map((m) => {
    const byBuyer = m.buyerAction === "ABGELEHNT";
    const reason = byBuyer ? [m.buyerReasonCategory ? t("de", `reject_reasons.${m.buyerReasonCategory}`) : null, m.buyerReasonText].filter(Boolean).join(": ") : (m.rejectReason ?? "");
    return {
      propertyId: m.propertyId,
      title: m.property.title,
      locality: m.property.locality ?? m.property.region,
      price: m.property.price,
      reason,
      by: byBuyer ? "kaeufer" : "baax",
      group: rejectGroup(m.rejectReason, byBuyer ? m.buyerReasonCategory : null),
    };
  });

  return {
    reviewedCount,
    presented: presentations.map((p) => ({ propertyId: p.propertyId, title: p.property.title, locality: p.property.locality ?? p.property.region, price: p.askingPrice, sentAt: p.sentAt.toISOString() })),
    rejected: groupRejected(rejected),
    marketNote: keep?.marketNote ?? "",
    nextSteps: keep?.nextSteps ?? "",
  };
}

export async function createSearchReportDraft(mandateId: string, start: Date, end: Date, user: User): Promise<Report> {
  const content = await buildSearchReport(mandateId, start, end);
  const r = await prisma.report.create({
    data: { mandateId, kind: "SUCHBERICHT", title: `Suchbericht ${start.toLocaleDateString("de-DE", { month: "long", year: "numeric" })}`, periodStart: start, periodEnd: end, content, createdById: user.id },
  });
  await logEvent(mandateId, "REPORT", { reportId: r.id, kind: r.kind, action: "Entwurf erstellt" }, user);
  return r;
}

/** Marktbericht (Konzept §9.7) je Zielregion: Vermietungsregeln, Nebenkosten, Preisniveau, Auslastung, Risiken. */
export async function buildMarketReport(mandateId: string, keep?: MarketReportContent): Promise<MarketReportContent> {
  const mandate = await prisma.mandate.findUniqueOrThrow({ where: { id: mandateId }, include: { profile: true } });
  const keys = mandate.profile?.regions ?? [];
  const regions = keys.length
    ? await prisma.region.findMany({ where: { key: { in: keys } }, orderBy: { name: "asc" } })
    : await prisma.region.findMany({ where: { country: { in: mandate.profile?.countries ?? [] }, focus: true }, orderBy: { name: "asc" } });
  const rules = await prisma.countryCost.findMany({ where: { country: { in: Array.from(new Set(regions.map((r) => r.country))) } } });
  return {
    intro: keep?.intro ?? "",
    conclusion: keep?.conclusion ?? "",
    regions: regions.map((r) => {
      const prev = keep?.regions.find((x) => x.key === r.key);
      const k = knowledgeToMarket(r);
      return {
        key: r.key,
        name: r.name,
        country: r.country,
        licenseRule: r.rentalRules || r.licenseRule,
        secondHomeRules: r.secondHomeRules,
        taxNote: r.taxNote,
        costs: selectCostRules(rules, r.country, r.key).map((c) => ({ label: c.label, pct: c.pct, flat: c.flat, note: c.note ?? null })),
        priceLevel: prev?.priceLevel || k.priceLevel,
        occupancy: prev?.occupancy || k.occupancy,
        risks: prev?.risks || k.risks,
      };
    }),
  };
}

export async function createMarketReportDraft(mandateId: string, user: User): Promise<Report> {
  const content = await buildMarketReport(mandateId);
  const r = await prisma.report.create({ data: { mandateId, kind: "MARKTBERICHT", title: `Marktbericht ${new Date().toLocaleDateString("de-DE")}`, content, createdById: user.id } });
  await logEvent(mandateId, "REPORT", { reportId: r.id, kind: r.kind, action: "Entwurf erstellt" }, user);
  return r;
}

/** Berechnete Teile neu laden, Freitexte behalten (nur im Entwurf). */
export async function refreshReport(id: string): Promise<Report> {
  const r = await prisma.report.findUniqueOrThrow({ where: { id } });
  if (r.status !== "ENTWURF") return r;
  const content =
    r.kind === "SUCHBERICHT"
      ? await buildSearchReport(r.mandateId, r.periodStart!, r.periodEnd!, r.content as SearchReportContent)
      : await buildMarketReport(r.mandateId, r.content as MarketReportContent);
  return prisma.report.update({ where: { id }, data: { content } });
}

/** Freigabe: im Portal sichtbar; Mail-Entwurf an den Käufer, auf Wunsch direkt gesendet. */
export async function approveReport(id: string, user: User): Promise<{ report: Report; notificationId: string }> {
  const r = await prisma.report.update({ where: { id }, data: { status: "FREIGEGEBEN", approvedById: user.id, approvedAt: new Date() } });
  const n = await draftReportNotification(r.mandateId, r.id);
  await logEvent(r.mandateId, "REPORT", { reportId: r.id, kind: r.kind, action: "freigegeben" }, user);
  await audit({ userId: user.id, action: "REPORT_UPDATE", entity: "Report", entityId: id, meta: { approved: true } });
  return { report: r, notificationId: n.id };
}

/** Cron am Monatsersten: Suchbericht-Entwürfe für den Vormonat je aktivem Suchauftrag. */
export async function createMonthlyDrafts(start: Date, end: Date): Promise<number> {
  const mandates = await prisma.mandate.findMany({ where: { status: { in: ACTIVE_STATUSES } }, select: { id: true } });
  let n = 0;
  for (const m of mandates) {
    const exists = await prisma.report.findFirst({ where: { mandateId: m.id, kind: "SUCHBERICHT", periodStart: start } });
    if (exists) continue;
    await createSearchReportDraft(m.id, start, end, { id: "cron", name: "System" });
    n++;
  }
  return n;
}

export { BUYER_REJECT_REASONS };
