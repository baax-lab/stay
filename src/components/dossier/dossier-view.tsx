import type { DossierData } from "@/lib/services/dossier";
import { fmtDate, fmtMoney, fmtNumber, t, type Lang } from "@/lib/i18n";
import { CostsBlock, LicenseBlock, YieldBlock } from "@/components/figures/figures-view";

/** Objektdossier (Konzept §9.5): Weblink und PDF aus derselben Darstellung, Corporate Design Baax. */
export function DossierView({ d, lang, photoUrl, print = false }: { d: DossierData; lang: Lang; photoUrl: (fileId: string) => string; print?: boolean }) {
  const [cover, ...more] = d.photoIds;
  const isHotel = d.segment === "PENSION_HOTEL";
  const keyData: Array<[string, string]> = [
    [t(lang, "dossier.price"), fmtMoney(lang, d.price, d.currency)],
    [t(lang, isHotel ? "dossier.rooms" : "dossier.units"), d.units != null ? String(d.units) : "–"],
    [t(lang, "dossier.living_area"), d.livingArea ? `${fmtNumber(lang, d.livingArea)} m²` : "–"],
    [t(lang, "dossier.occupancy"), d.occupancyPct != null ? `${fmtNumber(lang, d.occupancyPct)} %` : "–"],
    [t(lang, "dossier.adr"), d.adr ? fmtMoney(lang, d.adr) : "–"],
    ...(d.revenueYear ? ([[t(lang, "dossier.revenue"), fmtMoney(lang, d.revenueYear)]] as Array<[string, string]>) : []),
  ];

  return (
    <article className="dossier mx-auto max-w-4xl bg-surface text-ink" data-testid="dossier">
      <header className="flex items-end justify-between gap-4 border-b-4 border-brand pb-4">
        <div>
          <div className="text-sm font-semibold text-brand-strong">{t(lang, "common.brand")}</div>
          <div className="text-xs text-muted">{t(lang, "dossier.title")}</div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-petrol">{d.title}</h1>
          <div className="mt-1 text-sm text-muted">
            {t(lang, `segment.${d.segment}`)} · {[d.locality, d.regionName, d.country].filter(Boolean).join(", ")}
          </div>
        </div>
        <div className="text-right text-xs text-muted">
          {d.buyerName && (
            <div>
              {t(lang, "dossier.prepared_for")}: <span className="text-petrol">{d.buyerName}</span>
            </div>
          )}
          <div>
            {t(lang, "dossier.created")}: {fmtDate(lang, new Date())}
          </div>
          <div className="mt-1 text-2xl font-semibold text-petrol">{fmtMoney(lang, d.price, d.currency)}</div>
        </div>
      </header>

      {cover && (
        <section className="mt-5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photoUrl(cover)} alt="" className="aspect-[16/9] w-full rounded-2xl object-cover" />
          {more.length > 0 && (
            <div className="mt-2 grid grid-cols-3 gap-2">
              {more.slice(0, 6).map((id) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={id} src={photoUrl(id)} alt="" className="aspect-[4/3] w-full rounded-xl object-cover" />
              ))}
            </div>
          )}
        </section>
      )}

      <section className="mt-6 grid gap-6 md:grid-cols-2 print:grid-cols-2">
        <div>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-petrol">{t(lang, "dossier.key_data")}</h2>
          <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-sm">
            {keyData.map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-muted">{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
            <dt className="text-muted">{t(lang, "dossier.location")}</dt>
            <dd>{[d.locality, d.regionName].filter(Boolean).join(", ")}</dd>
          </dl>
          {d.features.length > 0 && (
            <>
              <h3 className="mb-1 mt-4 text-xs font-semibold uppercase tracking-wide text-muted">{t(lang, "dossier.features")}</h3>
              <div className="flex flex-wrap gap-1.5">
                {d.features.map((f) => (
                  <span key={f} className="rounded-full border border-line px-2.5 py-0.5 text-xs">
                    {f}
                  </span>
                ))}
              </div>
            </>
          )}
        </div>
        <div>
          <LicenseBlock f={d.figures} lang={lang} print={print} />
          {d.precheck && (
            <div className="mt-4">
              <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">{t(lang, "dossier.precheck")}</h3>
              <p className="text-sm">{d.precheck}</p>
            </div>
          )}
        </div>
      </section>

      {d.description && (
        <section className="mt-6">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-petrol">{t(lang, "dossier.description")}</h2>
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{d.description}</p>
        </section>
      )}

      {(d.strengths.length > 0 || d.risks.length > 0) && (
        <section className="mt-6 grid gap-6 md:grid-cols-2 print:grid-cols-2">
          <div>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-ok">{t(lang, "dossier.strengths")}</h2>
            <ul className="list-disc space-y-1 pl-5 text-sm">
              {d.strengths.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-danger">{t(lang, "dossier.risks")}</h2>
            <ul className="list-disc space-y-1 pl-5 text-sm">
              {d.risks.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </div>
        </section>
      )}

      <section className="mt-6 grid gap-6 md:grid-cols-2 print:grid-cols-2 print:break-inside-avoid">
        <div>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-petrol">{t(lang, "costs.title")}</h2>
          <CostsBlock f={d.figures} lang={lang} />
        </div>
        <div>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-petrol">{t(lang, "yield.title")}</h2>
          <YieldBlock f={d.figures} lang={lang} />
        </div>
      </section>

      <footer className="mt-8 border-t border-line pt-3 text-[11px] text-muted">
        {t(lang, "common.brand")} · {t(lang, "common.tagline")} · www.baax.de · {t(lang, "dossier.confidential")}
      </footer>
    </article>
  );
}
