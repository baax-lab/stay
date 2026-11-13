import type { Precheck } from "@prisma/client";
import { precheckProgress, type PrecheckItem } from "@/lib/precheck";
import { savePrecheckAction, startPrecheckAction } from "@/app/(app)/objekte/actions";
import { ActionButton, ActionForm } from "@/components/ui/action-form";
import { Card, CardTitle, Notice } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";

const STATUS_LABEL = { OFFEN: "offen", OK: "OK", BEDENKEN: "Bedenken", KO: "K.-o.", NA: "entfällt" } as const;
const OVERALL: Record<string, { label: string; tone: "neutral" | "warn" | "ok" | "danger" | "brand" }> = {
  OFFEN: { label: "nicht begonnen", tone: "neutral" },
  LAEUFT: { label: "läuft", tone: "brand" },
  OK: { label: "ohne Befund", tone: "ok" },
  BEDENKEN: { label: "Bedenken", tone: "warn" },
  KO: { label: "Ausschlussgrund", tone: "danger" },
};

export function PrecheckPanel({ propertyId, precheck, canEdit, segmentCountry }: { propertyId: string; precheck: Precheck | null; canEdit: boolean; segmentCountry: string }) {
  if (!precheck) {
    return (
      <Card>
        <CardTitle>Vorprüfung</CardTitle>
        <p className="mb-3 text-sm text-muted">Checkliste je Segment und Land ({segmentCountry}). Inhalte sind Startvorlagen und mit Partnern vor Ort abzustimmen.</p>
        {canEdit ? <ActionButton action={startPrecheckAction.bind(null, propertyId)} variant="primary">Vorprüfung starten</ActionButton> : <p className="text-sm text-muted">Noch nicht begonnen.</p>}
      </Card>
    );
  }
  const items = precheck.items as PrecheckItem[];
  const prog = precheckProgress(items);
  const groups = ["Allgemein", "Segment", "Land"] as const;
  return (
    <Card>
      <CardTitle action={canEdit ? <ActionButton action={startPrecheckAction.bind(null, propertyId)} variant="ghost">An Segment/Land anpassen</ActionButton> : undefined}>
        Vorprüfung <Badge tone={OVERALL[precheck.status].tone}>{OVERALL[precheck.status].label}</Badge>
      </CardTitle>
      <p className="mb-3 text-sm text-muted" data-testid="precheck-progress">
        {prog.done} von {prog.total} Punkten erledigt{prog.concerns ? ` · ${prog.concerns} Bedenken` : ""}
        {prog.ko ? ` · ${prog.ko} Ausschlussgrund` : ""} · Stand {precheck.updatedAt.toLocaleDateString("de-DE")}
      </p>
      {precheck.status === "KO" && <Notice tone="danger">Ausschlussgrund festgestellt: Objekt vor Vorstellung mit der Leitung besprechen.</Notice>}
      <ActionForm action={savePrecheckAction.bind(null, propertyId)}>
        {groups.map((g) => {
          const list = items.filter((i) => i.group === g);
          if (!list.length) return null;
          return (
            <div key={g}>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">{g === "Segment" ? "Segment" : g === "Land" ? "Land" : "Allgemein"}</h3>
              <div className="space-y-2">
                {list.map((i) => (
                  <div key={i.key} className="grid gap-2 rounded-xl bg-canvas p-3 sm:grid-cols-[1fr_auto] sm:items-center" data-testid={`precheck-${i.key}`}>
                    <div>
                      <div className="text-sm font-medium text-ink">{i.label}</div>
                      <input name={`note:${i.key}`} defaultValue={i.note ?? ""} disabled={!canEdit} placeholder="Notiz, Quelle, Datum" className="mt-1 w-full rounded-lg border border-line bg-surface px-2 py-1 text-sm" />
                    </div>
                    <div className="flex flex-wrap gap-1" role="radiogroup" aria-label={i.label}>
                      {(Object.keys(STATUS_LABEL) as Array<keyof typeof STATUS_LABEL>).map((s) => (
                        <label key={s} className="cursor-pointer">
                          <input type="radio" name={`status:${i.key}`} value={s} defaultChecked={i.status === s} disabled={!canEdit} className="peer sr-only" />
                          <span className="inline-block rounded-md border border-line px-2.5 py-1 text-xs peer-checked:border-brand peer-checked:bg-brand peer-checked:text-on-brand">{STATUS_LABEL[s]}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
        {canEdit && (
          <Field label="Weiteren Prüfpunkt hinzufügen">
            <Input name="newItem" placeholder="z. B. Pachtvertrag Restaurant geprüft" />
          </Field>
        )}
        <Field label="Zusammenfassung (erscheint im Dossier)">
          <Textarea name="summary" rows={3} defaultValue={precheck.summary ?? ""} disabled={!canEdit} />
        </Field>
        {canEdit && <Button type="submit">Vorprüfung speichern</Button>}
      </ActionForm>
    </Card>
  );
}
