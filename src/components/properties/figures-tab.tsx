import Link from "next/link";
import type { Property } from "@prisma/client";
import { propertyFigures } from "@/lib/services/figures";
import { YIELD_DEFAULTS } from "@/lib/yield";
import { saveDossierInputsAction } from "@/app/(app)/objekte/actions";
import { Card, CardTitle, Notice } from "@/components/ui/card";
import { NumberInput } from "@/components/ui/number-input";
import { Button, ButtonLink } from "@/components/ui/button";
import { ActionForm } from "@/components/ui/action-form";
import { Field, Input, Textarea } from "@/components/ui/field";
import { CostsBlock, LicenseBlock, YieldBlock } from "@/components/figures/figures-view";

export async function FiguresTab({ property, mandateId, mandates, canEdit }: { property: Property; mandateId: string | null; mandates: Array<{ id: string; title: string }>; canEdit: boolean }) {
  const f = await propertyFigures(property, mandateId);
  const q = (lang: string) => `?lang=${lang}${mandateId ? `&m=${mandateId}` : ""}`;

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_420px]">
      <div className="space-y-4">
        <Card>
          <CardTitle
            action={
              <div className="flex flex-wrap gap-2">
                <ButtonLink href={`/dossier/${property.id}${q("de")}`} size="sm" variant="secondary" target="_blank">
                  Dossier DE
                </ButtonLink>
                <ButtonLink href={`/dossier/${property.id}${q("en")}`} size="sm" variant="secondary" target="_blank">
                  Dossier EN
                </ButtonLink>
                <a href={`/api/pdf/dossier/${property.id}${q("de")}`} className="inline-flex h-9 items-center rounded-md bg-brand px-3.5 text-sm font-medium text-on-brand">
                  PDF DE
                </a>
                <a href={`/api/pdf/dossier/${property.id}${q("en")}`} className="inline-flex h-9 items-center rounded-md bg-brand px-3.5 text-sm font-medium text-on-brand">
                  PDF EN
                </a>
              </div>
            }
          >
            Genehmigungsampel
          </CardTitle>
          <LicenseBlock f={f} lang="de" />
          {f.regionRule && <p className="mt-2 text-xs text-muted">Regionsregel {f.regionName}: {f.regionRule}</p>}
        </Card>

        <Card>
          <CardTitle>Gesamtkosten</CardTitle>
          {mandates.length > 0 && (
            <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
              <span className="text-muted">Honorar aus:</span>
              <Link href={`/objekte/${property.id}?tab=kosten`} className={`rounded-md px-2.5 py-1 ${!mandateId ? "bg-brand text-on-brand" : "bg-canvas"}`}>
                Staffel
              </Link>
              {mandates.map((m) => (
                <Link key={m.id} href={`/objekte/${property.id}?tab=kosten&m=${m.id}`} className={`rounded-md px-2.5 py-1 ${mandateId === m.id ? "bg-brand text-on-brand" : "bg-canvas"}`}>
                  {m.title}
                </Link>
              ))}
            </div>
          )}
          <CostsBlock f={f} lang="de" />
          {f.costs.ok && f.costs.noRules && <Notice tone="warn">Für {property.country} sind keine Kaufnebenkosten hinterlegt (Einstellungen → Kaufnebenkosten).</Notice>}
          <p className="mt-1 text-xs text-muted">Honorar: {f.feeSource === "auftrag" ? "aus der Honorarvereinbarung des Suchauftrags" : f.feeSource === "staffel" ? "Vorschlag aus der Honorarstaffel" : "keins hinterlegt"}</p>
        </Card>

        <Card>
          <CardTitle>Renditespanne</CardTitle>
          <YieldBlock f={f} lang="de" />
        </Card>
      </div>

      <Card className="h-fit">
        <CardTitle>Angaben für Rendite und Dossier</CardTitle>
        <ActionForm action={saveDossierInputsAction.bind(null, property.id)}>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Auslastung (%)">
              <Input name="occupancyPct" defaultValue={property.occupancyPct ?? ""} disabled={!canEdit} />
            </Field>
            <Field label="Ø Tagespreis (€)" hint="je Einheit/Zimmer">
              <Input name="adr" defaultValue={property.adr ?? ""} disabled={!canEdit} />
            </Field>
            <Field label="Jahresumsatz (€)" hint="Betriebe">
              <Input name="revenueYear" defaultValue={property.revenueYear ?? ""} disabled={!canEdit} />
            </Field>
            <Field label="Betriebskosten p. a. (€)">
              <NumberInput name="opCostsYear" defaultValue={property.opCostsYear ?? null} disabled={!canEdit} placeholder={`sonst ${YIELD_DEFAULTS.opCostsPctOfRevenue} % Umsatz`} />
            </Field>
            <Field label="Verwaltung/Agentur (%)">
              <Input name="managementPct" defaultValue={property.managementPct ?? ""} disabled={!canEdit} placeholder={String(YIELD_DEFAULTS.managementPct)} />
            </Field>
            <Field label="Rücklagen (%)">
              <Input name="reservesPct" defaultValue={property.reservesPct ?? ""} disabled={!canEdit} placeholder={String(YIELD_DEFAULTS.reservesPct)} />
            </Field>
            <Field label="Steuern grob (%)">
              <Input name="taxPct" defaultValue={property.taxPct ?? ""} disabled={!canEdit} placeholder={String(YIELD_DEFAULTS.taxPct)} />
            </Field>
            <Field label="Szenario-Spanne (%)">
              <Input name="scenarioSpread" defaultValue={property.scenarioSpread != null ? property.scenarioSpread * 100 : ""} disabled={!canEdit} placeholder={String(YIELD_DEFAULTS.spread * 100)} />
            </Field>
            <Field label="Renovierungsbudget (€)" className="col-span-2">
              <NumberInput name="renovationBudget" defaultValue={property.renovationBudget ?? null} disabled={!canEdit} />
            </Field>
          </div>
          <Field label="Stärken">
            <Textarea name="strengths" rows={3} defaultValue={property.strengths ?? ""} disabled={!canEdit} placeholder="Eine Stärke je Zeile" />
          </Field>
          <Field label="Risiken">
            <Textarea name="risks" rows={3} defaultValue={property.risks ?? ""} disabled={!canEdit} placeholder="Ein Risiko je Zeile" />
          </Field>
          <Field label="Vorprüfungsstand">
            <Textarea name="precheckNote" rows={2} defaultValue={property.precheckNote ?? ""} disabled={!canEdit} placeholder="z. B. Nota simple geprüft, Lizenz übertragbar bestätigt" />
          </Field>
          <details className="rounded-xl border border-line p-3">
            <summary className="cursor-pointer text-sm font-medium text-petrol">Englische Fassung fürs Dossier</summary>
            <div className="mt-3 space-y-3">
              <Field label="Title (EN)">
                <Input name="titleEn" defaultValue={property.titleEn ?? ""} disabled={!canEdit} />
              </Field>
              <Field label="Description (EN)">
                <Textarea name="descriptionEn" rows={3} defaultValue={property.descriptionEn ?? ""} disabled={!canEdit} />
              </Field>
              <Field label="Strengths (EN)">
                <Textarea name="strengthsEn" rows={3} defaultValue={property.strengthsEn ?? ""} disabled={!canEdit} />
              </Field>
              <Field label="Risks (EN)">
                <Textarea name="risksEn" rows={3} defaultValue={property.risksEn ?? ""} disabled={!canEdit} />
              </Field>
            </div>
          </details>
          {canEdit && <Button type="submit">Speichern und neu berechnen</Button>}
        </ActionForm>
      </Card>
    </div>
  );
}
