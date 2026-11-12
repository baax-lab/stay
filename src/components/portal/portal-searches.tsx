"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deletePortalSearchAction, savePortalSearchAction } from "@/app/portal/[token]/actions";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Notice } from "@/components/ui/card";

type Opt = { value: string; label: string };
type Saved = { id: string; name: string; summary: string };

export function PortalSearches({ token, labels, segments, regionGroups, features, saved }: { token: string; labels: Record<string, string>; segments: Opt[]; regionGroups: Array<{ label: string; options: Opt[] }>; features: Opt[]; saved: Saved[] }) {
  const router = useRouter();
  const form = useRef<HTMLFormElement>(null);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  return (
    <div className="space-y-4" data-testid="portal-searches">
      <p className="text-sm text-muted">{labels.intro}</p>
      {saved.length === 0 ? (
        <p className="text-sm text-muted">{labels.none}</p>
      ) : (
        <ul className="space-y-2">
          {saved.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line px-3 py-2 text-sm">
              <span>
                <span className="font-medium text-petrol">{s.name}</span> <span className="text-xs text-muted">{s.summary}</span>
              </span>
              <button
                type="button"
                className="text-xs text-muted hover:text-danger"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    await deletePortalSearchAction(token, s.id);
                    router.refresh();
                  })
                }
              >
                {labels.delete}
              </button>
            </li>
          ))}
        </ul>
      )}
      {msg && <Notice tone={msg.ok ? "ok" : "danger"}>{msg.text}</Notice>}
      <form
        ref={form}
        className="space-y-3 rounded-2xl border border-line bg-canvas p-4"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          start(async () => {
            const r = await savePortalSearchAction(token, fd);
            if (r.ok) {
              setMsg({ ok: true, text: labels.saved });
              form.current?.reset();
              router.refresh();
            } else setMsg({ ok: false, text: r.error === "limit" ? labels.limit : labels.error });
          });
        }}
      >
        <Field label={labels.name}>
          <Input name="name" maxLength={80} />
        </Field>
        <Field label={labels.segments} group>
          <div className="flex flex-wrap gap-3">
            {segments.map((s) => (
              <label key={s.value} className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="segments" value={s.value} className="h-4 w-4 accent-brand-strong" />
                {s.label}
              </label>
            ))}
          </div>
        </Field>
        <Field label={labels.regions}>
          <select name="regions" multiple size={6} className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm">
            {regionGroups.map((g) => (
              <optgroup key={g.label} label={g.label}>
                {g.options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </Field>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label={labels.priceMin}>
            <Input name="priceMin" inputMode="numeric" />
          </Field>
          <Field label={labels.priceMax} required>
            <Input name="priceMax" inputMode="numeric" required />
          </Field>
          <Field label={labels.units}>
            <Input name="minUnits" inputMode="numeric" />
          </Field>
        </div>
        <Field label={labels.features} group>
          <div className="grid grid-cols-2 gap-1 sm:grid-cols-3">
            {features.map((f) => (
              <label key={f.value} className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="features" value={f.value} className="h-4 w-4 accent-brand-strong" />
                {f.label}
              </label>
            ))}
          </div>
        </Field>
        <Field label={labels.note}>
          <Textarea name="note" rows={2} />
        </Field>
        <Button type="submit" disabled={pending}>
          {labels.save}
        </Button>
      </form>
    </div>
  );
}
