import Link from "next/link";
import { prisma } from "@/lib/db";
import { MAIN_FLOW } from "@/lib/mandates";
import { fmtDate, fmtMoney, fmtNumber, t } from "@/lib/i18n";
import { propertyFigures } from "@/lib/services/figures";
import { releasedObjects } from "@/lib/services/portal";
import { enterPortal } from "@/lib/services/portal-page";
import { PortalShell, PortalUnavailable } from "@/components/portal/portal-shell";
import { LIGHT_COLOR } from "@/components/figures/figures-view";
import { cn } from "@/lib/cn";

export const metadata = { title: "Käuferportal", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function PortalPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ lang?: string }> }) {
  const { token } = await params;
  const { lang: langParam } = await searchParams;
  const { r, lang } = await enterPortal(token, langParam, "overview");
  if (r.state !== "valid") {
    return <PortalUnavailable token={token} lang={lang} state={r.state} contact={r.state !== "unknown" ? { name: r.mandate.ownerName, phone: r.mandate.ownerPhone, email: r.mandate.ownerEmail } : undefined} />;
  }
  const m = r.mandate;
  const [objects, reports] = await Promise.all([
    releasedObjects(m.id),
    prisma.report.findMany({ where: { mandateId: m.id, status: "FREIGEGEBEN" }, orderBy: { approvedAt: "desc" } }),
  ]);
  const withFigures = await Promise.all(objects.map(async (o) => ({ ...o, figures: await propertyFigures(o.property, m.id) })));
  const active = withFigures.filter((o) => o.match?.buyerAction !== "ABGELEHNT");
  const declined = withFigures.filter((o) => o.match?.buyerAction === "ABGELEHNT");
  const currentIdx = MAIN_FLOW.indexOf(m.status === "PAUSIERT" ? (m.statusBeforePause ?? "SUCHE") : m.status);
  const q = `?lang=${lang}`;

  return (
    <PortalShell token={token} lang={lang}>
      <h1 className="text-2xl font-semibold tracking-tight text-petrol">{t(lang, "portal.hello", { name: m.buyerName })}</h1>
      <p className="mt-1 text-sm text-muted">
        {t(lang, "portal.title")}: {m.title} · {t(lang, "portal.valid_until", { date: fmtDate(lang, r.access.expiresAt) })}
      </p>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_300px]">
        <section className="rounded-2xl border border-line bg-surface p-5" data-testid="portal-timeline">
          <h2 className="mb-4 font-semibold text-petrol">{t(lang, "portal.timeline")}</h2>
          <ol className="grid gap-2 sm:grid-cols-3 lg:grid-cols-3">
            {MAIN_FLOW.slice(0, 8).map((s, i) => (
              <li key={s} className={cn("flex items-center gap-2 rounded-xl px-3 py-2 text-sm", i < currentIdx && "bg-ok-soft text-ok", i === currentIdx && "bg-brand font-semibold text-petrol", i > currentIdx && "bg-canvas text-muted")} aria-current={i === currentIdx ? "step" : undefined}>
                <span className="grid h-5 w-5 place-items-center rounded-full bg-white/60 text-xs">{i < currentIdx ? "✓" : i + 1}</span>
                {t(lang, `status.${s}`)}
              </li>
            ))}
          </ol>
          {(m.status === "PAUSIERT" || m.status === "BEENDET_OHNE_KAUF") && <p className="mt-3 text-sm font-medium text-warn">{t(lang, `status.${m.status}`)}</p>}
          <h3 className="mb-1 mt-5 text-sm font-semibold text-petrol">{t(lang, "portal.next_steps")}</h3>
          <p className="whitespace-pre-wrap text-sm" data-testid="portal-next-steps">
            {m.portalNextSteps || t(lang, `next_steps.${m.status}`)}
          </p>
        </section>

        <aside className="rounded-2xl border border-line bg-surface p-5">
          <h2 className="mb-3 font-semibold text-petrol">{t(lang, "common.contact")}</h2>
          <div className="flex items-center gap-3">
            {m.ownerPhotoFileId ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`/portal/${token}/foto/${m.ownerPhotoFileId}`} alt="" className="h-16 w-16 rounded-full object-cover" />
            ) : (
              <span className="grid h-16 w-16 place-items-center rounded-full bg-brand text-xl font-semibold text-petrol">{(m.ownerName ?? "B").slice(0, 1)}</span>
            )}
            <div className="text-sm">
              <div className="font-medium text-petrol">{m.ownerName ?? t(lang, "common.brand")}</div>
              {m.ownerPhone && (
                <a href={`tel:${m.ownerPhone}`} className="block underline">
                  {m.ownerPhone}
                </a>
              )}
              {m.ownerEmail && (
                <a href={`mailto:${m.ownerEmail}`} className="block break-all underline">
                  {m.ownerEmail}
                </a>
              )}
            </div>
          </div>
        </aside>
      </div>

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-semibold text-petrol">{t(lang, "portal.objects")}</h2>
        {active.length === 0 && <p className="rounded-2xl border border-dashed border-line p-6 text-center text-sm text-muted">{t(lang, "portal.no_objects")}</p>}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {active.map(({ property: p, match, figures: f }) => {
            const cover = (p.photos as string[])[0];
            const unavailable = match?.status === "GESCHLOSSEN" || p.availability === "VERKAUFT" || p.availability === "ZURUECKGEZOGEN";
            const range = f.yield.ok ? `${fmtNumber(lang, f.yield.scenarios[0].yieldPct, 1)} – ${fmtNumber(lang, f.yield.scenarios[2].yieldPct, 1)} %` : null;
            return (
              <Link key={p.id} href={`/portal/${token}/objekt/${p.id}${q}`} className={cn("overflow-hidden rounded-2xl border border-line bg-surface transition hover:border-brand", unavailable && "opacity-60")} data-testid="portal-object">
                {cover ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={`/portal/${token}/foto/${cover}`} alt="" className="aspect-[4/3] w-full object-cover" />
                ) : (
                  <div className="grid aspect-[4/3] w-full place-items-center bg-brand-soft text-sm text-petrol">{t(lang, `segment.${p.segment}`)}</div>
                )}
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-medium text-petrol">{(lang === "en" && p.titleEn) || p.title}</h3>
                    <span className={cn("mt-1 inline-block h-3 w-3 shrink-0 rounded-full", LIGHT_COLOR[f.light.light])} title={t(lang, f.light.reasonKey)} />
                  </div>
                  <div className="text-xs text-muted">
                    {[p.locality, f.regionName].filter(Boolean).join(", ")} · {t(lang, `segment.${p.segment}`)}
                  </div>
                  <div className="mt-2 text-lg font-semibold text-petrol">{fmtMoney(lang, p.price, p.currency)}</div>
                  <dl className="mt-1 space-y-0.5 text-xs">
                    {f.costs.ok && (
                      <div className="flex justify-between">
                        <dt className="text-muted">{t(lang, "costs.total")}</dt>
                        <dd>{fmtMoney(lang, f.costs.total)}</dd>
                      </div>
                    )}
                    {range && (
                      <div className="flex justify-between">
                        <dt className="text-muted">{t(lang, "yield.title")}</dt>
                        <dd>{range}</dd>
                      </div>
                    )}
                  </dl>
                  <div className="mt-2 text-xs">
                    {unavailable ? (
                      <span className="text-danger">{t(lang, "portal.unavailable")}</span>
                    ) : match?.buyerAction === "GEMERKT" ? (
                      <span className="text-ok">{t(lang, "portal.remembered")}</span>
                    ) : match?.buyerAction === "BESICHTIGUNG" ? (
                      <span className="text-ok">{t(lang, "portal.viewing_requested")}</span>
                    ) : (
                      <span className="text-brand-strong">{t(lang, "portal.details")} →</span>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
        {declined.length > 0 && (
          <details className="mt-4 rounded-2xl border border-line bg-surface p-4">
            <summary className="cursor-pointer text-sm font-medium text-petrol">
              {t(lang, "portal.show_rejected")} ({declined.length})
            </summary>
            <ul className="mt-2 space-y-1 text-sm">
              {declined.map(({ property: p, match }) => (
                <li key={p.id} className="flex justify-between gap-2">
                  <Link href={`/portal/${token}/objekt/${p.id}${q}`} className="underline">
                    {(lang === "en" && p.titleEn) || p.title}
                  </Link>
                  <span className="text-xs text-muted">{match?.buyerReasonCategory ? t(lang, `reject_reasons.${match.buyerReasonCategory}`) : ""}</span>
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-semibold text-petrol">{t(lang, "portal.reports")}</h2>
        {reports.length === 0 ? (
          <p className="text-sm text-muted">{t(lang, "portal.no_reports")}</p>
        ) : (
          <ul className="space-y-2">
            {reports.map((rep) => (
              <li key={rep.id}>
                <Link href={`/portal/${token}/bericht/${rep.id}${q}`} className="flex items-center justify-between rounded-2xl border border-line bg-surface px-4 py-3 text-sm hover:border-brand">
                  <span className="font-medium text-petrol">{t(lang, rep.kind === "SUCHBERICHT" ? "report.search_title" : "report.market_title")}</span>
                  <span className="text-xs text-muted">{rep.periodStart && rep.periodEnd ? `${fmtDate(lang, rep.periodStart)} – ${fmtDate(lang, rep.periodEnd)}` : fmtDate(lang, rep.approvedAt)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </PortalShell>
  );
}
