"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { LeadRole, LeadSource, Segment } from "@prisma/client";
import { BUDGET_BANDS, type LeadInput } from "@/lib/leads";
import { LEAD_ROLE_LABEL, LEAD_SOURCE_LABEL, SEGMENT_LABEL, entries } from "@/lib/labels";
import { addPending, newClientId, submitLead, type SubmitOutcome } from "@/lib/offline-store";
import { Button } from "@/components/ui/button";
import { Checkbox, ChipGroup, Field, Input, Select, Textarea } from "@/components/ui/field";
import { Notice } from "@/components/ui/card";
import { RegionTags } from "./region-tags";
import { usePending } from "./use-pending";

type Props = {
  defaultSource: LeadSource;
  defaultSourceDetail: string;
  regionOptions: Array<{ key: string; name: string; country: string }>;
};

type Feedback =
  | { tone: "ok"; text: string; leadId?: string; duplicates?: Array<{ id: string; name: string }> }
  | { tone: "warn"; text: string }
  | { tone: "danger"; text: string };

const emptyState = (source: LeadSource, sourceDetail: string) => ({
  name: "",
  company: "",
  email: "",
  phone: "",
  role: "KAEUFER" as LeadRole,
  source,
  sourceDetail,
  interest: "",
  segment: null as Segment | null,
  regions: [] as string[],
  budgetBand: null as (typeof BUDGET_BANDS)[number]["key"] | null,
  consentEmail: false,
  note: "",
});

