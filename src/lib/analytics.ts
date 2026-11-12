import type { LeadSource, MandateStatus } from "@prisma/client";

/**
 * Auswertung (Konzept §10, Phase 3): Quelle → Lead → Auftrag → Kauf, Dauer je Status,
 * Honorar je Monat, Leistung je Referrer und Partner. Reine Funktionen, testbar.
 */

export const PURCHASED: MandateStatus[] = ["GEKAUFT", "NACHBETREUUNG", "ABGESCHLOSSEN"];
const DAY = 86_400_000;

export type FunnelRow = { source: LeadSource | "OHNE_LEAD"; leads: number; interviews: number; mandates: number; purchases: number };

/** Trichter je Quelle. Erstgespräch: Lead im Status Erstgespräch/umgewandelt oder Suchauftrag vorhanden; Auftrag: unterschrieben; Kauf: gekauft oder später. */
export function funnelBySource(
  leads: Array<{ source: LeadSource; status: string; mandate: { contractSignedAt: Date | null; status: MandateStatus } | null }>,
  mandatesWithoutLead: Array<{ contractSignedAt: Date | null; status: MandateStatus }> = [],
): FunnelRow[] {
  const rows = new Map<FunnelRow["source"], FunnelRow>();
  const row = (source: FunnelRow["source"]) => {
    if (!rows.has(source)) rows.set(source, { source, leads: 0, interviews: 0, mandates: 0, purchases: 0 });
    return rows.get(source)!;
  };
  for (const l of leads) {
    const r = row(l.source);
    r.leads++;
    if (l.mandate || l.status === "ERSTGESPRAECH" || l.status === "UMGEWANDELT") r.interviews++;
    if (l.mandate?.contractSignedAt) r.mandates++;
    if (l.mandate && PURCHASED.includes(l.mandate.status)) r.purchases++;
  }
  for (const m of mandatesWithoutLead) {
    const r = row("OHNE_LEAD");
    r.interviews++;
    if (m.contractSignedAt) r.mandates++;
    if (PURCHASED.includes(m.status)) r.purchases++;
  }
  return [...rows.values()].sort((a, b) => b.leads + b.interviews - (a.leads + a.interviews));
}

export function funnelTotals(rows: FunnelRow[]): FunnelRow & { rateInterview: number | null; rateMandate: number | null; ratePurchase: number | null } {
  const t = rows.reduce((s, r) => ({ ...s, leads: s.leads + r.leads, interviews: s.interviews + r.interviews, mandates: s.mandates + r.mandates, purchases: s.purchases + r.purchases }), { source: "OHNE_LEAD" as const, leads: 0, interviews: 0, mandates: 0, purchases: 0 });
  const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : null);
  return { ...t, rateInterview: pct(t.interviews, t.leads), rateMandate: pct(t.mandates, t.interviews), ratePurchase: pct(t.purchases, t.mandates) };
}

export type StatusEvent = { mandateId: string; from: MandateStatus; to: MandateStatus; at: Date };
export type StatusDuration = { status: MandateStatus; closed: number; avgDays: number | null; medianDays: number | null; current: number; currentAvgDays: number | null };

function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
const r1 = (n: number | null) => (n == null ? null : Math.round(n * 10) / 10);

