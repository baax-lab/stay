import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import { LEAD_SOURCE_LABEL } from "@/lib/labels";
import { MANDATE_STATUS_LABEL } from "@/lib/mandates";
import { formatEur } from "@/lib/fees";
import { loadAnalytics, parseRange } from "@/lib/services/analytics";
import { Card, CardTitle, PageHeader } from "@/components/ui/card";
import { Table, Td, Th } from "@/components/ui/table";
import { REFERRER_TYPE_LABEL } from "@/components/partners/referrer-form";

export const metadata = { title: "Auswertung" };

type Search = { from?: string; to?: string; preset?: string };

const pct = (a: number, b: number) => (b > 0 ? `${Math.round((a / b) * 100)} %` : "–");
const days = (n: number | null) => (n == null ? "–" : `${n.toLocaleString("de-DE")} Tage`);

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const user = await requireUser();
  if (!can.viewAnalytics(user.role)) redirect("/");
  const sp = await searchParams;
  const range = parseRange(sp);
  const showFees = can.viewFees(user.role);
  const a = await loadAnalytics(range.from, range.to, showFees);
  if (showFees) await audit({ userId: user.id, action: "FEE_VIEW", entity: "Auswertung", meta: { from: range.from.toISOString(), to: range.to.toISOString() } });
  const qs = new URLSearchParams(Object.entries(sp).filter(([, v]) => v) as [string, string][]).toString();
  const exp = (section: string) => `/auswertung/export?section=${section}${qs ? `&${qs}` : ""}`;
  const canExport = can.exportLeads(user.role);

  return (
    <div>
      <PageHeader title="Auswertung" subtitle={`Zeitraum: ${range.label}`} />
      <form action="/auswertung" className="mb-6 flex flex-wrap items-end gap-2 text-sm">
        {(
          [
            ["", "laufendes Jahr"],
            ["90", "90 Tage"],
            ["alle", "gesamt"],
          ] as const
        ).map(([v, label]) => (
          <Link key={v} href={v ? `/auswertung?preset=${v}` : "/auswertung"} className={`rounded-full px-3 py-1.5 ${(sp.preset ?? "") === v && !sp.from && !sp.to ? "bg-brand text-petrol" : "border border-line bg-surface"}`}>
            {label}
          </Link>
        ))}
        <label className="ml-2 text-xs text-muted">
          von <input type="date" name="from" defaultValue={sp.from ?? ""} className="ml-1 h-9 rounded-full border border-line bg-surface px-3" />
        </label>
        <label className="text-xs text-muted">
          bis <input type="date" name="to" defaultValue={sp.to ?? ""} className="ml-1 h-9 rounded-full border border-line bg-surface px-3" />
        </label>
        <button className="h-9 rounded-full border border-line bg-surface px-4 font-medium text-petrol">Anwenden</button>
      </form>

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["Leads", String(a.totals.leads)],
          ["Suchaufträge (angelegt)", String(a.counts.mandates)],
          ["Käufe", String(a.counts.purchases)],
          showFees ? ["Honorar (Kaufdatum im Zeitraum)", formatEur(a.feeTotal)] : ["Ø Dauer bis Kauf", days(a.toPurchase.avgDays)],
        ].map(([k, v]) => (
          <div key={k} className="rounded-2xl border border-line bg-surface p-4">
            <div className="text-xs font-medium uppercase tracking-wide text-muted">{k}</div>
            <div className="mt-1 text-2xl font-semibold text-petrol">{v}</div>
          </div>
        ))}
      </div>

      <div className="space-y-4">
        <Card>
          <CardTitle action={canExport ? <a href={exp("funnel")} className="text-xs text-brand-strong">CSV</a> : undefined}>Quelle → Lead → Erstgespräch → Auftrag → Kauf</CardTitle>
          <Table>
            <thead>
              <tr>
                <Th>Quelle</Th>
                <Th>Leads</Th>
                <Th>Erstgespräch</Th>
                <Th>Auftrag</Th>
                <Th>Kauf</Th>
                <Th>Lead → Auftrag</Th>
              </tr>
            </thead>
            <tbody data-testid="funnel-table">
              {a.funnel.map((r) => (
                <tr key={r.source}>
                  <Td>{r.source === "OHNE_LEAD" ? "ohne Lead (Bestand)" : LEAD_SOURCE_LABEL[r.source]}</Td>
                  <Td>{r.leads}</Td>
                  <Td>{r.interviews}</Td>
                  <Td>{r.mandates}</Td>
                  <Td>{r.purchases}</Td>
                  <Td>{r.source === "OHNE_LEAD" ? "–" : pct(r.mandates, r.leads)}</Td>
                </tr>
              ))}
              <tr className="font-semibold text-petrol">
                <Td>Gesamt</Td>
                <Td>{a.totals.leads}</Td>
                <Td>
                  {a.totals.interviews} <span className="text-xs font-normal text-muted">({a.totals.rateInterview ?? "–"} %)</span>
                </Td>
                <Td>
                  {a.totals.mandates} <span className="text-xs font-normal text-muted">({a.totals.rateMandate ?? "–"} %)</span>
                </Td>
                <Td>
                  {a.totals.purchases} <span className="text-xs font-normal text-muted">({a.totals.ratePurchase ?? "–"} %)</span>
                </Td>
                <Td />
              </tr>
            </tbody>
          </Table>
          <p className="mt-2 text-xs text-muted">Leads mit Erfassung im Zeitraum. Prozentwerte jeweils zur Vorstufe. Erstgespräch: Lead im Status Erstgespräch/umgewandelt oder Suchauftrag vorhanden; Auftrag: unterschrieben.</p>
          {a.leadsByMonth.length > 0 && (
            <p className="mt-2 text-xs text-muted">
              Leads je Monat: {a.leadsByMonth.map((m) => `${m.month}: ${m.count}`).join(" · ")}
            </p>
          )}
        </Card>

        <Card>
          <CardTitle action={canExport ? <a href={exp("status")} className="text-xs text-brand-strong">CSV</a> : undefined}>Dauer je Status</CardTitle>
          <Table>
            <thead>
              <tr>
                <Th>Status</Th>
                <Th>Abgeschlossene Phasen</Th>
                <Th>Ø Dauer</Th>
                <Th>Median</Th>
                <Th>Aktuell in diesem Status</Th>
                <Th>Ø bisher</Th>
              </tr>
            </thead>
            <tbody data-testid="status-table">
              {a.durations.map((d) => (
                <tr key={d.status}>
                  <Td>{MANDATE_STATUS_LABEL[d.status]}</Td>
                  <Td>{d.closed}</Td>
                  <Td>{days(d.avgDays)}</Td>
                  <Td>{days(d.medianDays)}</Td>
                  <Td>{d.current}</Td>
                  <Td>{days(d.currentAvgDays)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
          <p className="mt-2 text-xs text-muted">
            Suchaufträge mit Anlage im Zeitraum. Dauer von Anlage bis Kauf: Ø {days(a.toPurchase.avgDays)}, Median {days(a.toPurchase.medianDays)} ({a.toPurchase.count} Käufe).
          </p>
        </Card>

        {showFees && (
          <Card>
            <CardTitle action={canExport ? <a href={exp("honorar")} className="text-xs text-brand-strong">CSV</a> : undefined}>Honorar je Monat</CardTitle>
            <Table>
              <thead>
                <tr>
                  <Th>Monat</Th>
                  <Th>Käufe</Th>
                  <Th>Honorar gesamt</Th>
                  <Th>davon in Rechnung</Th>
                  <Th>davon bezahlt</Th>
                </tr>
              </thead>
              <tbody data-testid="fee-table">
                {a.fees.map((f) => (
                  <tr key={f.month}>
                    <Td>{f.month}</Td>
                    <Td>{f.count}</Td>
                    <Td>{formatEur(f.total)}</Td>
                    <Td>{formatEur(f.invoiced)}</Td>
                    <Td>{formatEur(f.paid)}</Td>
                  </tr>
                ))}
                {a.fees.length === 0 && (
                  <tr>
                    <Td className="text-muted" {...{ colSpan: 5 }}>
                      Keine Käufe im Zeitraum.
                    </Td>
                  </tr>
                )}
              </tbody>
            </Table>
            <p className="mt-2 text-xs text-muted">Nach Beurkundung bzw. Statuswechsel auf „Gekauft“; netto inkl. Bonus und Reisepauschale, abzüglich angerechneter Verkäuferprovision.</p>
          </Card>
        )}

        <Card>
          <CardTitle action={canExport ? <a href={exp("referrer")} className="text-xs text-brand-strong">CSV</a> : undefined}>Leistung je Tippgeber, Agentur, Multiplikator</CardTitle>
          <Table>
            <thead>
              <tr>
                <Th>Name</Th>
                <Th>Art</Th>
                <Th>Leads</Th>
                <Th>Aufträge</Th>
                <Th>Käufe</Th>
                {showFees && <Th>Honorarvolumen</Th>}
                {can.viewRewards(user.role) && <Th>Prämien offen / bezahlt</Th>}
              </tr>
            </thead>
            <tbody data-testid="referrer-table">
              {a.referrerRows.map((r) => (
                <tr key={r.id}>
                  <Td>
                    <Link href={`/tippgeber/${r.id}`} className="text-petrol hover:underline">
                      {r.name}
                    </Link>
                  </Td>
                  <Td>{REFERRER_TYPE_LABEL[r.type]}</Td>
                  <Td>{r.leads}</Td>
                  <Td>{r.mandates}</Td>
                  <Td>{r.purchases}</Td>
                  {showFees && <Td>{formatEur(r.feeVolume)}</Td>}
                  {can.viewRewards(user.role) && (
                    <Td>
                      {formatEur(r.rewardsOpen)} / {formatEur(r.rewardsPaid)}
                    </Td>
                  )}
                </tr>
              ))}
              {a.referrerRows.length === 0 && (
                <tr>
                  <Td className="text-muted" {...{ colSpan: 7 }}>
                    Keine Aktivität im Zeitraum.
                  </Td>
                </tr>
              )}
            </tbody>
          </Table>
        </Card>

        <Card>
          <CardTitle action={canExport ? <a href={exp("partner")} className="text-xs text-brand-strong">CSV</a> : undefined}>Leistung je Partner</CardTitle>
          <Table>
            <thead>
              <tr>
                <Th>Partner</Th>
                <Th>Land</Th>
                <Th>Eingereicht</Th>
                <Th>Vorgestellt</Th>
                <Th>Käufe</Th>
                <Th>Profile / Rückmeldungen</Th>
                <Th>Bewertung</Th>
              </tr>
            </thead>
            <tbody data-testid="partner-table">
              {a.partnerRows.map((p) => (
                <tr key={p.id}>
                  <Td>
                    <Link href={`/partner/${p.id}`} className="text-petrol hover:underline">
                      {p.name}
                    </Link>
                  </Td>
                  <Td>{p.country}</Td>
                  <Td>{p.submitted}</Td>
                  <Td>
                    {p.presented} <span className="text-xs text-muted">({pct(p.presented, p.submitted)})</span>
                  </Td>
                  <Td>{p.purchases}</Td>
                  <Td>
                    {p.sends} / {p.replies}
                  </Td>
                  <Td>{p.rating != null ? `${p.rating.toLocaleString("de-DE")} (${p.ratings})` : "–"}</Td>
                </tr>
              ))}
              {a.partnerRows.length === 0 && (
                <tr>
                  <Td className="text-muted" {...{ colSpan: 7 }}>
                    Keine Aktivität im Zeitraum.
                  </Td>
                </tr>
              )}
            </tbody>
          </Table>
        </Card>
      </div>
    </div>
  );
}
