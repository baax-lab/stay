import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { isStale, regionStats } from "@/lib/analytics";
import { ACTIVE_STATUSES } from "@/lib/mandates";
import { selectCostRules } from "@/lib/costs";
import { formatEur } from "@/lib/fees";
import { saveRegionKnowledgeAction } from "../../actions";
import { ActionForm } from "@/components/ui/action-form";
import { Card, CardTitle, PageHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Textarea } from "@/components/ui/field";

export default async function RegionKnowledgePage({ params }: { params: Promise<{ key: string }> }) {
  const user = await requireUser();
  const { key } = await params;
  const r = await prisma.region.findUnique({ where: { key } });
  if (!r) notFound();
  const [props, mandates, rules, closings, country] = await Promise.all([
    prisma.property.findMany({ where: { region: key, active: true }, select: { id: true, title: true, price: true, livingArea: true, occupancyPct: true, adr: true, availability: true, createdAt: true }, orderBy: { createdAt: "desc" } }),
    prisma.searchProfile.count({ where: { regions: { has: key }, active: true, mandate: { status: { in: ACTIVE_STATUSES } } } }),
    prisma.countryCost.findMany({ where: { country: r.country } }),
    prisma.closing.count({ where: { propertyId: { in: (await prisma.property.findMany({ where: { region: key }, select: { id: true } })).map((p) => p.id) } } }),
    prisma.country.findUnique({ where: { code: r.country } }),
  ]);
  const stats = regionStats(props);
  const canEdit = can.editEventSetting(user.role);
  const costs = selectCostRules(rules, r.country, key);
  const text: Array<[keyof typeof r, string, number]> = [
    ["description", "Beschreibung und Preisniveau", 3],
    ["rentalRules", "Touristische Vermietung (ausführlich)", 4],
    ["secondHomeRules", "Zweitwohnsitz und Erwerb", 3],
    ["taxNote", "Steuern und Abgaben", 2],
    ["seasonality", "Saison", 2],
    ["airportNote", "Erreichbarkeit / Flughafen", 1],
    ["risks", "Risiken", 3],
    ["sources", "Quellen", 2],
  ];

  return (
    <div>
      <Link href={`/wissen/${r.country}`} className="text-sm text-muted hover:text-petrol">
        ← {country?.name ?? r.country}
      </Link>
      <PageHeader
        title={r.name}
        subtitle={`${country?.name ?? r.country} · ${r.key}`}
        action={isStale(r.reviewedAt) ? <Badge tone="warn">prüfen</Badge> : <Badge tone="ok">geprüft {r.reviewedAt!.toLocaleDateString("de-DE")} ({r.reviewedByName})</Badge>}
      />
      <Card className="mb-4">
        <CardTitle>Aus eigenen Daten</CardTitle>
        <div className="grid grid-cols-2 gap-3 text-center sm:grid-cols-3 lg:grid-cols-6" data-testid="region-stats">
          {[
            ["Objekte", String(stats.count)],
            ["Median Preis", formatEur(stats.medianPrice)],
            ["Median €/m²", formatEur(stats.medianPricePerSqm)],
            ["Ø Auslastung", stats.avgOccupancy != null ? `${stats.avgOccupancy.toLocaleString("de-DE")} %` : "–"],
            ["Ø Tagespreis", formatEur(stats.avgAdr)],
            ["Aktive Suchprofile / Käufe", `${mandates} / ${closings}`],
          ].map(([k, v]) => (
            <div key={k} className="rounded-xl bg-canvas p-3">
              <div className="text-lg font-semibold text-petrol">{v}</div>
              <div className="text-xs text-muted">{k}</div>
            </div>
          ))}
        </div>
      </Card>
      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <Card>
          <CardTitle>Regionswissen</CardTitle>
          {canEdit ? (
            <ActionForm action={saveRegionKnowledgeAction.bind(null, key)}>
              <Field label="Kurzregel für die Genehmigungsampel" hint="Wörter wie „Vergabestopp“ setzen Objekte ohne Lizenz auf Rot">
                <Input name="licenseRule" defaultValue={r.licenseRule ?? ""} />
              </Field>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <Field label="€/m² von">
                  <Input name="pricePerSqmMin" defaultValue={r.pricePerSqmMin ?? ""} inputMode="numeric" />
                </Field>
                <Field label="€/m² bis">
                  <Input name="pricePerSqmMax" defaultValue={r.pricePerSqmMax ?? ""} inputMode="numeric" />
                </Field>
                <Field label="Auslastung von (%)">
                  <Input name="occupancyMin" defaultValue={r.occupancyMin ?? ""} />
                </Field>
                <Field label="Auslastung bis (%)">
                  <Input name="occupancyMax" defaultValue={r.occupancyMax ?? ""} />
                </Field>
                <Field label="Tagespreis von (€)">
                  <Input name="adrMin" defaultValue={r.adrMin ?? ""} inputMode="numeric" />
                </Field>
                <Field label="Tagespreis bis (€)">
                  <Input name="adrMax" defaultValue={r.adrMax ?? ""} inputMode="numeric" />
                </Field>
              </div>
              {text.map(([k, label, rows]) => (
                <Field key={k} label={label}>
                  <Textarea name={k} rows={rows} defaultValue={(r[k] as string | null) ?? ""} />
                </Field>
              ))}
              <Checkbox name="focus" defaultChecked={r.focus} label="Schwerpunktregion" />
              <Checkbox name="reviewed" label="Inhalte geprüft (setzt das Prüfdatum auf heute)" />
              <Button type="submit">Speichern</Button>
            </ActionForm>
          ) : (
            <dl className="space-y-3 text-sm">
              {r.licenseRule && (
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-muted">Kurzregel</dt>
                  <dd>{r.licenseRule}</dd>
                </div>
              )}
              {text.map(([k, label]) =>
                r[k] ? (
                  <div key={k}>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</dt>
                    <dd className="whitespace-pre-wrap">{r[k] as string}</dd>
                  </div>
                ) : null,
              )}
            </dl>
          )}
        </Card>
        <div className="space-y-4">
          <Card>
            <CardTitle>Kaufnebenkosten</CardTitle>
            <ul className="space-y-1 text-sm">
              {costs.map((x) => (
                <li key={x.label} className="flex justify-between gap-2">
                  <span>
                    {x.label}
                    {x.regionKey ? <span className="text-xs text-muted"> (regional)</span> : null}
                  </span>
                  <span className="text-muted">{x.pct != null ? `${x.pct.toLocaleString("de-DE")} %` : ""} {x.flat != null ? `${x.flat.toLocaleString("de-DE")} €` : ""}</span>
                </li>
              ))}
              {costs.length === 0 && <li className="text-muted">Keine Richtwerte hinterlegt.</li>}
            </ul>
          </Card>
          <Card>
            <CardTitle>Objekte in der Region</CardTitle>
            <ul className="space-y-1 text-sm">
              {props.slice(0, 15).map((p) => (
                <li key={p.id} className="flex justify-between gap-2">
                  <Link href={`/objekte/${p.id}`} className="truncate hover:underline">
                    {p.title}
                  </Link>
                  <span className="shrink-0 text-xs text-muted">{formatEur(p.price)}</span>
                </li>
              ))}
              {props.length === 0 && <li className="text-muted">Noch keine Objekte.</li>}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
