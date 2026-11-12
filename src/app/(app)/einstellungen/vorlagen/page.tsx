import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { placeholdersOf, TEMPLATE_KINDS, TEMPLATE_KIND_LABEL } from "@/lib/templates";
import { createTemplateLangAction, saveTemplateAction } from "@/app/(app)/vorlagen-actions";
import { ActionButton, ActionForm } from "@/components/ui/action-form";
import { Card, PageHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Textarea } from "@/components/ui/field";

export const metadata = { title: "Vorlagen" };

export default async function TemplatesPage() {
  const user = await requireUser();
  if (!can.editFeeBands(user.role)) redirect("/");
  const templates = await prisma.documentTemplate.findMany({ orderBy: [{ kind: "asc" }, { lang: "asc" }] });
  return (
    <div className="mx-auto max-w-5xl">
      <Link href="/einstellungen" className="text-sm text-muted hover:text-petrol">
        ← Einstellungen
      </Link>
      <PageHeader title="Vorlagen" subtitle="Suchauftrag, Partnervereinbarung, Tippgeberbestätigung. Platzhalter in doppelten geschweiften Klammern werden aus dem Datensatz befüllt; {{#if feld}}…{{/if}} erscheint nur, wenn das Feld gesetzt ist. Formatierung: # Überschrift, ## Abschnitt, „- “ Liste, **fett**." />
      <div className="space-y-4">
        {TEMPLATE_KINDS.map((kind) => (
          <div key={kind} className="space-y-3">
            <h2 className="text-lg font-semibold text-petrol">{TEMPLATE_KIND_LABEL[kind]}</h2>
            {templates.filter((t) => t.kind === kind).map((t) => (
              <Card key={t.id}>
                <ActionForm action={saveTemplateAction.bind(null, t.id)}>
                  <div className="grid gap-3 sm:grid-cols-[1fr_120px_auto] sm:items-end">
                    <Field label={`Name (${t.lang.toUpperCase()})`}>
                      <Input name="name" defaultValue={t.name} />
                    </Field>
                    <div className="pb-3 text-xs text-muted">Version {t.version}</div>
                    <Checkbox name="active" defaultChecked={t.active} label="aktiv" />
                  </div>
                  <Field label="Text">
                    <Textarea name="body" rows={14} defaultValue={t.body} className="font-mono text-xs" />
                  </Field>
                  <p className="text-xs text-muted">Platzhalter: {placeholdersOf(t.body).join(", ")}</p>
                  <Button type="submit" size="sm">
                    Speichern
                  </Button>
                </ActionForm>
              </Card>
            ))}
            {!templates.some((t) => t.kind === kind && t.lang === "en") && (
              <ActionButton action={createTemplateLangAction.bind(null, kind, "en")}>Englische Fassung anlegen</ActionButton>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
