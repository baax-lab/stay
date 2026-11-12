"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Recommendation } from "@prisma/client";
import type { InspectionItem } from "@/lib/precheck";
import { saveInspectionAction, type InspectionPayload } from "@/app/(app)/besichtigungen/actions";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Notice } from "@/components/ui/card";
import { cn } from "@/lib/cn";

const REC: Array<[Recommendation, string]> = [
  ["EMPFEHLEN", "Empfehlen"],
  ["BEDINGT", "Bedingt"],
  ["NICHT_EMPFEHLEN", "Nicht empfehlen"],
];

function Stars({ value, onChange, disabled, label }: { value: number | null; onChange: (v: number | null) => void; disabled: boolean; label: string }) {
  return (
    <div className="flex gap-1.5" role="radiogroup" aria-label={label}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${label}: ${n}`}
          disabled={disabled}
          onClick={() => onChange(value === n ? null : n)}
          className={cn("h-11 w-11 rounded-full border text-base font-semibold transition-colors", value != null && n <= value ? "border-brand bg-brand text-petrol" : "border-line bg-surface text-muted")}
        >
          {n}
        </button>
      ))}
    </div>
  );
}

export function InspectionEditor({ id, initial, locked }: { id: string; initial: InspectionPayload; locked: boolean }) {
  const router = useRouter();
  const [s, setS] = useState<InspectionPayload>(initial);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const setItem = (key: string, patch: Partial<InspectionItem>) => setS((x) => ({ ...x, items: x.items.map((i) => (i.key === key ? { ...i, ...patch } : i)) }));

  function save(complete: boolean) {
    start(async () => {
      const r = await saveInspectionAction(id, s, complete);
      setMsg(r.ok ? { ok: true, text: r.message ?? "Gespeichert." } : { ok: false, text: r.error });
      if (r.ok) router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      {msg && <Notice tone={msg.ok ? "ok" : "danger"}>{msg.text}</Notice>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Datum und Uhrzeit">
          <Input type="datetime-local" value={s.date} disabled={locked} onChange={(e) => setS({ ...s, date: e.target.value })} />
        </Field>
        <Field label="Teilnehmer">
          <Input value={s.attendees} disabled={locked} onChange={(e) => setS({ ...s, attendees: e.target.value })} placeholder="Käufer, Partner, Verkäufer" />
        </Field>
      </div>
      <div className="space-y-3">
        {s.items.map((i) => (
          <div key={i.key} className="rounded-2xl border border-line bg-surface p-4" data-testid={`inspection-item-${i.key}`}>
            <div className="mb-2 text-sm font-medium text-petrol">{i.label}</div>
            <Stars value={i.rating} disabled={locked} onChange={(v) => setItem(i.key, { rating: v })} label={i.label} />
            <input value={i.note ?? ""} disabled={locked} onChange={(e) => setItem(i.key, { note: e.target.value })} placeholder="Notiz" className="mt-2 w-full rounded-xl border border-line px-3 py-2 text-base sm:text-sm" />
          </div>
        ))}
      </div>
      <div className="rounded-2xl border border-line bg-surface p-4">
        <div className="mb-2 text-sm font-medium text-petrol">Gesamteindruck</div>
        <Stars value={s.rating} disabled={locked} onChange={(v) => setS({ ...s, rating: v })} label="Gesamteindruck" />
        <p className="mt-1 text-xs text-muted">Leer = Durchschnitt der Einzelbewertungen.</p>
        <div className="mb-2 mt-4 text-sm font-medium text-petrol">Empfehlung</div>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Empfehlung">
          {REC.map(([v, label]) => (
            <button key={v} type="button" role="radio" aria-checked={s.recommendation === v} disabled={locked} onClick={() => setS({ ...s, recommendation: v })} className={cn("rounded-full border px-4 py-2.5 text-sm font-medium", s.recommendation === v ? "border-brand bg-brand text-petrol" : "border-line bg-surface")}>
              {label}
            </button>
          ))}
        </div>
      </div>
      <Field label="Weitere Notizen">
        <Textarea rows={4} value={s.notes} disabled={locked} onChange={(e) => setS({ ...s, notes: e.target.value })} />
      </Field>
      {!locked && (
        <div className="sticky bottom-20 z-10 flex gap-2 bg-canvas/90 py-2 backdrop-blur md:static">
          <Button variant="secondary" size="lg" disabled={pending} onClick={() => save(false)}>
            Zwischenspeichern
          </Button>
          <Button size="lg" disabled={pending} onClick={() => save(true)}>
            Protokoll abschließen
          </Button>
        </div>
      )}
    </div>
  );
}
