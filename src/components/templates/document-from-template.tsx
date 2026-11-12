import { prisma } from "@/lib/db";
import { TEMPLATE_KIND_LABEL, type TemplateKind } from "@/lib/templates";
import { saveMandateDocumentFromTemplateAction } from "@/app/(app)/vorlagen-actions";
import { ActionButton } from "@/components/ui/action-form";
import { Card, CardTitle } from "@/components/ui/card";

/** Dokument aus Vorlage: Vorschau und PDF je Sprache; beim Suchauftrag Ablage als Dokument. */
export async function DocumentFromTemplate({ kind, entityId, canSave }: { kind: TemplateKind; entityId: string; canSave: boolean }) {
  const langs = (await prisma.documentTemplate.findMany({ where: { kind, active: true }, select: { lang: true }, orderBy: { lang: "asc" } })).map((t) => t.lang);
  if (langs.length === 0) return null;
  return (
    <Card className="mb-4">
      <CardTitle>{TEMPLATE_KIND_LABEL[kind]} aus Vorlage</CardTitle>
      <p className="mb-3 text-xs text-muted">Befüllt aus den aktuellen Daten. Unterschrift später über Baax Sign; bis dahin ausdrucken oder als PDF versenden.</p>
      <div className="flex flex-wrap gap-2" data-testid={`template-${kind}`}>
        {langs.map((l) => (
          <span key={l} className="inline-flex flex-wrap gap-2">
            <a href={`/vorlage/${kind}/${entityId}?lang=${l}`} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center rounded-full border border-line bg-surface px-3.5 text-sm">
              Vorschau {l.toUpperCase()}
            </a>
            <a href={`/api/pdf/vorlage/${kind}/${entityId}?lang=${l}`} className="inline-flex h-9 items-center rounded-full bg-brand px-3.5 text-sm font-medium text-petrol">
              PDF {l.toUpperCase()}
            </a>
            {kind === "SUCHAUFTRAG" && canSave && <ActionButton action={saveMandateDocumentFromTemplateAction.bind(null, entityId, l)}>Als Dokument ablegen ({l.toUpperCase()})</ActionButton>}
          </span>
        ))}
      </div>
    </Card>
  );
}
