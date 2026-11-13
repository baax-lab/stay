"use client";

import { useState } from "react";
import type { LeadRole, Segment } from "@prisma/client";
import { BUDGET_BANDS } from "@/lib/leads";
import { t, type Lang } from "@/lib/i18n";
import { CONTACT_CHANNELS, FINANCING_OPTIONS, TIME_HORIZONS, type ContactChannel, type Financing, type TimeHorizon } from "@/lib/form-options";
import { Button } from "@/components/ui/button";
import { Checkbox, ChipGroup, Field, Input, Textarea } from "@/components/ui/field";
import { Notice } from "@/components/ui/card";

const PUBLIC_ROLES: LeadRole[] = ["KAEUFER", "VERKAEUFER", "PARTNER", "MULTIPLIKATOR"];
const SEGMENTS: Segment[] = ["FEWO", "APARTMENTHAUS", "PENSION_HOTEL"];

export type RegionChoice = { name: string; country: string; countryLabel: string };

/**
 * Öffentliches Interessenformular (QR-Code, Website), Deutsch und Englisch.
 * Die Angaben ergeben beim Umwandeln in einen Suchauftrag einen Vorschlag für das Suchprofil.
 */
export function InterestForm({ q, lang, regions }: { q: string | null; lang: Lang; regions: RegionChoice[] }) {
  const tr = (k: string, vars?: Record<string, string>) => t(lang, `interest.${k}`, vars);
  const [role, setRole] = useState<LeadRole>("KAEUFER");
  const [budget, setBudget] = useState<string | null>(null);
  const [segment, setSegment] = useState<Segment | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [horizon, setHorizon] = useState<TimeHorizon | null>(null);
  const [financing, setFinancing] = useState<Financing | null>(null);
  const [channel, setChannel] = useState<ContactChannel | null>(null);
  const [state, setState] = useState<{ kind: "idle" } | { kind: "busy" } | { kind: "done" } | { kind: "error"; message: string; errors?: Record<string, string> }>({ kind: "idle" });
  const startedAt = useState(() => Date.now())[0];
  const buyer = role === "KAEUFER";
  const withProperty = role === "KAEUFER" || role === "VERKAEUFER";

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const other = String(fd.get("region") ?? "");
    const payload = {
      q,
      lang,
      name: String(fd.get("name") ?? ""),
      email: String(fd.get("email") ?? ""),
      phone: String(fd.get("phone") ?? ""),
      role,
      interest: String(fd.get("interest") ?? ""),
      // ausgewählte Regionen und Freitext („Südtirol, Gardasee“)
      region: [...(withProperty ? picked : []), other].filter(Boolean).join(", "),
      budgetBand: withProperty ? budget : null,
      segment: withProperty ? segment : null,
      timeHorizon: buyer ? horizon : null,
      financing: buyer ? financing : null,
      contactChannel: channel,
      consent: fd.get("consent") === "on",
      website: String(fd.get("website") ?? ""), // Honeypot
      elapsedMs: Date.now() - startedAt,
    };
    setState({ kind: "busy" });
    try {
      const res = await fetch("/api/public/interesse", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      if (res.ok) {
        setState({ kind: "done" });
        return;
      }
      const data = (await res.json().catch(() => ({}))) as { errors?: Record<string, string> };
      // Fehler je Feld in der Sprache der Seite
      const errors: Record<string, string> = {};
      for (const k of Object.keys(data.errors ?? {})) errors[k] = ["name", "email", "consent"].includes(k) ? tr(`err_${k}`) : tr("error_check");
      setState({ kind: "error", message: res.status === 429 ? tr("error_rate") : res.status === 422 ? tr("error_check") : tr("error_generic"), errors });
    } catch {
      setState({ kind: "error", message: tr("error_offline") });
    }
  }

  if (state.kind === "done") {
    return (
      <Notice tone="ok">
        <div className="font-medium">{tr("thanks")}</div>
        <div className="mt-1">{tr("thanks_text")}</div>
      </Notice>
    );
  }

  const errors = state.kind === "error" ? (state.errors ?? {}) : {};
  const countries = Array.from(new Map(regions.map((r) => [r.country, r.countryLabel])).entries());

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      {state.kind === "error" && <Notice tone="danger">{state.message}</Notice>}

      <Field label={tr("i_am")} required group>
        <ChipGroup name={tr("i_am")} options={PUBLIC_ROLES.map((r) => ({ value: r, label: tr(`role_${r}`) }))} value={role} onChange={setRole} />
        <p className="mt-1.5 text-xs text-muted">{tr(`hint_${role}`)}</p>
      </Field>

      <Field label={tr("name")} required error={errors.name}>
        <Input name="name" autoComplete="name" required />
      </Field>
      <Field label={tr("email")} required error={errors.email}>
        <Input name="email" type="email" autoComplete="email" inputMode="email" required />
      </Field>
      <Field label={tr("phone")} hint={tr("optional")} error={errors.phone}>
        <Input name="phone" type="tel" autoComplete="tel" inputMode="tel" />
      </Field>

      {withProperty && (
        <Field label={tr("property_type")} hint={tr("optional")} group>
          <ChipGroup name={tr("property_type")} options={SEGMENTS.map((s) => ({ value: s, label: t(lang, `segment.${s}`) }))} value={segment} onChange={(v) => setSegment(segment === v ? null : v)} />
        </Field>
      )}

      <Field label={role === "VERKAEUFER" ? tr("what_offer") : tr("what_seek")} hint={tr("optional")} error={errors.interest}>
        <Textarea name="interest" rows={3} placeholder={role === "VERKAEUFER" ? tr("placeholder_offer") : tr("placeholder_seek")} />
      </Field>

      {withProperty && regions.length > 0 && (
        <Field label={role === "VERKAEUFER" ? tr("where_offer") : tr("where")} hint={tr("optional")} group>
          <div className="space-y-3">
            {countries.map(([code, label]) => (
              <div key={code}>
                <div className="eyebrow mb-1.5">{label}</div>
                <ChipGroup
                  name={label}
                  multiple
                  options={regions.filter((r) => r.country === code).map((r) => ({ value: r.name, label: r.name }))}
                  value={picked}
                  onChange={(v) => setPicked(picked.includes(v) ? picked.filter((x) => x !== v) : [...picked, v])}
                />
              </div>
            ))}
          </div>
        </Field>
      )}
      <Field label={tr("other_region")} hint={tr("optional")} error={errors.region}>
        <Input name="region" placeholder={tr("other_region_placeholder")} />
      </Field>

      {withProperty && (
        <Field label={role === "VERKAEUFER" ? tr("price_idea") : tr("budget")} hint={tr("optional")} group>
          <ChipGroup name={tr("budget")} options={BUDGET_BANDS.map((b) => ({ value: b.key, label: tr(`budget_${b.key}`) }))} value={budget} onChange={(v) => setBudget(budget === v ? null : v)} />
        </Field>
      )}

      {buyer && (
        <>
          <Field label={tr("horizon")} hint={tr("optional")} group>
            <ChipGroup name={tr("horizon")} options={TIME_HORIZONS.map((h) => ({ value: h, label: t(lang, `options.time_horizon.${h}`) }))} value={horizon} onChange={(v) => setHorizon(horizon === v ? null : v)} />
          </Field>
          <Field label={tr("financing")} hint={tr("optional")} group>
            <ChipGroup name={tr("financing")} options={FINANCING_OPTIONS.map((f) => ({ value: f, label: t(lang, `options.financing.${f}`) }))} value={financing} onChange={(v) => setFinancing(financing === v ? null : v)} />
          </Field>
        </>
      )}

      <Field label={tr("channel")} hint={tr("optional")} group>
        <ChipGroup name={tr("channel")} options={CONTACT_CHANNELS.map((c) => ({ value: c, label: t(lang, `options.contact_channel.${c}`) }))} value={channel} onChange={(v) => setChannel(channel === v ? null : v)} />
      </Field>

      {/* Honeypot: für Menschen unsichtbar, Bots füllen es aus */}
      <div className="absolute -left-[9999px] h-0 w-0 overflow-hidden" aria-hidden>
        <label>
          Website <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <Checkbox
        name="consent"
        required
        label={
          <>
            {tr("consent")}{" "}
            <a href="/datenschutz" target="_blank" className="underline">
              {tr("privacy")}
            </a>
            <span className="text-danger"> *</span>
          </>
        }
      />
      {errors.consent && <p className="text-sm text-danger">{errors.consent}</p>}

      <Button type="submit" size="lg" disabled={state.kind === "busy"}>
        {state.kind === "busy" ? tr("sending") : tr("submit")}
      </Button>
    </form>
  );
}
