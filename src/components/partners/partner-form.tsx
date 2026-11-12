import type { Partner, PartnerType } from "@prisma/client";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/field";
import { COUNTRY_LABEL } from "@/components/mandates/profile-form";

export const PARTNER_TYPE_LABEL: Record<PartnerType, string> = { MAKLER: "Makler", AGENTUR: "Agentur", ANWALT: "Anwalt", NOTAR: "Notar", FINANZIERER: "Finanzierer", SONSTIGES: "Sonstiges" };

type RegionRow = { key: string; name: string; country: string };

/** Felder für Anlegen und Bearbeiten (Server Component, in <form> einbetten). */
export function PartnerFields({ p, regions, disabled }: { p?: Partner | null; regions: RegionRow[]; disabled?: boolean }) {
  const countries = Array.from(new Set(regions.map((r) => r.country))).sort();
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" required>
          <Input name="name" defaultValue={p?.name ?? ""} required disabled={disabled} />
        </Field>
        <Field label="Firma">
          <Input name="company" defaultValue={p?.company ?? ""} disabled={disabled} />
        </Field>
        <Field label="E-Mail">
          <Input name="email" type="email" defaultValue={p?.email ?? ""} disabled={disabled} />
        </Field>
        <Field label="Telefon">
          <Input name="phone" defaultValue={p?.phone ?? ""} disabled={disabled} />
        </Field>
        <Field label="Art">
          <Select name="type" defaultValue={p?.type ?? "MAKLER"} disabled={disabled}>
            {(Object.keys(PARTNER_TYPE_LABEL) as PartnerType[]).map((k) => (
              <option key={k} value={k}>
                {PARTNER_TYPE_LABEL[k]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Sprache für Versand">
          <Select name="language" defaultValue={p?.language ?? "de"} disabled={disabled}>
            <option value="de">Deutsch</option>
            <option value="en">Englisch</option>
            <option value="es">Spanisch</option>
            <option value="it">Italienisch</option>
            <option value="fr">Französisch</option>
          </Select>
        </Field>
        <Field label="Land" required>
          <Select name="country" defaultValue={p?.country ?? ""} required disabled={disabled}>
            <option value="">–</option>
            {countries.map((c) => (
              <option key={c} value={c}>
                {COUNTRY_LABEL[c] ?? c}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Partnervereinbarung geschlossen am">
          <Input type="date" name="agreementAt" defaultValue={p?.agreementAt?.toISOString().slice(0, 10) ?? ""} disabled={disabled} />
        </Field>
      </div>
      <Field label="Regionen" hint="leer = ganzes Land" group>
        <div className="grid max-h-56 grid-cols-2 gap-1 overflow-y-auto rounded-xl border border-line p-2 sm:grid-cols-3">
          {regions.map((r) => (
            <label key={r.key} className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="regions" value={r.key} defaultChecked={p?.regions.includes(r.key)} disabled={disabled} className="h-4 w-4 accent-brand-strong" />
              {r.name} <span className="text-xs text-muted">{r.country}</span>
            </label>
          ))}
        </div>
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Lizenz / Registrierung im Land">
          <Input name="licenseNote" defaultValue={p?.licenseNote ?? ""} disabled={disabled} placeholder="z. B. API-Nummer, Maklerzulassung" />
        </Field>
        <Field label="Vereinbarte Provisionsteilung">
          <Input name="commissionSplit" defaultValue={p?.commissionSplit ?? ""} disabled={disabled} placeholder="z. B. 50/50 der Verkäuferprovision" />
        </Field>
      </div>
      <Field label="Notiz">
        <Textarea name="note" rows={2} defaultValue={p?.note ?? ""} disabled={disabled} />
      </Field>
      {p && <Checkbox name="active" value="on" defaultChecked={p.active} disabled={disabled} label="Aktiv" />}
      {p && !p.active && <input type="hidden" name="active" value="off" />}
    </>
  );
}