/** Dauer je Status aus den Statuswechseln; jeder Suchauftrag beginnt im Erstgespräch bei Anlage. */
export function statusDurations(mandates: Array<{ id: string; createdAt: Date; status: MandateStatus }>, events: StatusEvent[], now: Date = new Date()): StatusDuration[] {
  const closed = new Map<MandateStatus, number[]>();
  const open = new Map<MandateStatus, number[]>();
  const push = (m: Map<MandateStatus, number[]>, s: MandateStatus, d: number) => m.set(s, [...(m.get(s) ?? []), d]);
  const byMandate = new Map<string, StatusEvent[]>();
  for (const e of events) byMandate.set(e.mandateId, [...(byMandate.get(e.mandateId) ?? []), e]);

  for (const m of mandates) {
    const evs = (byMandate.get(m.id) ?? []).sort((a, b) => a.at.getTime() - b.at.getTime());
    let status: MandateStatus = "ERSTGESPRAECH";
    let since = m.createdAt;
    for (const e of evs) {
      push(closed, e.from ?? status, Math.max(0, (e.at.getTime() - since.getTime()) / DAY));
      status = e.to;
      since = e.at;
    }
    if (status !== "ABGESCHLOSSEN" && status !== "BEENDET_OHNE_KAUF") push(open, status, Math.max(0, (now.getTime() - since.getTime()) / DAY));
  }
  const order: MandateStatus[] = ["ERSTGESPRAECH", "BEAUFTRAGT", "ANALYSE", "SUCHE", "PRUEFUNG", "VERHANDLUNG", "GEKAUFT", "NACHBETREUUNG", "PAUSIERT"];
  return order.map((status) => {
    const c = closed.get(status) ?? [];
    const o = open.get(status) ?? [];
    return {
      status,
      closed: c.length,
      avgDays: r1(c.length ? c.reduce((a, b) => a + b, 0) / c.length : null),
      medianDays: r1(median(c)),
      current: o.length,
      currentAvgDays: r1(o.length ? o.reduce((a, b) => a + b, 0) / o.length : null),
    };
  });
}

/** Gesamtdauer bis zum Kauf (Anlage bis Statuswechsel auf Gekauft). */
export function daysToPurchase(mandates: Array<{ id: string; createdAt: Date }>, events: StatusEvent[]): { count: number; avgDays: number | null; medianDays: number | null } {
  const ds: number[] = [];
  for (const m of mandates) {
    const e = events.filter((x) => x.mandateId === m.id && x.to === "GEKAUFT").sort((a, b) => a.at.getTime() - b.at.getTime())[0];
    if (e) ds.push((e.at.getTime() - m.createdAt.getTime()) / DAY);
  }
  return { count: ds.length, avgDays: r1(ds.length ? ds.reduce((a, b) => a + b, 0) / ds.length : null), medianDays: r1(median(ds)) };
}

export type FeeMonth = { month: string; count: number; total: number; invoiced: number; paid: number };

export function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Honorar je Monat nach Kaufdatum; Rechnung und Zahlung getrennt ausgewiesen. */
export function feesByMonth(items: Array<{ date: Date; total: number; invoicedAt: Date | null; paidAt: Date | null }>): FeeMonth[] {
  const map = new Map<string, FeeMonth>();
  for (const i of items) {
    const k = monthKey(i.date);
    const m = map.get(k) ?? { month: k, count: 0, total: 0, invoiced: 0, paid: 0 };
    m.count++;
    m.total += i.total;
    if (i.invoicedAt) m.invoiced += i.total;
    if (i.paidAt) m.paid += i.total;
    map.set(k, m);
  }
  return [...map.values()].sort((a, b) => a.month.localeCompare(b.month));
}

export function inRange(d: Date | null | undefined, from: Date, to: Date): boolean {
  return Boolean(d && d >= from && d <= to);
}

/** Wissensstand: ungeprüft oder älter als `maxDays` gilt als veraltet. */
export function isStale(reviewedAt: Date | null | undefined, now: Date = new Date(), maxDays = 365): boolean {
  return !reviewedAt || now.getTime() - reviewedAt.getTime() > maxDays * DAY;
}

/** Kennzahlen aus eigenen Objektdaten einer Region. */
export function regionStats(props: Array<{ price: number; livingArea: number | null; occupancyPct: number | null; adr: number | null }>) {
  const prices = props.map((p) => p.price);
  const sqm = props.filter((p) => p.livingArea && p.livingArea > 0).map((p) => p.price / p.livingArea!);
  const occ = props.map((p) => p.occupancyPct).filter((x): x is number => x != null);
  const adr = props.map((p) => p.adr).filter((x): x is number => x != null);
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
  const round = (n: number | null) => (n == null ? null : Math.round(n));
  return { count: props.length, medianPrice: round(median(prices)), medianPricePerSqm: round(median(sqm)), avgOccupancy: r1(avg(occ)), avgAdr: round(avg(adr)) };
}
