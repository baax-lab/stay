import type { Report } from "@prisma/client";
import { REJECT_GROUPS, type MarketReportContent, type SearchReportContent } from "@/lib/reports";
import { fmtDate, fmtMoney, fmtNumber, t, type Lang } from "@/lib/i18n";

/** Suchbericht und Marktbericht – eine Darstellung für Vorschau, Portal und PDF. */
export function ReportView({ report, buyerName, lang }: { report: Report; buyerName: string; lang: Lang }) {
  const isSearch = report.kind === "SUCHBERICHT";
  const title = t(lang, isSearch ? "report.search_title" : "report.market_title");
  return (
    <article className="mx-auto max-w-3xl bg-surface text-ink" data-testid="report">
      <header className="border-b-4 border-brand pb-4">
        <div className="text-sm font-semibold text-brand-strong">{t(lang, "common.brand")}</div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-petrol">{title}</h1>
        <div className="mt-1 text-sm text-muted">
          {t(lang, "dossier.prepared_for")}: {buyerName}
          {report.periodStart && report.periodEnd ? ` · ${t(lang, "report.period")}: ${fmtDate(lang, report.periodStart)} – ${fmtDate(lang, report.periodEnd)}` : ` · ${t(lang, "dossier.created")}: ${fmtDate(lang, report.approvedAt ?? report.createdAt)}`}
        </div>
      </header>
      {isSearch ? <SearchBody c={report.content as SearchReportContent} lang={lang} /> : <MarketBody c={report.content as MarketReportContent} lang={lang} />}
      <footer className="mt-8 border-t border-line pt-3 text-[11px] text-muted">
        {t(lang, "common.brand")} · {t(lang, "common.tagline")} · {t(lang, "dossier.confidential")}
      </footer>
    </article>
  );
}

function H({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-2 mt-6 text-sm font-semibold uppercase tracking-wide text-petrol">{children}</h2>;
}

function SearchBody({ c, lang }: { c: SearchReportContent; lang: Lang }) {
  const rejectedCount = Object.values(c.rejected).reduce((n, l) => n + (l?.length ?? 0), 0);
  return (
    <>
      <H>{t(lang, "report.reviewed")}</H>
      <p className="text-sm">{t(lang, "report.reviewed_text", { count: c.reviewedCount })}</p>

      <H>{t(lang, "report.presented")}</H>
      {c.presented.length === 0 ? (
        <p className="text-sm text-muted">{t(lang, "report.none_presented")}</p>
      ) : (
        <ul className="space-y-1 text-sm">
          {c.presented.map((p) => (
            <li key={p.propertyId} className="flex justify-between gap-3">
              <span>
                {p.title} <span className="text-muted">· {p.locality}</span>
              </span>
              <span className="whitespace-nowrap">
                {fmtMoney(lang, p.price)} <span className="text-xs text-muted">{fmtDate(lang, p.sentAt)}</span>
              </span>
            </li>
          ))}
        </ul>
      )}

      <H>
        {t(lang, "report.rejected")} ({rejectedCount})
      </H>
      {rejectedCount === 0 ? (
        <p className="text-sm text-muted">{t(lang, "report.none_rejected")}</p>
      ) : (
        <>
          <p className="mb-3 text-sm text-muted">{t(lang, "report.rejected_intro")}</p>
          {REJECT_GROUPS.filter((g) => c.rejected[g]?.length).map((g) => (
            <div key={g} className="mb-3" data-testid={`rejected-${g}`}>
              <h3 className="text-sm font-semibold text-ink">
                {t(lang, `report.group_${g}`)} ({c.rejected[g]!.length})
              </h3>
              <ul className="mt-1 space-y-1 text-sm">
                {c.rejected[g]!.map((e) => (
                  <li key={e.propertyId + e.reason} className="rounded-lg bg-canvas px-3 py-1.5">
                    <div className="flex justify-between gap-3">
                      <span>
                        {e.title} <span className="text-muted">· {e.locality}</span>
                      </span>
                      <span className="whitespace-nowrap">{fmtMoney(lang, e.price)}</span>
                    </div>
                    <div className="text-xs text-muted">
                      {e.reason || "–"} · {t(lang, e.by === "kaeufer" ? "report.by_buyer" : "report.by_baax")}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </>
      )}

      {c.marketNote && (
        <>
          <H>{t(lang, "report.market_note")}</H>
          <p className="whitespace-pre-wrap text-sm">{c.marketNote}</p>
        </>
      )}
      {c.nextSteps && (
        <>
          <H>{t(lang, "report.next_steps")}</H>
          <p className="whitespace-pre-wrap text-sm">{c.nextSteps}</p>
        </>
      )}
    </>
  );
}

function MarketBody({ c, lang }: { c: MarketReportContent; lang: Lang }) {
  return (
    <>
      {c.intro && <p className="mt-5 whitespace-pre-wrap text-sm">{c.intro}</p>}
      {c.regions.map((r) => (
        <section key={r.key} className="mt-6 rounded-2xl border border-line p-4 print:break-inside-avoid">
          <h2 className="text-lg font-semibold text-petrol">
            {r.name} <span className="text-sm font-normal text-muted">{r.country}</span>
          </h2>
          <dl className="mt-2 space-y-3 text-sm">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-muted">{t(lang, "report.rental_rules")}</dt>
              <dd>{r.licenseRule || <span className="text-muted">{t(lang, "report.no_rule")}</span>}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-muted">{t(lang, "report.side_costs")}</dt>
              <dd>
                {r.costs.length === 0 ? (
                  <span className="text-muted">{t(lang, "report.no_rule")}</span>
                ) : (
                  <ul>
                    {r.costs.map((x) => (
                      <li key={x.label}>
                        {x.label}: {x.pct != null ? `${fmtNumber(lang, x.pct, 1)} %` : ""}
                        {x.flat != null ? ` ${fmtMoney(lang, x.flat)}` : ""}
                        {x.note ? <span className="text-xs text-muted"> ({x.note})</span> : null}
                      </li>
                    ))}
                  </ul>
                )}
              </dd>
            </div>
            {r.priceLevel && (
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-muted">{t(lang, "report.price_level")}</dt>
                <dd className="whitespace-pre-wrap">{r.priceLevel}</dd>
              </div>
            )}
            {r.occupancy && (
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-muted">{t(lang, "report.occupancy")}</dt>
                <dd className="whitespace-pre-wrap">{r.occupancy}</dd>
              </div>
            )}
            {r.risks && (
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-muted">{t(lang, "report.risks")}</dt>
                <dd className="whitespace-pre-wrap">{r.risks}</dd>
              </div>
            )}
          </dl>
        </section>
      ))}
      {c.conclusion && (
        <>
          <H>{t(lang, "report.conclusion")}</H>
          <p className="whitespace-pre-wrap text-sm">{c.conclusion}</p>
        </>
      )}
      <p className="mt-4 text-xs text-muted">{t(lang, "costs.disclaimer")}</p>
    </>
  );
}
