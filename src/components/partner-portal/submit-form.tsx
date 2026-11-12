"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { submitPropertyAction } from "@/app/partner-zugang/[token]/actions";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Notice } from "@/components/ui/card";

type Opt = { value: string; label: string };

export function PartnerSubmitForm({ token, labels, refs, regions, segments, licenses, features, locale }: { token: string; labels: Record<string, string>; refs: Opt[]; regions: Opt[]; segments: Opt[]; licenses: Opt[]; features: Opt[]; locale: string }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  return (
    <form
      ref={formRef}
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        start(async () => {
          const r = await submitPropertyAction(token, fd);
          if (r.ok) {
            setMsg({ ok: true, text: labels.thanks.replace("{date}", new Date(r.date).toLocaleString(locale)) });
            formRef.current?.reset();
            router.refresh();
          } else setMsg({ ok: false, text: labels.error });
        });
      }}
    >
      {msg && <Notice tone={msg.ok ? "ok" : "danger"}>{msg.text}</Notice>}
      <Field label={labels.ref}>
        <Select name="ref" defaultValue="">
          <option value="">{labels.none}</option>
          {refs.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </Select>
      </Field>
      <Field label={labels.f_title} required>
        <Input name="title" required minLength={3} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={labels.f_segment} required>
          <Select name="segment" required defaultValue="FEWO">
            {segments.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={labels.f_region} required>
          <Select name="region" required defaultValue={regions[0]?.value}>
            {regions.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={labels.f_locality}>
          <Input name="locality" />
        </Field>
        <div className="grid grid-cols-[1fr_100px] gap-2">
          <Field label={labels.f_price} required>
            <Input name="price" inputMode="numeric" required />
          </Field>
          <Field label={labels.f_currency}>
            <Select name="currency" defaultValue="EUR">
              <option>EUR</option>
              <option>CHF</option>
              <option>GBP</option>
            </Select>
          </Field>
        </div>
        <Field label={labels.f_units}>
          <Input name="units" inputMode="numeric" />
        </Field>
        <Field label={labels.f_area}>
          <Input name="livingArea" inputMode="numeric" />
        </Field>
        <Field label={labels.f_license}>
          <Select name="licenseStatus" defaultValue="UNKLAR">
            {licenses.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={labels.f_occupancy}>
          <Input name="occupancyPct" inputMode="decimal" />
        </Field>
        <Field label={labels.f_adr}>
          <Input name="adr" inputMode="numeric" />
        </Field>
        <Field label={labels.f_revenue}>
          <Input name="revenueYear" inputMode="numeric" />
        </Field>
      </div>
      <Field label={labels.f_features} group>
        <div className="grid grid-cols-2 gap-1 sm:grid-cols-3">
          {features.map((f) => (
            <label key={f.value} className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="features" value={f.value} className="h-4 w-4 accent-brand-strong" />
              {f.label}
            </label>
          ))}
        </div>
      </Field>
      <Field label={labels.f_description}>
        <Textarea name="description" rows={4} />
      </Field>
      <Field label={labels.f_link}>
        <Input name="link" type="url" placeholder="https://" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={labels.f_photos}>
          <Input name="photos" type="file" accept="image/*" multiple />
        </Field>
        <Field label={labels.f_documents}>
          <Input name="documents" type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" multiple />
        </Field>
      </div>
      <Field label={labels.f_contact}>
        <Textarea name="contact" rows={2} />
      </Field>
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "…" : labels.submit}
      </Button>
    </form>
  );
}
