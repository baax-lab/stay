import type { FeeAgreement, FeeBand } from "@prisma/client";
import { austriaCap, calculateFee, formatEur } from "@/lib/fees";
import { saveFeeAction } from "@/app/(app)/auftraege/actions";
import { ActionForm } from "@/components/ui/action-form";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/field";
import { Notice } from "@/components/ui/card";

export function FeePanel({ mandateId, fee, bands, country, canEdit }: { mandateId: string; fee: FeeAgreement; bands: FeeBand[]; country: string | null; canEdit: boolean }) {
  const calc = calculateFee({ ...fee, askingPrice: fee.askingPrice, purchasePrice: fee.purchasePrice });
  const at = country === "AT" && fee.purchasePrice ? austriaCap(fee.purchasePrice) : null;
  const d = (x: Date | null) => (x ? x.toISOString().slice(0, 10) : "");

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <ActionForm action={saveFeeAction.bind(null, mandateId)}>
        <Field label="Honorarband (aus Budget vorgeschlagen, überschreibbar)">
          <Select name="volumeBandId" defaultValue={fee.volumeBandId ?? ""} disabled={!canEdit}>
            <option value="">individuell</option>
            {bands.map((b) => (
              <option key={b.id} value={b.id}>
                {formatEur(b.volumeFrom)} – {b.volumeTo ? formatEur(b.volumeTo) : "offen"}: Erfolg {formatEur(b.successFee)}, Grund {formatEur(b.baseFee)}
              </option>
            ))}
          </Select>
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Erfolgshonorar (€)">
            <Input name="successFee" defaultValue={fee.successFee} inputMode="numeric" disabled={!canEdit} />
          </Field>
          <Field label="Grundhonorar (€)" hint="Startphase: 0">
            <Input name="baseFee" defaultValue={fee.baseFee} inputMode="numeric" disabled={!canEdit} />
          </Field>
        </div>
        <Checkbox name="baseFeeActive" defaultChecked={fee.baseFeeActive} disabled={!canEdit} label="Grundhonorar aktiv" />
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Bonus (% der Ersparnis)">
            <Input name="bonusPct" defaultValue={(fee.bonusPct * 100).toLocaleString("de-DE")} disabled={!canEdit} />
          </Field>
          <Field label="Bonus-Deckel (% vom Erfolgshonorar)">
            <Input name="bonusCapPct" defaultValue={(fee.bonusCapPct * 100).toLocaleString("de-DE")} disabled={!canEdit} />
          </Field>
          <Field label="Reisepauschale je Reise (€)">
            <Input name="travelFlat" defaultValue={fee.travelFlat ?? ""} inputMode="numeric" disabled={!canEdit} />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Provision Verkäuferseite (€)" hint="nur Gewerbe-/Betriebsobjekte, offengelegt">
            <Input name="sellerSideCommission" defaultValue={fee.sellerSideCommission ?? ""} inputMode="numeric" disabled={!canEdit} />
          </Field>
          <Field label="davon dem Käufer angerechnet (€)">
            <Input name="sellerSideCredited" defaultValue={fee.sellerSideCredited ?? ""} inputMode="numeric" disabled={!canEdit} />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Angebotspreis (eingefroren, €)">
            <Input name="askingPrice" defaultValue={fee.askingPrice ?? ""} inputMode="numeric" disabled={!canEdit} />
          </Field>
          <Field label="Kaufpreis (€)">
            <Input name="purchasePrice" defaultValue={fee.purchasePrice ?? ""} inputMode="numeric" disabled={!canEdit} />
          </Field>
          <Field label="Rechnung gestellt am">
            <Input type="date" name="invoicedAt" defaultValue={d(fee.invoicedAt)} disabled={!canEdit} />
          </Field>
          <Field label="Bezahlt am">
            <Input type="date" name="paidAt" defaultValue={d(fee.paidAt)} disabled={!canEdit} />
          </Field>
        </div>
        <Field label="Notiz">
          <Textarea name="note" rows={2} defaultValue={fee.note ?? ""} disabled={!canEdit} />
        </Field>
        {canEdit && <Button type="submit">Honorar speichern</Button>}
      </ActionForm>

      <aside className="space-y-3">
        <div className="rounded-2xl border border-line bg-surface p-4 text-sm">
          <div className="mb-2 font-semibold text-petrol">Berechnung</div>
          <Row k="Grundhonorar" v={formatEur(calc.baseFee)} />
          <Row k="Erfolgshonorar" v={formatEur(calc.successFee)} />
          <Row k="Ersparnis" v={formatEur(calc.savings)} />
          <Row k={`Bonus (${Math.round(fee.bonusPct * 100)} %, max. ${Math.round(fee.bonusCapPct * 100) } %)`} v={formatEur(calc.bonus)} />
          {calc.sellerSideCredited > 0 && <Row k="Anrechnung Verkäuferprovision" v={`− ${formatEur(calc.sellerSideCredited)}`} />}
          <div className="mt-2 flex justify-between border-t border-line pt-2 text-base font-semibold text-petrol">
            <span>Gesamt</span>
            <span>{formatEur(calc.total)}</span>
          </div>
          {fee.purchasePrice == null && <p className="mt-2 text-xs text-muted">Bonus wird beim Status „Gekauft“ aus Angebots- und Kaufpreis berechnet.</p>}
        </div>
        {country === "AT" && (
          <Notice tone="warn">
            <div className="font-medium">Österreich: gesetzlichen Höchstsatz prüfen (3 % zzgl. USt)</div>
            {at ? (
              <div className="mt-1 text-xs">
                Höchstsatz bei {formatEur(fee.purchasePrice)}: {formatEur(at.net)} netto, {formatEur(at.gross)} brutto. Berechnetes Honorar: {formatEur(calc.total)} {calc.total > at.net ? "– liegt darüber!" : "– liegt darunter."}
              </div>
            ) : (
              <div className="mt-1 text-xs">Vergleichsrechnung erscheint, sobald ein Kaufpreis eingetragen ist.</div>
            )}
          </Notice>
        )}
        <a href={`/auftraege/${mandateId}/rechnungsdaten`} className="block text-center text-sm text-brand-strong underline">
          Rechnungsdaten für die Buchhaltung (CSV)
        </a>
      </aside>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-2 py-0.5">
      <span className="text-muted">{k}</span>
      <span>{v}</span>
    </div>
  );
}
