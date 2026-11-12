import type { FollowUp } from "@prisma/client";
import { createFollowUpAction, saveFollowUpAction } from "@/app/(app)/auftraege/actions";
import { ActionForm } from "@/components/ui/action-form";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Textarea } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";

export function FollowUpPanel({ mandateId, followUps, canEdit }: { mandateId: string; followUps: FollowUp[]; canEdit: boolean }) {
  const d = (x: Date | null) => (x ? x.toISOString().slice(0, 10) : "");
  return (
    <div className="space-y-4">
      {followUps.length === 0 && <p className="text-sm text-muted">Das Nachgespräch wird drei Monate nach der Übergabe automatisch angelegt.</p>}
      {followUps.map((f) => (
        <ActionForm key={f.id} action={saveFollowUpAction.bind(null, mandateId, f.id)} className="rounded-2xl border border-line bg-surface p-4">
          <div className="flex items-center justify-between">
            <div className="font-semibold text-petrol">Nachgespräch</div>
            <Badge tone={f.doneAt ? "ok" : f.dueAt < new Date() ? "danger" : "warn"}>{f.doneAt ? `erledigt ${f.doneAt.toLocaleDateString("de-DE")}` : `fällig ${f.dueAt.toLocaleDateString("de-DE")}`}</Badge>
          </div>
          <Field label="Fällig am">
            <Input type="date" name="dueAt" defaultValue={d(f.dueAt)} disabled={!canEdit} />
          </Field>
          <Field label="Feedback des Käufers">
            <Textarea name="feedback" rows={3} defaultValue={f.feedback ?? ""} disabled={!canEdit} />
          </Field>
          <div className="grid gap-2 sm:grid-cols-3">
            <Checkbox name="referralGiven" defaultChecked={f.referralGiven} disabled={!canEdit} label="Empfehlung ausgesprochen" />
            <Checkbox name="nextMandateWanted" defaultChecked={f.nextMandateWanted} disabled={!canEdit} label="Weiterer Suchauftrag gewünscht" />
            <Checkbox name="done" defaultChecked={Boolean(f.doneAt)} disabled={!canEdit} label="Gespräch geführt" />
          </div>
          {canEdit && (
            <Button type="submit" size="sm">
              Speichern
            </Button>
          )}
        </ActionForm>
      ))}
      {canEdit && (
        <ActionForm action={createFollowUpAction.bind(null, mandateId)} resetOnSuccess className="flex flex-wrap items-end gap-3">
          <Field label="Weiteres Nachgespräch am">
            <Input type="date" name="dueAt" required />
          </Field>
          <Button type="submit" size="sm" variant="secondary">
            Anlegen
          </Button>
        </ActionForm>
      )}
    </div>
  );
}
