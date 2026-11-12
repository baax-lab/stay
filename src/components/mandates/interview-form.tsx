"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Segment, UsageGoal } from "@prisma/client";
import { ASSESSMENT_OPTIONS, INTERVIEW_QUESTIONS } from "@/lib/interview";
import type { CriterionDef } from "@/lib/criteria";
import { SEGMENT_LABEL, entries } from "@/lib/labels";
import { USAGE_GOAL_LABEL } from "@/lib/mandates";
import { saveInterviewAction, saveProfileAction, type ProfileInput } from "@/app/(app)/auftraege/actions";
import { Button } from "@/components/ui/button";
import { ChipGroup, Field, Input, Textarea } from "@/components/ui/field";
import { Notice } from "@/components/ui/card";
import { COUNTRY_LABEL, type RegionOption } from "./profile-form";

type Notes = Record<string, unknown>;

export function InterviewForm({ mandateId, initial, assessment, regions, canEdit, profile, criteria }: { mandateId: string; initial: Notes; assessment: string | null; regions: RegionOption[]; canEdit: boolean; profile: ProfileInput; criteria: CriterionDef[] }) {
  const CRITERIA = criteria;
  const router = useRouter();
  const [notes, setNotes] = useState<Notes>(initial);
  const [assess, setAssess] = useState<string | null>(assessment);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const get = <T,>(k: string, fallback: T): T => (notes[k] === undefined ? fallback : (notes[k] as T));
  const set = (k: string, v: unknown) => setNotes((n) => ({ ...n, [k]: v }));
  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const countries = Array.from(new Set(regions.map((r) => r.country))).sort();

  function save(thenProfile: boolean) {
    start(async () => {
      const r = await saveInterviewAction(mandateId, notes, assess);
      if (!r.ok) return setMsg({ ok: false, text: r.error });
      if (!thenProfile) return setMsg({ ok: true, text: "Erstgespräch gespeichert." });

      // Suchprofil aus den Antworten vorbefüllen (Konzept §8.14)
      const budget = get<{ min?: number | null; max?: number | null }>("budget", {});
      const units = get<{ min?: number | null; max?: number | null }>("units", {});
      const input: ProfileInput = {
        ...profile,
        segments: get<Segment[]>("segment", profile.segments),
        usageGoal: get<UsageGoal>("goal", profile.usageGoal),
        priceMin: budget.min ?? profile.priceMin,
        priceMax: budget.max ?? profile.priceMax,
        countries: get<string[]>("countries", profile.countries),
        regions: get<string[]>("regions", profile.regions),
        minUnits: units.min ?? profile.minUnits,
        maxUnits: units.max ?? profile.maxUnits,
        licenseRequired: get<boolean>("license", profile.licenseRequired),
        mustCriteria: get<string[]>("must", profile.mustCriteria),
        wishCriteria: get<Array<{ key: string; weight: number }>>("wish", profile.wishCriteria),
        financing: get<string>("equity", "") || profile.financing,
        horizon: get<string>("horizon", "") || profile.horizon,
        active: true,
      };
      const p = await saveProfileAction(mandateId, input);
      if (!p.ok) return setMsg({ ok: false, text: p.error });
      router.push(`/auftraege/${mandateId}?tab=profil`);
    });
  }

  const numPair = (k: string, labels: [string, string]) => {
    const v = get<{ min?: number | null; max?: number | null }>(k, {});
    const on = (part: "min" | "max") => (e: React.ChangeEvent<HTMLInputElement>) => {
      const d = e.target.value.replace(/[^\d]/g, "");
      set(k, { ...v, [part]: d ? Number(d) : null });
    };
    return (
      <div className="grid grid-cols-2 gap-3">
        <Field label={labels[0]}>
          <Input inputMode="numeric" disabled={!canEdit} value={v.min ?? ""} onChange={on("min")} />
        </Field>
        <Field label={labels[1]}>
          <Input inputMode="numeric" disabled={!canEdit} value={v.max ?? ""} onChange={on("max")} />
        </Field>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {msg && <Notice tone={msg.ok ? "ok" : "danger"}>{msg.text}</Notice>}
      {INTERVIEW_QUESTIONS.map((q) => (
        <div key={q.key} className="rounded-2xl border border-line bg-surface p-4">
          <div className="mb-2">
            <div className="font-medium text-petrol">{q.label}</div>
            <div className="text-xs text-muted">{q.hint}</div>
          </div>
          {q.type === "usageGoal" && <ChipGroup name={q.label} options={Object.entries(USAGE_GOAL_LABEL).map(([value, label]) => ({ value, label }))} value={get<string | null>(q.key, null)} onChange={(v) => canEdit && set(q.key, v)} />}
          {q.type === "segments" && <ChipGroup name={q.label} multiple options={entries(SEGMENT_LABEL).map(([value, label]) => ({ value, label }))} value={get<Segment[]>(q.key, [])} onChange={(v) => canEdit && set(q.key, toggle(get<Segment[]>(q.key, []), v))} />}
          {q.type === "priceRange" && numPair("budget", ["von (€)", "bis (€)"])}
          {q.type === "unitsRange" && numPair("units", ["von", "bis"])}
          {q.type === "text" && <Textarea rows={2} disabled={!canEdit} value={get<string>(q.key, "")} onChange={(e) => set(q.key, e.target.value)} />}
          {q.type === "boolean" && <ChipGroup name={q.label} options={[{ value: "ja", label: "Ja, Pflicht" }, { value: "nein", label: "Nicht zwingend" }]} value={get<boolean | null>(q.key, null) === null ? null : get<boolean>(q.key, true) ? "ja" : "nein"} onChange={(v) => canEdit && set(q.key, v === "ja")} />}
          {q.type === "regions" && (
            <div className="space-y-3">
              <ChipGroup name="Länder" multiple options={countries.map((c) => ({ value: c, label: COUNTRY_LABEL[c] ?? c }))} value={get<string[]>("countries", [])} onChange={(v) => canEdit && set("countries", toggle(get<string[]>("countries", []), v))} />
              {get<string[]>("countries", []).map((c) => (
                <ChipGroup key={c} name={`Regionen ${c}`} multiple options={regions.filter((r) => r.country === c).map((r) => ({ value: r.key, label: r.name }))} value={get<string[]>("regions", [])} onChange={(v) => canEdit && set("regions", toggle(get<string[]>("regions", []), v))} />
              ))}
            </div>
          )}
          {q.type === "criteria" && <ChipGroup name={q.label} multiple options={CRITERIA.map((c) => ({ value: c.key, label: c.label }))} value={get<string[]>(q.key, [])} onChange={(v) => canEdit && set(q.key, toggle(get<string[]>(q.key, []), v))} />}
          {q.type === "criteriaWeighted" && (
            <div className="flex flex-wrap gap-2">
              {CRITERIA.filter((c) => !get<string[]>("must", []).includes(c.key)).map((c) => {
                const list = get<Array<{ key: string; weight: number }>>("wish", []);
                const w = list.find((x) => x.key === c.key)?.weight ?? 0;
                return (
                  <button
                    key={c.key}
                    type="button"
                    disabled={!canEdit}
                    onClick={() => {
                      const next = (w + 1) % 4;
                      const others = list.filter((x) => x.key !== c.key);
                      set("wish", next ? [...others, { key: c.key, weight: next }] : others);
                    }}
                    className={"rounded-full border px-3 py-1.5 text-sm " + (w ? "border-brand bg-brand text-petrol" : "border-line bg-surface")}
                  >
                    {c.label}
                    {w ? ` · ${w}` : ""}
                  </button>
                );
              })}
              <p className="w-full text-xs text-muted">Klick erhöht das Gewicht (1 → 2 → 3 → aus).</p>
            </div>
          )}
        </div>
      ))}

      <div className="rounded-2xl border border-line bg-surface p-4">
        <div className="mb-2 font-medium text-petrol">Einschätzung</div>
        <ChipGroup name="Einschätzung" options={ASSESSMENT_OPTIONS.map((o) => ({ value: o.value, label: o.label }))} value={assess} onChange={(v) => canEdit && setAssess(v)} />
      </div>

      {canEdit && (
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" disabled={pending} onClick={() => save(false)}>
            Erstgespräch speichern
          </Button>
          <Button disabled={pending} onClick={() => save(true)}>
            Speichern und Suchprofil daraus anlegen
          </Button>
        </div>
      )}
    </div>
  );
}