export function LeadForm({ defaultSource, defaultSourceDetail, regionOptions }: Props) {
  const [form, setForm] = useState(() => emptyState(defaultSource, defaultSourceDetail));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [busy, setBusy] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const { count, online, syncing, flush, items } = usePending();

  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));

  function validateLocally(): Record<string, string> {
    const e: Record<string, string> = {};
    if (form.name.trim().length < 2) e.name = "Name fehlt";
    if (!form.phone.trim() && !form.email.trim()) e.phone = "Mindestens Telefon oder E-Mail angeben";
    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) e.email = "E-Mail ungültig";
    return e;
  }

  function reset() {
    setForm(emptyState(defaultSource, defaultSourceDetail));
    setErrors({});
    setShowMore(false);
    requestAnimationFrame(() => nameRef.current?.focus());
  }

  async function onSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    const local = validateLocally();
    if (Object.keys(local).length) {
      setErrors(local);
      return;
    }
    setBusy(true);
    setErrors({});
    setFeedback(null);

    const payload: LeadInput = { ...form, clientId: newClientId() };
    const name = form.name.trim();

    let outcome: SubmitOutcome;
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      outcome = { kind: "network", error: "offline" };
    } else {
      outcome = await submitLead(payload);
    }

    if (outcome.kind === "saved") {
      setFeedback({
        tone: "ok",
        text: outcome.alreadyExisted ? `${name} war bereits gespeichert.` : `${name} gespeichert.`,
        leadId: outcome.id,
        duplicates: outcome.duplicates,
      });
      reset();
    } else if (outcome.kind === "invalid") {
      setErrors(outcome.errors);
      setShowMore(true);
    } else if (outcome.kind === "unauthorized") {
      setFeedback({ tone: "danger", text: "Sitzung abgelaufen. Bitte neu anmelden; die Eingabe bleibt erhalten." });
    } else {
      // Kein Netz: lokal puffern, Formular leeren, Hinweis zeigen.
      try {
        await addPending({ clientId: payload.clientId!, payload, createdAt: Date.now(), attempts: 0 });
        setFeedback({ tone: "warn", text: `${name} zwischengespeichert – wird gesendet, sobald Verbindung besteht.` });
        reset();
      } catch {
        setFeedback({ tone: "danger", text: "Keine Verbindung und kein lokaler Speicher verfügbar. Bitte später erneut speichern." });
      }
    }
    setBusy(false);
  }

  const failedItems = items.filter((i) => i.attempts > 0 && i.lastError && !/offline|Netz|fetch|Server|abort/i.test(i.lastError));

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      {(count > 0 || !online) && (
        <Notice tone={online ? "warn" : "danger"}>
          <div className="flex items-center justify-between gap-3">
            <span>
              {!online && "Keine Verbindung. "}
              {count > 0 ? `${count} ${count === 1 ? "Kontakt wartet" : "Kontakte warten"} auf Übertragung.` : "Erfassung wird lokal gespeichert."}
            </span>
            {count > 0 && online && (
              <Button type="button" size="sm" variant="secondary" onClick={() => void flush()} disabled={syncing}>
                {syncing ? "Sende…" : "Jetzt senden"}
              </Button>
            )}
          </div>
          {failedItems.length > 0 && (
            <ul className="mt-2 list-disc pl-5 text-xs">
              {failedItems.map((i) => (
                <li key={i.clientId}>
                  {i.payload.name}: {i.lastError}
                </li>
              ))}
            </ul>
          )}
        </Notice>
      )}

      {feedback && (
        <Notice tone={feedback.tone}>
          <div>{feedback.text}</div>
          {feedback.tone === "ok" && feedback.duplicates && feedback.duplicates.length > 0 && (
            <div className="mt-1 text-xs">
              Möglicherweise bereits bekannt:{" "}
              {feedback.duplicates.map((d, i) => (
                <span key={d.id}>
                  {i > 0 && ", "}
                  <Link href={`/leads/${d.id}`} className="underline">
                    {d.name}
                  </Link>
                </span>
              ))}
              {feedback.leadId && (
                <>
                  {" · "}
                  <Link href={`/leads/${feedback.leadId}`} className="underline">
                    Lead öffnen
                  </Link>
                </>
              )}
            </div>
          )}
        </Notice>
      )}

      <Field label="Name" required error={errors.name}>
        <Input ref={nameRef} name="name" autoComplete="off" autoCapitalize="words" enterKeyHint="next" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Vor- und Nachname" />
      </Field>

      <Field label="Rolle" required group>
        <ChipGroup name="Rolle" options={entries(LEAD_ROLE_LABEL).map(([value, label]) => ({ value, label }))} value={form.role} onChange={(v) => set("role", v)} />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Telefon" hint="Telefon oder E-Mail" error={errors.phone}>
          <Input name="phone" type="tel" inputMode="tel" autoComplete="off" value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+49 …" />
        </Field>
        <Field label="E-Mail" error={errors.email}>
          <Input name="email" type="email" inputMode="email" autoComplete="off" autoCapitalize="none" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="name@firma.de" />
        </Field>
      </div>

      <Field label="Interesse" hint="Was sucht oder bietet die Person?" error={errors.interest}>
        <Textarea name="interest" rows={2} value={form.interest} onChange={(e) => set("interest", e.target.value)} placeholder="z. B. FeWo Mallorca Nord, Rendite, bis 800 T€" />
      </Field>

      <Field label="Budget grob" group>
        <ChipGroup name="Budget" options={BUDGET_BANDS.map((b) => ({ value: b.key, label: b.label }))} value={form.budgetBand} onChange={(v) => set("budgetBand", form.budgetBand === v ? null : v)} />
      </Field>

      <Checkbox
        name="consentEmail"
        checked={form.consentEmail}
        onChange={(e) => set("consentEmail", e.target.checked)}
        label={
          <>
            <span className="font-medium">Einwilligung E-Mail-Kontakt</span>
            <span className="block text-xs text-muted">Die Person ist einverstanden, von Baax per E-Mail kontaktiert zu werden. Zeitstempel wird gespeichert.</span>
          </>
        }
      />

      <button type="button" onClick={() => setShowMore((s) => !s)} className="text-sm font-medium text-brand-strong">
        {showMore ? "Weniger Felder" : "Mehr Felder (Firma, Segment, Regionen, Notiz, Quelle)"}
      </button>

      {showMore && (
        <div className="space-y-5 rounded-2xl border border-line bg-canvas p-4">
          <Field label="Firma" error={errors.company}>
            <Input name="company" value={form.company} onChange={(e) => set("company", e.target.value)} />
          </Field>
          <Field label="Segment" group>
            <ChipGroup name="Segment" options={entries(SEGMENT_LABEL).map(([value, label]) => ({ value, label }))} value={form.segment} onChange={(v) => set("segment", form.segment === v ? null : v)} />
          </Field>
          <Field label="Regionen" hint="Vorschläge oder Freitext" group>
            <RegionTags value={form.regions} onChange={(v) => set("regions", v)} options={regionOptions} />
          </Field>
          <Field label="Notiz" error={errors.note}>
            <Textarea name="note" rows={3} value={form.note} onChange={(e) => set("note", e.target.value)} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Quelle" error={errors.source}>
              <Select name="source" value={form.source} onChange={(e) => set("source", e.target.value as LeadSource)}>
                {entries(LEAD_SOURCE_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Quelle Detail" error={errors.sourceDetail}>
              <Input name="sourceDetail" value={form.sourceDetail} onChange={(e) => set("sourceDetail", e.target.value)} placeholder="z. B. SuperStay LIVE 2026" />
            </Field>
          </div>
        </div>
      )}

      <div className="sticky bottom-20 z-10 pt-2 md:static">
        <Button type="submit" size="lg" disabled={busy}>
          {busy ? "Speichere…" : "Speichern und nächsten Kontakt"}
        </Button>
        <p className="mt-2 text-center text-xs text-muted">
          Quelle: {LEAD_SOURCE_LABEL[form.source]}
          {form.sourceDetail ? ` – ${form.sourceDetail}` : ""}
        </p>
      </div>
    </form>
  );
}
