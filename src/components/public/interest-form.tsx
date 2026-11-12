"use client";

import { useState } from "react";
import type { LeadRole } from "@prisma/client";
import { BUDGET_BANDS } from "@/lib/leads";
import { LEAD_ROLE_LABEL } from "@/lib/labels";
import { Button } from "@/components/ui/button";
import { Checkbox, ChipGroup, Field, Input, Textarea } from "@/components/ui/field";
import { Notice } from "@/components/ui/card";

const PUBLIC_ROLES: LeadRole[] = ["KAEUFER", "VERKAEUFER", "PARTNER", "MULTIPLIKATOR"];
const ROLE_HINT: Record<LeadRole, string> = {
  KAEUFER: "Ich suche eine Immobilie",
  VERKAEUFER: "Ich biete eine Immobilie an",
  PARTNER: "Ich bin Makler, Anwalt, Finanzierer o. Ä.",
  MULTIPLIKATOR: "Ich kann Kontakte vermitteln",
};

export function InterestForm({ q }: { q: string | null }) {
  const [role, setRole] = useState<LeadRole>("KAEUFER");
  const [budget, setBudget] = useState<string | null>(null);
  const [state, setState] = useState<{ kind: "idle" } | { kind: "busy" } | { kind: "done" } | { kind: "error"; message: string; errors?: Record<string, string> }>({ kind: "idle" });
  const startedAt = useState(() => Date.now())[0];

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const payload = {
      q,
      name: String(fd.get("name") ?? ""),
      email: String(fd.get("email") ?? ""),
      phone: String(fd.get("phone") ?? ""),
      role,
      interest: String(fd.get("interest") ?? ""),
      region: String(fd.get("region") ?? ""),
      budgetBand: budget,
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
      const data = (await res.json().catch(() => ({}))) as { error?: string; errors?: Record<string, string> };
      setState({ kind: "error", message: data.error ?? "Senden fehlgeschlagen. Bitte später erneut versuchen.", errors: data.errors });
    } catch {
      setState({ kind: "error", message: "Keine Verbindung. Bitte später erneut versuchen." });
    }
  }

  if (state.kind === "done") {
    return (
      <Notice tone="ok">
        <div className="font-medium">Vielen Dank!</div>
        <div className="mt-1">Wir haben Ihre Nachricht erhalten und melden uns in Kürze persönlich.</div>
      </Notice>
    );
  }

  const errors = state.kind === "error" ? state.errors ?? {} : {};

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      {state.kind === "error" && <Notice tone="danger">{state.message}</Notice>}

      <Field label="Ich bin …" required group>
        <ChipGroup name="Rolle" options={PUBLIC_ROLES.map((r) => ({ value: r, label: LEAD_ROLE_LABEL[r] }))} value={role} onChange={setRole} />
        <p className="mt-1.5 text-xs text-muted">{ROLE_HINT[role]}</p>
      </Field>

      <Field label="Name" required error={errors.name}>
        <Input name="name" autoComplete="name" required />
      </Field>
      <Field label="E-Mail" required error={errors.email}>
        <Input name="email" type="email" autoComplete="email" inputMode="email" required />
      </Field>
      <Field label="Telefon" hint="optional" error={errors.phone}>
        <Input name="phone" type="tel" autoComplete="tel" inputMode="tel" />
      </Field>
      <Field label={role === "VERKAEUFER" ? "Was bieten Sie an?" : "Was suchen Sie?"} hint="optional" error={errors.interest}>
        <Textarea name="interest" rows={3} placeholder={role === "VERKAEUFER" ? "z. B. Apartmenthaus mit 6 Einheiten am Gardasee" : "z. B. Ferienwohnung auf Mallorca, zur Vermietung, mit Pool"} />
      </Field>
      <Field label="Region" hint="optional" error={errors.region}>
        <Input name="region" placeholder="z. B. Mallorca, Südtirol, Allgäu" />
      </Field>
      {role !== "PARTNER" && role !== "MULTIPLIKATOR" && (
        <Field label={role === "VERKAEUFER" ? "Preisvorstellung" : "Budget"} hint="optional" group>
          <ChipGroup name="Budget" options={BUDGET_BANDS.map((b) => ({ value: b.key, label: b.label }))} value={budget} onChange={(v) => setBudget(budget === v ? null : v)} />
        </Field>
      )}

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
            Ich bin einverstanden, dass die Baax Immobilien GmbH meine Angaben speichert und mich per E-Mail oder Telefon zu meiner Anfrage kontaktiert. Die Einwilligung kann ich jederzeit widerrufen.{" "}
            <a href="/datenschutz" target="_blank" className="underline">
              Datenschutzhinweise
            </a>
            <span className="text-danger"> *</span>
          </>
        }
      />
      {errors.consent && <p className="text-sm text-danger">{errors.consent}</p>}

      <Button type="submit" size="lg" disabled={state.kind === "busy"}>
        {state.kind === "busy" ? "Sende…" : "Absenden"}
      </Button>
    </form>
  );
}
