import type { Referrer, ReferrerType } from "@prisma/client";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/field";

export const REFERRER_TYPE_LABEL: Record<ReferrerType, string> = { TIPPGEBER: "Tippgeber", AGENTUR: "Agentur", MULTIPLIKATOR: "Multiplikator", PARTNER: "Partner" };

export function ReferrerFields({ r, disabled }: { r?: Referrer | null; disabled?: boolean }) {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" required>
          <Input name="name" defaultValue={r?.name ?? ""} required disabled={disabled} />
        </Field>
        <Field label="Firma">
          <Input name="company" defaultValue={r?.company ?? ""} disabled={disabled} />
        </Field>
        <Field label="E-Mail">
          <Input name="email" type="email" defaultValue={r?.email ?? ""} disabled={disabled} />
        </Field>
        <Field label="Telefon">
          <Input name="phone" defaultValue={r?.phone ?? ""} disabled={disabled} />
        </Field>
        <Field label="Art">
          <Select name="type" defaultValue={r?.type ?? "TIPPGEBER"} disabled={disabled}>
            {(Object.keys(REFERRER_TYPE_LABEL) as ReferrerType[]).map((k) => (
              <option key={k} value={k}>
                {REFERRER_TYPE_LABEL[k]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Hub-Kontakt-ID">
          <Input name="hubContactId" defaultValue={r?.hubContactId ?? ""} disabled={disabled} />
        </Field>
      </div>
      <div className="rounded-2xl border border-line bg-canvas p-4">
        <div className="mb-2 text-sm font-semibold text-petrol">Prämienregel</div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="% vom Netto-Erfolgshonorar">
            <Input name="rewardPct" defaultValue={r?.rewardPct != null ? (r.rewardPct * 100).toLocaleString("de-DE") : ""} disabled={disabled} placeholder="z. B. 10" />
          </Field>
          <Field label="oder pauschal (€)">
            <Input name="rewardFlat" defaultValue={r?.rewardFlat ?? ""} inputMode="numeric" disabled={disabled} />
          </Field>
          <Field label="Beschreibung">
            <Input name="rewardRule" defaultValue={r?.rewardRule ?? ""} disabled={disabled} placeholder="z. B. 10 % des Netto-Erfolgshonorars" />
          </Field>
        </div>
        <p className="mt-2 text-xs text-muted">Bei Status „Gekauft“ wird die Prämie nach dieser Regel vorgeschlagen (pauschal hat Vorrang).</p>
      </div>
      <Field label="Notiz">
        <Textarea name="note" rows={2} defaultValue={r?.note ?? ""} disabled={disabled} />
      </Field>
      {r && <Checkbox name="active" value="on" defaultChecked={r.active} disabled={disabled} label="Aktiv" />}
      {r && !r.active && <input type="hidden" name="active" value="off" />}
    </>
  );
}
