"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { LeadRole, LeadSource, Segment } from "@prisma/client";
import { BUDGET_BANDS } from "@/lib/leads";
import { LEAD_ROLE_LABEL, LEAD_SOURCE_LABEL, SEGMENT_LABEL, entries } from "@/lib/labels";
import { addPending, newClientId, submitLead, type LeadPayload, type SubmitOutcome } from "@/lib/offline-store";
import { compressImage } from "@/lib/image-compress";
import { CONTACT_CHANNELS, CONTACT_CHANNEL_LABEL, FINANCING_LABEL, FINANCING_OPTIONS, LEAD_LANGUAGES, TIME_HORIZONS, TIME_HORIZON_LABEL, type ContactChannel, type Financing, type LeadLanguage, type TimeHorizon } from "@/lib/form-options";
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
  language: null as LeadLanguage | null,
  callbackAt: "", // datetime-local (Ortszeit)
  contactChannel: null as ContactChannel | null,
  timeHorizon: null as TimeHorizon | null,
  financing: null as Financing | null,
  cardImage: null as string | null, // verkleinertes Foto als data:-Adresse
});

/** Wert für datetime-local in Ortszeit, z. B. heute 17:00 oder morgen 10:00 */
function localSlot(daysAhead: number, hour: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  d.setHours(hour, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function LeadForm({ defaultSource, defaultSourceDetail, regionOptions }: Props) {
  const [form, setForm] = useState(() => emptyState(defaultSource, defaultSourceDetail));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [busy, setBusy] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
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

    // Rückruftermin mit Zeitzone senden, damit der Server ihn richtig einordnet
    const payload: LeadPayload = { ...form, callbackAt: form.callbackAt ? new Date(form.callbackAt).toISOString() : null, clientId: newClientId() };
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

      {/* Visitenkarte: Foto statt Abtippen, wird mit dem Kontakt gespeichert (auch offline) */}
      {form.cardImage ? (
        <div className="flex items-center gap-3 rounded-xl border border-line-strong/50 bg-surface-solid/70 p-2">
          {/* eslint-disable-next-line @next/next/no-img-element -- data:-Vorschau ohne Next-Bildoptimierung */}
          <img src={form.cardImage} alt="Visitenkarte" className="h-16 w-24 rounded-md object-cover" />
          <div className="flex-1 text-sm">
            <div className="font-medium">Visitenkarte aufgenommen</div>
            <div className="text-xs text-muted">Wird mit dem Kontakt gespeichert. Name und Telefon bitte trotzdem kurz eintragen.</div>
          </div>
          <Button type="button" size="sm" variant="ghost" onClick={() => set("cardImage", null)}>
            Entfernen
          </Button>
        </div>
      ) : (
        <label className="flex h-12 cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-line-strong bg-surface-solid/60 text-sm font-medium text-ink hover:bg-brand-soft">
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              setPhotoBusy(true);
              setPhotoError(null);
              try {
                set("cardImage", await compressImage(file));
              } catch (err) {
                setPhotoError(err instanceof Error ? err.message : "Foto konnte nicht verarbeitet werden");
              } finally {
                setPhotoBusy(false);
              }
            }}
          />
          {photoBusy ? "Foto wird verkleinert …" : "Visitenkarte fotografieren"}
        </label>
      )}
      {photoError && <p className="text-sm text-danger">{photoError}</p>}

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
        {showMore ? "Weniger Felder" : "Mehr Felder (Sprache, Rückruf, Firma, Segment, Regionen, Notiz, Quelle)"}
      </button>

      {showMore && (
        <div className="space-y-5 rounded-2xl border border-line bg-canvas p-4">
          <Field label="Sprache" group>
            <ChipGroup name="Sprache" options={LEAD_LANGUAGES.map((l) => ({ value: l.value, label: l.label }))} value={form.language} onChange={(v) => set("language", form.language === v ? null : v)} />
          </Field>
          <Field label="Rückrufwunsch" hint="wird im Hub als Aufgabe zu diesem Termin angelegt" error={errors.callbackAt}>
            <Input name="callbackAt" type="datetime-local" value={form.callbackAt} onChange={(e) => set("callbackAt", e.target.value)} />
            <span className="mt-2 flex flex-wrap gap-2">
              {[
                ["Heute 17 Uhr", localSlot(0, 17)],
                ["Morgen 10 Uhr", localSlot(1, 10)],
                ["In einer Woche", localSlot(7, 10)],
              ].map(([label, value]) => (
                <button key={label} type="button" onClick={() => set("callbackAt", value)} className="rounded-md border border-line-strong/60 bg-surface-solid px-2.5 py-1 text-xs hover:bg-brand-soft">
                  {label}
                </button>
              ))}
              {form.callbackAt && (
                <button type="button" onClick={() => set("callbackAt", "")} className="rounded-md px-2.5 py-1 text-xs text-muted hover:bg-surface-2">
                  kein Rückruf
                </button>
              )}
            </span>
          </Field>
          <Field label="Bevorzugter Kontaktweg" group>
            <ChipGroup name="Kontaktweg" options={CONTACT_CHANNELS.map((c) => ({ value: c, label: CONTACT_CHANNEL_LABEL[c] }))} value={form.contactChannel} onChange={(v) => set("contactChannel", form.contactChannel === v ? null : v)} />
          </Field>
          {form.role === "KAEUFER" && (
            <>
              <Field label="Zeithorizont" group>
                <ChipGroup name="Zeithorizont" options={TIME_HORIZONS.map((h) => ({ value: h, label: TIME_HORIZON_LABEL[h] }))} value={form.timeHorizon} onChange={(v) => set("timeHorizon", form.timeHorizon === v ? null : v)} />
              </Field>
              <Field label="Finanzierung" group>
                <ChipGroup name="Finanzierung" options={FINANCING_OPTIONS.map((f) => ({ value: f, label: FINANCING_LABEL[f] }))} value={form.financing} onChange={(v) => set("financing", form.financing === v ? null : v)} />
              </Field>
            </>
          )}
          <Field label="Firma" error={errors.company}>
            <Input name="company" value={form.company} onChange={(e) => set("company", e.target.value)} />
          </Field>
          <Field label="Segment" group>
            <ChipGroup name="Segment" options={entries(SEGMENT_LABEL).map(([value, label]) => ({ value, label }))} value={form.segment} onChange={(v) => set("segment", form.segment === v ? null : v)} />
          </Field>
          <Field label="Regionen" hint="Vorschläge oder Freitext" group>
            <RegionTags value={form.regions} onChange={(v) => set("regions", v)} options={regionOptions} />
          </Field>
          <Field label="Notiz" hint="Tipp: mit dem Mikrofon der Handytastatur diktieren" error={errors.note}>
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

      {/* Speichern bleibt auf dem Handy über der unteren Navigation sichtbar, mit eigener Fläche */}
      <div className="sticky bottom-[calc(env(safe-area-inset-bottom,0px)+4.25rem)] z-10 -mx-4 border-t border-line bg-canvas/95 px-4 pt-3 pb-2 backdrop-blur md:static md:mx-0 md:border-0 md:bg-transparent md:p-0">
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
