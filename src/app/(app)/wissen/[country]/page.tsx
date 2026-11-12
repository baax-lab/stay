import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { isStale } from "@/lib/analytics";
import { closingTemplate } from "@/lib/checklists";
import { precheckTemplate } from "@/lib/precheck";
import { selectCostRules } from "@/lib/costs";
import { saveCountryAction } from "../actions";
import { ActionForm } from "@/components/ui/action-form";
import { Card, CardTitle, PageHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Textarea } from "@/components/ui/field";

export default async function CountryPage({ params }: { params: Promise<{ country: string }> }) {
  const user = await requireUser();
  const { country } = await params;
  const code = country.toUpperCase();
  const [c, regions, rules] = await Promise.all([
    prisma.country.findUnique({ where: { code } }),
    prisma.region.findMany({ where: { country: code }, orderBy: [{ focus: "desc" }, { name: "asc" }] }),
    prisma.countryCost.findMany({ where: { country: code } }),
  ]);
  if (!c && regions.length === 0) notFound();
  const canEdit = can.editEventSetting(user.role);
  const costs = selectCostRules(rules, code, null);
  const fields: Array<[keyof NonNullable<typeof c>, string, number]> = [
    ["overview", "Überblick", 3],
    ["buyingProcess", "Kaufablauf", 4],
    ["foreignBuyers", "Erwerb durch Ausländer", 3],
    ["taxesNote", "Steuern und Abgaben", 3],
    ["typicalDuration", "Typische Dauer bis zum Eigentum", 1],
    ["financingNote", "Finanzierung", 2],
    ["sources", "Quellen", 2],
  ];

  return (
    <div>
      <Link href="/wissen" className="text-sm text-muted hover:text-petrol">
        ← Länder- und Regionswissen
      </Link>
      <PageHeader
        title={c?.name ?? code}
        subtitle={`${regions.length} Regionen · Währung ${c?.currency ?? "EUR"}`}
        action={isStale(c?.reviewedAt) ? <Badge tone="warn">prüfen</Badge> : <Badge tone="ok">geprüft {c!.reviewedAt!.toLocaleDateString("de-DE")} ({c!.reviewedByName})</Badge>}
      />
      <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
        <div className="space-y-4">
          <Card>
            <CardTitle>Wissen</CardTitle>
            {canEdit ? (
              <ActionForm action={saveCountryAction.bind(null, code)}>
                <div className="grid gap-3 sm:grid-cols-3">
                  <Field label="Name">
                    <Input name="name" defaultValue={c?.name ?? code} />
                  </Field>
                  <Field label="Name (EN)">
                    <Input name="nameEn" defaultValue={c?.nameEn ?? ""} />
                  </Field>
                  <Field label="Währung">
                    <Input name="currency" defaultValue={c?.currency ?? "EUR"} maxLength={3} />
                  </Field>
                </div>
                {fields.map(([k, label, rows]) => (
                  <Field key={k} label={label}>
                    <Textarea name={k} rows={rows} defaultValue={(c?.[k] as string | null) ?? ""} />
                  </Field>
                ))}
                <Checkbox name="reviewed" label="Inhalte geprüft (setzt das Prüfdatum auf heute)" />
                <Button type="submit">Speichern</Button>
              </ActionForm>
            ) : (
              <dl className="space-y-3 text-sm">
                {fields.map(([k, label]) =>
                  c?.[k] ? (
                    <div key={k}>
                      <dt className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</dt>
                      <dd className="whitespace-pre-wrap">{c[k] as string}</dd>
                    </div>
                  ) : null,
                )}
              </dl>
            )}
          </Card>
        </div>
        <div className="space-y-4">
          <Card>
            <CardTitle>Regionen</CardTitle>
            <ul className="space-y-1 text-sm">
              {regions.map((r) => (
                <li key={r.key}>
                  <Link href={`/wissen/region/${r.key}`} className="flex items-center justify-between rounded-lg px-2 py-1 hover:bg-canvas">
                    <span>
                      {r.name} {r.focus && <Badge tone="brand">Schwerpunkt</Badge>}
                    </span>
                    {isStale(r.reviewedAt) ? <span className="text-xs text-warn">prüfen</span> : <span className="text-xs text-ok">geprüft</span>}
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
          <Card>
            <CardTitle action={canEdit ? <Link href="/einstellungen/nebenkosten" className="text-xs text-brand-strong">pflegen</Link> : undefined}>Kaufnebenkosten (Land)</CardTitle>
            <ul className="space-y-1 text-sm">
              {costs.map((x) => (
                <li key={x.label} className="flex justify-between gap-2">
                  <span>{x.label}</span>
                  <span className="text-muted">{x.pct != null ? `${x.pct.toLocaleString("de-DE")} %` : ""} {x.flat != null ? `${x.flat.toLocaleString("de-DE")} €` : ""}</span>
                </li>
              ))}
              {costs.length === 0 && <li className="text-muted">Keine Richtwerte hinterlegt.</li>}
            </ul>
          </Card>
          <Card>
            <CardTitle>Kaufabwicklung (Checkliste)</CardTitle>
            <ol className="list-decimal space-y-0.5 pl-5 text-sm">
              {closingTemplate(code).map((i) => (
                <li key={i.key}>{i.label}</li>
              ))}
            </ol>
          </Card>
          <Card>
            <CardTitle>Vorprüfung (landesspezifisch)</CardTitle>
            <ul className="list-disc space-y-0.5 pl-5 text-sm">
              {precheckTemplate("FEWO", code)
                .filter((i) => i.group === "Land")
                .map((i) => (
                  <li key={i.key}>{i.label}</li>
                ))}
              {precheckTemplate("FEWO", code).every((i) => i.group !== "Land") && <li className="list-none text-muted">Keine landesspezifischen Punkte hinterlegt.</li>}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
