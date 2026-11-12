import type { Closing } from "@prisma/client";
import { closingProgress, type ChecklistItem } from "@/lib/checklists";
import { ensureClosingAction, updateClosingAction } from "@/app/(app)/auftraege/actions";
import { ActionButton, ActionForm } from "@/components/ui/action-form";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Notice } from "@/components/ui/card";

type Presented = { propertyId: string; title: string };

export function ClosingPanel({ mandateId, closing, presented, canEdit, propertyTitle }: { mandateId: string; closing: Closing | null; presented: Presented[]; canEdit: boolean; propertyTitle?: string }) {
  if (!closing) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted">Noch keine Kaufabwicklung. Sie wird beim Status „Gekauft“ automatisch angelegt oder hier vorab für ein vorgestelltes Objekt.</p>
        {canEdit &&
          presented.map((p) => (
            <ActionButton key={p.propertyId} action={ensureClosingAction.bind(null, mandateId, p.propertyId)}>
              Checkliste für „{p.title}“ anlegen
            </ActionButton>
          ))}
      </div>
    );
  }
  const items = closing.checklist as ChecklistItem[];
  const progress = closingProgress(items);
  const d = (x: Date | string | null | undefined) => (x ? new Date(x).toISOString().slice(0, 10) : "");

  return (
    <ActionForm action={updateClosingAction.bind(null, mandateId)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="font-semibold text-petrol">{propertyTitle ?? "Objekt"} · Checkliste {closing.country}</div>
          <div className="text-xs text-muted">
            {progress.done} von {progress.total} erledigt
          </div>
        </div>
        <div className="h-2 w-40 overflow-hidden rounded-full bg-canvas">
          <div className="h-full bg-brand" style={{ width: `${(progress.done / Math.max(1, progress.total)) * 100}%` }} />
        </div>
      </div>
      <div className="overflow-hidden rounded-2xl border border-line">
        <table className="w-full text-sm">
          <thead className="bg-canvas text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-3 py-2 text-left">Erledigt</th>
              <th className="px-3 py-2 text-left">Punkt</th>
              <th className="px-3 py-2 text-left">Fällig</th>
              <th className="px-3 py-2 text-left">Notiz</th>
            </tr>
          </thead>
          <tbody>
            {items.map((i) => (
              <tr key={i.key} className="border-t border-line align-top">
                <td className="px-3 py-2">
                  <input type="checkbox" name={`done:${i.key}`} defaultChecked={i.done} disabled={!canEdit} className="h-5 w-5 accent-brand-strong" />
                </td>
                <td className="px-3 py-2">
                  <div className={i.done ? "text-muted line-through" : ""}>{i.label}</div>
                  {i.doneAt && <div className="text-xs text-muted">erledigt {new Date(i.doneAt).toLocaleDateString("de-DE")}</div>}
                  {i.hubTaskAt && !i.done && <div className="text-xs text-ok">Aufgabe im Hub</div>}
                </td>
                <td className="px-3 py-2">
                  <input type="date" name={`due:${i.key}`} defaultValue={d(i.dueAt)} disabled={!canEdit} className="rounded-lg border border-line px-2 py-1 text-sm" />
                </td>
                <td className="px-3 py-2">
                  <input name={`note:${i.key}`} defaultValue={i.note ?? ""} disabled={!canEdit} className="w-full rounded-lg border border-line px-2 py-1 text-sm" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Beurkundung am">
          <Input type="date" name="notaryDate" defaultValue={d(closing.notaryDate)} disabled={!canEdit} />
        </Field>
        <Field label="Übergabe am" hint="legt Nachgespräch in 3 Monaten an">
          <Input type="date" name="handoverDate" defaultValue={d(closing.handoverDate)} disabled={!canEdit} />
        </Field>
      </div>
      <Notice tone="neutral">Fällige, offene Punkte werden als Aufgabe an den Hub gemeldet (sobald die Hub-API konfiguriert ist).</Notice>
      {canEdit && <Button type="submit">Kaufabwicklung speichern</Button>}
    </ActionForm>
  );
}
