import type { Offer } from "@prisma/client";
import { addOfferAction, respondOfferAction } from "@/app/(app)/auftraege/actions";
import { ActionForm } from "@/components/ui/action-form";
import { NumberInput } from "@/components/ui/number-input";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import { formatEur } from "@/lib/fees";

type OfferRow = Offer & { property: { id: string; title: string } };
type Presented = { propertyId: string; title: string; askingPrice: number };

const RESPONSE_LABEL = { OFFEN: "offen", ANGENOMMEN: "angenommen", ABGELEHNT: "abgelehnt", GEGENANGEBOT: "Gegenangebot" } as const;

export function OffersPanel({ mandateId, offers, presented, canEdit, bonusPct, bonusCap }: { mandateId: string; offers: OfferRow[]; presented: Presented[]; canEdit: boolean; bonusPct: number; bonusCap: number }) {
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div className="space-y-3">
        {offers.length === 0 && <p className="text-sm text-muted">Noch keine Angebote.</p>}
        {offers.map((o) => {
          const asking = presented.find((p) => p.propertyId === o.propertyId)?.askingPrice ?? null;
          const effective = o.response === "GEGENANGEBOT" && o.counterAmount ? o.counterAmount : o.amount;
          const savings = asking != null ? Math.max(0, asking - effective) : null;
          const bonus = savings != null ? Math.min(Math.round(bonusPct * savings), bonusCap) : null;
          return (
            <div key={o.id} className="rounded-2xl border border-line bg-surface p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="font-medium text-petrol">{o.property.title}</div>
                  <div className="text-xs text-muted">
                    {o.madeAt.toLocaleDateString("de-DE")} · Angebot {formatEur(o.amount)}
                    {o.counterAmount ? ` · Gegenangebot ${formatEur(o.counterAmount)}` : ""}
                  </div>
                </div>
                <Badge tone={o.response === "ANGENOMMEN" ? "ok" : o.response === "ABGELEHNT" ? "danger" : o.response === "GEGENANGEBOT" ? "warn" : "brand"}>{RESPONSE_LABEL[o.response]}</Badge>
              </div>
              {o.conditions && <div className="mt-1 text-sm">Bedingungen: {o.conditions}</div>}
              {o.note && <div className="mt-1 text-sm text-muted">{o.note}</div>}
              {asking != null && (
                <div className="mt-2 rounded-xl bg-canvas px-3 py-2 text-xs">
                  Angebotspreis (eingefroren) {formatEur(asking)} · Ersparnis {formatEur(savings)} · Verhandlungsbonus voraussichtlich {formatEur(bonus)}
                </div>
              )}
              {canEdit && o.response === "OFFEN" && (
                <ActionForm action={respondOfferAction.bind(null, mandateId, o.id)} className="mt-3">
                  <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                    <Field label="Antwort des Verkäufers">
                      <Select name="response" defaultValue="GEGENANGEBOT">
                        <option value="ANGENOMMEN">angenommen</option>
                        <option value="ABGELEHNT">abgelehnt</option>
                        <option value="GEGENANGEBOT">Gegenangebot</option>
                      </Select>
                    </Field>
                    <Field label="Gegenangebot (€)">
                      <NumberInput name="counterAmount" />
                    </Field>
                    <Button type="submit" size="sm">
                      Speichern
                    </Button>
                  </div>
                </ActionForm>
              )}
            </div>
          );
        })}
      </div>

      {canEdit && (
        <ActionForm action={addOfferAction.bind(null, mandateId)} resetOnSuccess className="h-fit rounded-2xl border border-line bg-surface p-4">
          <div className="font-semibold text-petrol">Neues Angebot</div>
          <Field label="Objekt" required>
            <Select name="propertyId" required>
              {presented.length === 0 && <option value="">Erst ein Objekt vorstellen</option>}
              {presented.map((p) => (
                <option key={p.propertyId} value={p.propertyId}>
                  {p.title} ({formatEur(p.askingPrice)})
                </option>
              ))}
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Betrag (€)" required>
              <NumberInput name="amount" required />
            </Field>
            <Field label="Datum" required>
              <Input type="date" name="madeAt" required defaultValue={new Date().toISOString().slice(0, 10)} />
            </Field>
          </div>
          <Field label="Bedingungen">
            <Input name="conditions" placeholder="Finanzierungsvorbehalt, Inventar, Fristen" />
          </Field>
          <Field label="Notiz">
            <Textarea name="note" rows={2} />
          </Field>
          <Button type="submit" disabled={presented.length === 0}>
            Angebot erfassen
          </Button>
        </ActionForm>
      )}
    </div>
  );
}
