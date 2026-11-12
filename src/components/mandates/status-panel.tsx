"use client";

import { useState } from "react";
import type { MandateStatus } from "@prisma/client";
import { MANDATE_STATUS_LABEL, allowedTransitions, MAIN_FLOW } from "@/lib/mandates";
import { changeStatusAction } from "@/app/(app)/auftraege/actions";
import { ActionForm } from "@/components/ui/action-form";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { cn } from "@/lib/cn";

type Presented = { propertyId: string; title: string; askingPrice: number };

export function StatusPanel({
  mandateId,
  status,
  statusBeforePause,
  gwgDone,
  canEdit,
  presented,
}: {
  mandateId: string;
  status: MandateStatus;
  statusBeforePause: MandateStatus | null;
  gwgDone: boolean;
  canEdit: boolean;
  presented: Presented[];
}) {
  const [target, setTarget] = useState<MandateStatus | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const options = allowedTransitions(status, statusBeforePause);
  const needsReason = target === "BEENDET_OHNE_KAUF";
  const needsPrice = target === "GEKAUFT";

  return (
    <div>
      <ol className="flex flex-wrap gap-1.5">
        {MAIN_FLOW.map((s, i) => {
          const idx = MAIN_FLOW.indexOf(status === "PAUSIERT" ? (statusBeforePause ?? "ERSTGESPRAECH") : status);
          const state = i < idx ? "done" : i === idx ? "current" : "todo";
          return (
            <li key={s} className={cn("rounded-full px-2.5 py-1 text-xs font-medium", state === "done" && "bg-ok-soft text-ok", state === "current" && "bg-brand text-petrol", state === "todo" && "bg-canvas text-muted")}>
              {MANDATE_STATUS_LABEL[s]}
            </li>
          );
        })}
      </ol>
      {(status === "PAUSIERT" || status === "BEENDET_OHNE_KAUF") && <p className="mt-2 text-sm font-medium text-warn">{MANDATE_STATUS_LABEL[status]}</p>}
      {done && <p className="mt-2 text-sm text-ok">{done}</p>}

      {canEdit && options.length > 0 && (
        <div className="mt-4">
          <div className="flex flex-wrap gap-2">
            {options.map((o) => (
              <Button key={o} size="sm" variant={target === o ? "primary" : "secondary"} onClick={() => { setTarget(o); setDone(null); }}>
                → {MANDATE_STATUS_LABEL[o]}
              </Button>
            ))}
          </div>
          {target === "BEAUFTRAGT" && !gwgDone && <p className="mt-2 text-sm text-danger">GwG-Identifizierung fehlt. Bitte zuerst unten eintragen.</p>}
          {target && (
            <ActionForm action={changeStatusAction.bind(null, mandateId)} className="mt-3 rounded-xl border border-line bg-canvas p-4" onSuccess={(r) => { setTarget(null); setDone(r.message ?? "Status geändert."); }}>
              <input type="hidden" name="status" value={target} />
              {needsReason && (
                <Field label="Grund (Pflicht)" required>
                  <Textarea name="endReason" rows={2} required placeholder="z. B. Finanzierung nicht darstellbar, Prioritäten geändert" />
                </Field>
              )}
              {needsPrice && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Gekauftes Objekt" required>
                    <Select name="propertyId" defaultValue={presented[0]?.propertyId ?? ""}>
                      {presented.length === 0 && <option value="">Kein vorgestelltes Objekt</option>}
                      {presented.map((p) => (
                        <option key={p.propertyId} value={p.propertyId}>
                          {p.title} (Angebot {p.askingPrice.toLocaleString("de-DE")} €)
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Kaufpreis (€)" required>
                    <Input name="purchasePrice" inputMode="numeric" required placeholder="z. B. 1.900.000" />
                  </Field>
                </div>
              )}
              <div className="flex gap-2">
                <Button type="submit" size="sm">
                  Status auf „{MANDATE_STATUS_LABEL[target]}“ setzen
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => setTarget(null)}>
                  Abbrechen
                </Button>
              </div>
            </ActionForm>
          )}
        </div>
      )}
    </div>
  );
}
