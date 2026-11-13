"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { LicenseStatus, ObjectSource, Segment } from "@prisma/client";
import type { CriterionDef } from "@/lib/criteria";
import { SEGMENT_LABEL, entries } from "@/lib/labels";
import { LICENSE_STATUS_LABEL } from "@/lib/license";
import { createPropertyAction, updatePropertyAction, type PropertyFormInput, type SaveResult } from "@/app/(app)/objekte/actions";
import { Button } from "@/components/ui/button";
import { Checkbox, ChipGroup, Field, Input, Select, Textarea } from "@/components/ui/field";
import { Notice } from "@/components/ui/card";
import { NumberInput } from "@/components/ui/number-input";
import { useFormSafety } from "@/components/ui/form-safety";
import { COUNTRY_LABEL, type RegionOption } from "@/components/mandates/profile-form";

export const OBJECT_SOURCE_LABEL: Record<ObjectSource, string> = { PARTNER: "Partnermakler", AGENTUR: "Agentur", PORTAL: "Portal", OFFMARKET: "Off-Market", DIREKT: "Direkt (Verkäuferkontakt)" };

type Option = { id: string; name: string };

export function PropertyForm({
  id,
  initial,
  regions,
  partners,
  referrers,
  sellerLead,
  isAdmin,
  canEdit,
  criteria,
}: {
  criteria: CriterionDef[];
  id?: string;
  initial: PropertyFormInput;
  regions: RegionOption[];
  partners: Option[];
  referrers: Option[];
  sellerLead?: { id: string; name: string } | null;
  isAdmin: boolean;
  canEdit: boolean;
}) {
  const router = useRouter();
  const CRITERIA = criteria;
  const [form, setForm] = useState<PropertyFormInput>(initial);
  const [pending, start] = useTransition();
  const [result, setResult] = useState<SaveResult | null>(null);

  const countries = useMemo(() => Array.from(new Set(regions.map((r) => r.country))).sort(), [regions]);
  const set = <K extends keyof PropertyFormInput>(k: K, v: PropertyFormInput[K]) => setForm((f) => ({ ...f, [k]: v }));
  type NumKey = "price" | "units" | "livingArea" | "adr" | "revenueYear" | "occupancyPct";
  const numeric = (k: NumKey) => ({
    value: (form[k] as number | null | undefined) ?? null,
    onValueChange: (n: number | null) => set(k, n as never),
    decimals: k === "occupancyPct" ? 1 : 0,
    disabled: !canEdit,
  });
  // Entwurf und Warnung bei ungespeicherten Änderungen
  const safety = useFormSafety(id ? `property:${id}` : "property:new", form, setForm, { enabled: canEdit });
  const fieldError = (k: string) => (result && !result.ok ? result.fieldErrors?.[k] : undefined);

  function submit() {
    start(async () => {
      const r = id ? await updatePropertyAction(id, form) : await createPropertyAction(form);
      setResult(r);
      if (r.ok) safety.markSaved(form);
      if (r.ok && !id) router.push(`/objekte/${r.id}?neu=1`);
    });
  }

  const isFewo = form.segment === "FEWO" || form.segment === "APARTMENTHAUS";
  const isHotel = form.segment === "PENSION_HOTEL";

  return (
    <div className="space-y-6">
      {safety.notice}
      {result && !result.ok && <Notice tone="danger">{result.error}</Notice>}
      {result && result.ok && (
        <Notice tone="ok">
          Gespeichert. {result.matches > 0 && `${result.matches} neue Treffer.`} {result.partnerWarning && <span className="text-warn">{result.partnerWarning}</span>}
          {result.duplicates.length > 0 && (
            <div className="mt-1 text-xs">
              Möglicherweise dasselbe Objekt:{" "}
              {result.duplicates.map((d) => (
                <Link key={d.id} href={`/objekte/${d.id}`} className="underline">
                  {d.title}
                </Link>
              ))}
            </div>
          )}
        </Notice>
      )}
      {sellerLead && (
        <Notice tone="brand">
          Off-Market-Objekt aus Verkäuferkontakt <Link href={`/leads/${sellerLead.id}`} className="underline">{sellerLead.name}</Link>. Baax arbeitet auf Käuferseite; bei Wohnungen und Häusern keine Provision vom Verkäufer.
        </Notice>
      )}

      <Field label="Titel" required error={fieldError("title")}>
        <Input value={form.title} disabled={!canEdit} onChange={(e) => set("title", e.target.value)} placeholder="z. B. FeWo mit Meerblick, Port de Pollença" />
      </Field>

      <Field label="Segment" required group>
        <ChipGroup name="Segment" options={entries(SEGMENT_LABEL).map(([value, label]) => ({ value, label }))} value={form.segment as Segment} onChange={(v) => canEdit && set("segment", v)} />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Land" required error={fieldError("country")}>
          <Select value={form.country} disabled={!canEdit} onChange={(e) => { set("country", e.target.value); set("region", ""); }}>
            <option value="">–</option>
            {countries.map((c) => (
              <option key={c} value={c}>
                {COUNTRY_LABEL[c] ?? c}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Region" required error={fieldError("region")}>
          <Select value={form.region} disabled={!canEdit || !form.country} onChange={(e) => set("region", e.target.value)}>
            <option value="">–</option>
            {regions.filter((r) => r.country === form.country).map((r) => (
              <option key={r.key} value={r.key}>
                {r.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Ort">
          <Input value={form.locality ?? ""} disabled={!canEdit} onChange={(e) => set("locality", e.target.value || null)} />
        </Field>
        <Field label="Adresse" hint="nur intern">
          <Input value={form.address ?? ""} disabled={!canEdit} onChange={(e) => set("address", e.target.value || null)} />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Angebotspreis" required error={fieldError("price")}>
          <NumberInput {...numeric("price")} placeholder="z. B. 850.000" />
        </Field>
        <Field label="Währung">
          <Select value={form.currency ?? "EUR"} disabled={!canEdit} onChange={(e) => set("currency", e.target.value)}>
            <option>EUR</option>
            <option>CHF</option>
            <option>GBP</option>
          </Select>
        </Field>
        <Field label={isHotel ? "Zimmer" : "Einheiten"}>
          <NumberInput {...numeric("units")} />
        </Field>
        <Field label="Wohnfläche (m²)">
          <NumberInput {...numeric("livingArea")} />
        </Field>
        {isFewo && (
          <>
            <Field label="Auslastung (%)">
              <NumberInput {...numeric("occupancyPct")} />
            </Field>
            <Field label="Ø Tagespreis (€)">
              <NumberInput {...numeric("adr")} />
            </Field>
          </>
        )}
        {isHotel && (
          <>
            <Field label="Jahresumsatz (€)">
              <NumberInput {...numeric("revenueYear")} />
            </Field>
            <Field label="Auslastung (%)">
              <NumberInput {...numeric("occupancyPct")} />
            </Field>
          </>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={isHotel ? "Konzession / Betriebsgenehmigung" : "Vermietungslizenz"} group>
          <ChipGroup name="Lizenz" options={(Object.keys(LICENSE_STATUS_LABEL) as LicenseStatus[]).map((k) => ({ value: k, label: LICENSE_STATUS_LABEL[k] }))} value={form.licenseStatus as LicenseStatus} onChange={(v) => canEdit && set("licenseStatus", v)} />
        </Field>
        <Field label="Hinweis zur Lizenz">
          <Input value={form.licenseNote ?? ""} disabled={!canEdit} onChange={(e) => set("licenseNote", e.target.value || null)} placeholder="Nummer, Übertragbarkeit, Auflagen" />
        </Field>
      </div>

      <Field label="Ausstattung und Merkmale" group>
        <ChipGroup name="Merkmale" multiple options={CRITERIA.map((c) => ({ value: c.key, label: c.label }))} value={form.features} onChange={(v) => canEdit && set("features", form.features.includes(v) ? form.features.filter((x) => x !== v) : [...form.features, v])} />
      </Field>

      <Field label="Beschreibung">
        <Textarea rows={3} value={form.description ?? ""} disabled={!canEdit} onChange={(e) => set("description", e.target.value || null)} />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Quelle" required>
          <Select value={form.source} disabled={!canEdit} onChange={(e) => set("source", e.target.value as ObjectSource)}>
            {(Object.keys(OBJECT_SOURCE_LABEL) as ObjectSource[]).map((k) => (
              <option key={k} value={k}>
                {OBJECT_SOURCE_LABEL[k]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Quelle Detail" hint="Portal-Link, Name">
          <Input value={form.sourceDetail ?? ""} disabled={!canEdit} onChange={(e) => set("sourceDetail", e.target.value || null)} />
        </Field>
        <Field label="Einreichender Partner" hint="schützt dessen Provisionsanspruch">
          <Select value={form.partnerId ?? ""} disabled={!canEdit} onChange={(e) => set("partnerId", e.target.value || null)}>
            <option value="">–</option>
            {partners.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Tippgeber / Agentur">
          <Select value={form.referrerId ?? ""} disabled={!canEdit} onChange={(e) => set("referrerId", e.target.value || null)}>
            <option value="">–</option>
            {referrers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Checkbox checked={form.offmarket} disabled={!canEdit} onChange={(e) => set("offmarket", e.target.checked)} label="Off-Market (nicht öffentlich angeboten)" />

      <div className="rounded-2xl border border-line bg-canvas p-4">
        <div className="mb-2 text-sm font-semibold text-petrol">Vorkenntnis-Nachweis</div>
        <p className="mb-3 text-xs text-muted">Seit wann kennt Baax das Objekt und woher? Wird beim Anlegen gespeichert und ist danach nur durch Admin mit Protokoll änderbar.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Bekannt seit">
            <Input type="date" value={form.knownSince ?? ""} disabled={Boolean(id) && !isAdmin} onChange={(e) => set("knownSince", e.target.value || null)} />
          </Field>
          <Field label="Woher bekannt">
            <Input value={form.knownSourceNote ?? ""} disabled={Boolean(id) && !isAdmin} onChange={(e) => set("knownSourceNote", e.target.value || null)} placeholder="Partner, Portal-Link, Verkäuferkontakt …" />
          </Field>
        </div>
      </div>

      {canEdit && (
        <Button size="lg" disabled={pending} onClick={submit}>
          {pending ? "Speichere und prüfe Treffer…" : id ? "Objekt speichern" : "Objekt anlegen"}
        </Button>
      )}
    </div>
  );
}
