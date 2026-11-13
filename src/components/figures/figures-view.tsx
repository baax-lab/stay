import type { PropertyFigures } from "@/lib/services/figures";
import { fmtDate, fmtMoney, fmtNumber, t, type Lang } from "@/lib/i18n";
import { cn } from "@/lib/cn";

/** Darstellung von Ampel, Gesamtkosten und Rendite – identisch intern, im Portal und im Dossier. */

export const LIGHT_COLOR: Record<string, string> = { GRUEN: "bg-ok", GELB: "bg-warn", ROT: "bg-danger", GRAU: "bg-muted" };
const LIGHT_HEX: Record<string, string> = { GRUEN: "#1f9d6b", GELB: "#c17f0c", ROT: "#d64545", GRAU: "#52636c" };

export function LicenseBlock({ f, lang, print = false }: { f: PropertyFigures; lang: Lang; print?: boolean }) {
  return (
    <div className="flex items-start gap-3" data-testid="license-block">
      <span className={cn("mt-0.5 inline-block h-5 w-5 shrink-0 rounded-full", LIGHT_COLOR[f.light.light])} style={print ? { background: LIGHT_HEX[f.light.light] } : undefined} />
      <div>
        <div className="font-medium text-petrol">
          {t(lang, "license.title")}: {t(lang, `license.${f.light.light}`)}
        </div>
        <div className="text-sm text-muted" data-testid="license-reason">
          {t(lang, f.light.reasonKey)}
        </div>
      </div>
    </div>
  );
}

export function CostsBlock({ f, lang }: { f: PropertyFigures; lang: Lang }) {
  const c = f.costs;
  if (!c.ok) return <p className="text-sm text-warn">{t(lang, "costs.fx_missing", { currency: c.currency })}</p>;
  return (
    <div data-testid="costs-block">
      <table className="w-full text-sm">
        <tbody>
          <tr>
            <td className="py-1 text-muted">{t(lang, "costs.purchase_price")}</td>
            <td className="py-1 text-right">
              {c.currency !== "EUR" && <span className="mr-2 text-xs text-muted">{fmtMoney(lang, c.priceOriginal, c.currency)}</span>}
              {fmtMoney(lang, c.priceEur)}
            </td>
          </tr>
          {c.items.map((i) => (
            <tr key={i.label}>
              <td className="py-1 pl-3 text-muted">
                {i.label}
                {i.pct != null && <span className="text-xs"> ({fmtNumber(lang, i.pct, 1)} %)</span>}
              </td>
              <td className="py-1 text-right">{fmtMoney(lang, i.amount)}</td>
            </tr>
          ))}
          <tr>
            <td className="py-1 text-muted">
              {t(lang, "costs.side_costs")} <span className="text-xs">({fmtNumber(lang, c.sideCostsPct, 1)} %)</span>
            </td>
            <td className="py-1 text-right">{fmtMoney(lang, c.sideCosts)}</td>
          </tr>
          {c.baaxFee > 0 && (
            <tr>
              <td className="py-1 text-muted">{t(lang, "costs.baax_fee")}</td>
              <td className="py-1 text-right">{fmtMoney(lang, c.baaxFee)}</td>
            </tr>
          )}
          {c.renovation > 0 && (
            <tr>
              <td className="py-1 text-muted">{t(lang, "costs.renovation")}</td>
              <td className="py-1 text-right">{fmtMoney(lang, c.renovation)}</td>
            </tr>
          )}
          <tr className="border-t border-line text-base font-semibold text-petrol">
            <td className="pt-2">{t(lang, "costs.total")}</td>
            <td className="pt-2 text-right" data-testid="costs-total">
              {fmtMoney(lang, c.total)}
            </td>
          </tr>
        </tbody>
      </table>
      {c.currency !== "EUR" && <p className="mt-2 text-xs text-muted">{t(lang, "costs.fx", { currency: c.currency, rate: fmtNumber(lang, c.rateToEur, 4), date: fmtDate(lang, c.rateDate) })}</p>}
      <p className="mt-2 text-xs text-muted">{t(lang, "costs.disclaimer")}</p>
    </div>
  );
}

export function YieldBlock({ f, lang }: { f: PropertyFigures; lang: Lang }) {
  const y = f.yield;
  if (!y.ok) return <p className="text-sm text-muted">{t(lang, "yield.missing")}</p>;
  const assumptionLabel: Record<string, string> =
    lang === "en"
      ? { managementPct: "Management/agency", reservesPct: "Reserves", taxPct: "Tax (rough)", opCosts: "Operating costs p.a.", spread: "Scenario spread", units: "Units" }
      : { managementPct: "Verwaltung/Agentur", reservesPct: "Rücklagen", taxPct: "Steuern grob", opCosts: "Betriebskosten p. a.", spread: "Szenario-Spanne", units: "Einheiten" };
  return (
    <div data-testid="yield-block">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs uppercase tracking-wide text-muted">
            <th className="py-1 text-left">{t(lang, "yield.scenario")}</th>
            {y.scenarios.map((s) => (
              <th key={s.key} className="py-1 text-right">
                {t(lang, `yield.${s.key}`)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {y.basis === "adr" && (
            <>
              <tr>
                <td className="py-1 text-muted">{t(lang, "yield.occupancy")}</td>
                {y.scenarios.map((s) => (
                  <td key={s.key} className="py-1 text-right">
                    {fmtNumber(lang, s.occupancyPct, 0)} %
                  </td>
                ))}
              </tr>
              <tr>
                <td className="py-1 text-muted">{t(lang, "yield.adr")}</td>
                {y.scenarios.map((s) => (
                  <td key={s.key} className="py-1 text-right">
                    {fmtMoney(lang, s.adr)}
                  </td>
                ))}
              </tr>
            </>
          )}
          <tr>
            <td className="py-1 text-muted">{t(lang, "yield.revenue")}</td>
            {y.scenarios.map((s) => (
              <td key={s.key} className="py-1 text-right">
                {fmtMoney(lang, s.revenue)}
              </td>
            ))}
          </tr>
          <tr>
            <td className="py-1 text-muted">{t(lang, "yield.costs")}</td>
            {y.scenarios.map((s) => (
              <td key={s.key} className="py-1 text-right">
                −{fmtMoney(lang, s.management + s.reserves + s.opCosts + s.tax)}
              </td>
            ))}
          </tr>
          <tr>
            <td className="py-1 text-muted">{t(lang, "yield.net")}</td>
            {y.scenarios.map((s) => (
              <td key={s.key} className="py-1 text-right">
                {fmtMoney(lang, s.net)}
              </td>
            ))}
          </tr>
          <tr className="border-t border-line font-semibold text-petrol">
            <td className="pt-2">{t(lang, "yield.yield")}</td>
            {y.scenarios.map((s) => (
              <td key={s.key} className="pt-2 text-right" data-testid={`yield-${s.key}`}>
                {fmtNumber(lang, s.yieldPct, 1)} %
              </td>
            ))}
          </tr>
        </tbody>
      </table>
      <p className="mt-2 text-xs text-muted">
        {t(lang, "yield.assumptions")}:{" "}
        {y.assumptions
          .filter((a) => a.key !== "units" || a.value > 1)
          .map((a) => `${assumptionLabel[a.key]} ${a.key === "opCosts" ? fmtMoney(lang, a.value) : `${a.value}${a.key === "units" ? "" : " %"}`}${a.assumed ? (lang === "en" ? " (assumed)" : " (Annahme)") : ""}`)
          .join(" · ")}
      </p>
      <p className="mt-2 text-xs font-medium text-muted">{t(lang, "yield.disclaimer")}</p>
    </div>
  );
}
