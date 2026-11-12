"use client";

import { useMemo, useState, useTransition } from "react";
import type { Segment, UsageGoal } from "@prisma/client";
import type { CriterionDef } from "@/lib/criteria";
import { SEGMENT_LABEL, entries } from "@/lib/labels";
import { USAGE_GOAL_LABEL } from "@/lib/mandates";
import { saveProfileAction, type ProfileInput } from "@/app/(app)/auftraege/actions";
import { Button } from "@/components/ui/button";
import { Checkbox, ChipGroup, Field, Input, Textarea } from "@/components/ui/field";
import { Notice } from "@/components/ui/card";
import { cn } from "@/lib/cn";

export type RegionOption = { key: string; name: string; country: string; focus: boolean };

export const COUNTRY_LABEL: Record<string, string> = {
  DE: "Deutschland",
  AT: "Österreich",
  IT: "Italien",
  ES: "Spanien",
  PT: "Portugal",
  FR: "Frankreich",
  CH: "Schweiz",
  HR: "Kroatien",
  GR: "Griechenland",
};

export function ProfileForm({ mandateId, initial, regions, canEdit, criteria }: { mandateId: string; initial: ProfileInput; regions: RegionOption[]; canEdit: boolean; criteria: CriterionDef[] }) {
  const CRITERIA = criteria;
  const [form, setForm] = useState<ProfileInput>(initial);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const countries = useMemo(() => Array.from(new Set(regions.map((r) => r.country))).sort(), [regions]);
  const set = <K extends keyof ProfileInput>(k: K, v: ProfileInput[K]) => setForm((f) => ({ ...f, [k]: v }));
  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  const wishWeight = (key: string) => form.wishCriteria.find((w) => w.key === key)?.weight ?? 0;
  function setWish(key: string, weight: number) {
    const others = form.wishCriteria.filter((w) => w.key !== key);
    set("wishCriteria", weight > 0 ? [...others, { key, weight }] : others);
  }

  function submit() {
    start(async () => {
      const r = await saveProfileAction(mandateId, form);
      setMsg(r.ok ? { ok: true, text: r.message ?? "Gespeichert." } : { ok: false, text: r.error });
    });
  }

  const numInput = (k: "priceMin" | "priceMax" | "minUnits" | "maxUnits") => ({
    value: form[k] ?? "",
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = e.target.value.replace(/[^\d]/g, "");
      set(k, v ? Number(v) : null);
    },
    inputMode: "numeric" as const,
    disabled: !canEdit,
  });

  return (
    <div className="space-y-6">
      {msg && <Notice tone={msg.ok ? "ok" : "danger"}>{msg.text}</Notice>}

      <Field label="Segmente" group>
        <ChipGroup name="Segmente" multiple options={entries(SEGMENT_LABEL).map(([value, label]) => ({ value, label }))} value={form.segments as Segment[]} onChange={(v) => canEdit && set("segments", toggle(form.segments, v))} />
      </Field>

      <Field label="Länder" group>
        <ChipGroup name="Länder" multiple options={countries.map((c) => ({ value: c, label: COUNTRY_LABEL[c] ?? c }))} value={form.countries} onChange={(v) => canEdit && set("countries", toggle(form.countries, v))} />
      </Field>

      {form.countries.length > 0 && (
        <Field label="Regionen" hint="leer = ganzes Land" group>
          <div className="space-y-3">
            {form.countries.map((c) => (
              <div key={c}>
                <div className="mb-1 text-xs font-medium text-muted">{COUNTRY_LABEL[c] ?? c}</div>
                <ChipGroup
                  name={`Regionen ${c}`}
                  multiple
                  options={regions.filter((r) => r.country === c).map((r) => ({ value: r.key, label: r.name }))}
                  value={form.regions}
                  onChange={(v) => canEdit && set("regions", toggle(form.regions, v))}
                />
              </div>
            ))}
          </div>
        </Field>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Preis von (€)">
          <Input {...numInput("priceMin")} placeholder="optional" />
        </Field>
        <Field label="Preis bis (€)" required>
          <Input {...numInput("priceMax")} />
        </Field>
        <Field label="Nutzungsziel" group>
          <ChipGroup name="Nutzungsziel" options={Object.entries(USAGE_GOAL_LABEL).map(([value, label]) => ({ value: value as UsageGoal, label }))} value={form.usageGoal} onChange={(v) => canEdit && set("usageGoal", v)} />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Einheiten / Zimmer von">
            <Input {...numInput("minUnits")} />
          </Field>
          <Field label="bis">
            <Input {...numInput("maxUnits")} />
          </Field>
        </div>
      </div>

      <Checkbox checked={form.licenseRequired} disabled={!canEdit} onChange={(e) => set("licenseRequired", e.target.checked)} label="Vermietungslizenz erforderlich (Objekte mit roter Ampel nur als „knapp daneben“)" />

      <div>
        <div className="mb-2 text-sm font-medium text-petrol">Kriterien</div>
        <p className="mb-3 text-xs text-muted">Muss = Pflicht für einen Treffer. Wunsch mit Gewicht 1–3 erhöht den Punktwert.</p>
        <div className="overflow-hidden rounded-2xl border border-line">
          <table className="w-full text-sm">
            <thead className="bg-canvas text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-3 py-2 text-left">Kriterium</th>
                <th className="px-3 py-2">Muss</th>
                <th className="px-3 py-2">Wunsch 1</th>
                <th className="px-3 py-2">Wunsch 2</th>
                <th className="px-3 py-2">Wunsch 3</th>
              </tr>
            </thead>
            <tbody>
              {CRITERIA.map((c) => {
                const must = form.mustCriteria.includes(c.key);
                const w = wishWeight(c.key);
                return (
                  <tr key={c.key} className="border-t border-line">
                    <td className="px-3 py-2">
                      {c.label} <span className="text-xs text-muted">{c.group}</span>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <input type="checkbox" className="h-4 w-4 accent-brand-strong" disabled={!canEdit} checked={must} onChange={(e) => {
                        set("mustCriteria", e.target.checked ? [...form.mustCriteria, c.key] : form.mustCriteria.filter((k) => k !== c.key));
                        if (e.target.checked) setWish(c.key, 0);
                      }} />
                    </td>
                    {[1, 2, 3].map((n) => (
                      <td key={n} className="px-3 py-2 text-center">
                        <input type="radio" name={`wish-${c.key}`} className="h-4 w-4 accent-brand-strong" disabled={!canEdit || must} checked={w === n} onChange={() => setWish(c.key, n)} onClick={() => w === n && setWish(c.key, 0)} />
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Eigenkapital und Finanzierung">
          <Textarea rows={2} disabled={!canEdit} value={form.financing ?? ""} onChange={(e) => set("financing", e.target.value || null)} />
        </Field>
        <Field label="Zeithorizont">
          <Input disabled={!canEdit} value={form.horizon ?? ""} onChange={(e) => set("horizon", e.target.value || null)} />
        </Field>
      </div>

      <Checkbox checked={form.active} disabled={!canEdit} onChange={(e) => set("active", e.target.checked)} label="Suchprofil aktiv (nimmt am Matching teil)" />

      {canEdit && (
        <Button onClick={submit} disabled={pending} className={cn(pending && "opacity-60")}>
          {pending ? "Speichere und prüfe Treffer…" : "Suchprofil speichern und Treffer berechnen"}
        </Button>
      )}
    </div>
  );
}
