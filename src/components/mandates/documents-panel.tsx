import type { DocumentKind, MandateDocument, StoredFile } from "@prisma/client";
import { deleteDocumentAction, uploadDocumentAction } from "@/app/(app)/auftraege/actions";
import { ActionButton, ActionForm } from "@/components/ui/action-form";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";

export const DOCUMENT_KIND_LABEL: Record<DocumentKind, string> = {
  SUCHAUFTRAG: "Suchauftrag (unterschrieben)",
  GWG_NACHWEIS: "GwG-Nachweis",
  FINANZIERUNG: "Finanzierungsbestätigung",
  VOLLMACHT: "Vollmacht",
  SONSTIGES: "Sonstiges",
};

export function DocumentsPanel({ mandateId, documents, files, canEdit, canSeeGwg }: { mandateId: string; documents: MandateDocument[]; files: Map<string, StoredFile>; canEdit: boolean; canSeeGwg: boolean }) {
  const visible = documents.filter((d) => d.kind !== "GWG_NACHWEIS" || canSeeGwg);
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <ul className="space-y-2">
        {visible.length === 0 && <li className="text-sm text-muted">Keine Dokumente.</li>}
        {visible.map((d) => {
          const f = files.get(d.fileId);
          return (
            <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-line bg-surface px-4 py-3 text-sm">
              <div>
                <div className="font-medium text-petrol">{DOCUMENT_KIND_LABEL[d.kind]}{d.label ? ` – ${d.label}` : ""}</div>
                <div className="text-xs text-muted">
                  {f?.fileName ?? "Datei fehlt"} · {f ? `${Math.round(f.size / 1024)} KB` : ""} · {d.uploadedAt.toLocaleDateString("de-DE")}
                </div>
              </div>
              <div className="flex gap-2">
                {f && (
                  <a href={`/api/files/${f.id}`} className="text-sm text-brand-strong underline" target="_blank" rel="noreferrer">
                    Öffnen
                  </a>
                )}
                {canEdit && (
                  <ActionButton action={deleteDocumentAction.bind(null, mandateId, d.id)} variant="ghost" confirm="Dokument wirklich löschen?">
                    Löschen
                  </ActionButton>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      {canEdit && (
        <ActionForm action={uploadDocumentAction.bind(null, mandateId)} resetOnSuccess className="h-fit rounded-2xl border border-line bg-surface p-4">
          <div className="font-semibold text-petrol">Dokument hochladen</div>
          <Field label="Art">
            <Select name="kind" defaultValue="SUCHAUFTRAG">
              {(Object.keys(DOCUMENT_KIND_LABEL) as DocumentKind[])
                .filter((k) => k !== "GWG_NACHWEIS" || canSeeGwg)
                .map((k) => (
                  <option key={k} value={k}>
                    {DOCUMENT_KIND_LABEL[k]}
                  </option>
                ))}
            </Select>
          </Field>
          <Field label="Bezeichnung">
            <Input name="label" />
          </Field>
          <Field label="Datei" hint="PDF, Bild, Office, max. 25 MB">
            <Input type="file" name="file" required accept=".pdf,.jpg,.jpeg,.png,.webp,.heic,.doc,.docx,.xls,.xlsx" />
          </Field>
          <Button type="submit">Hochladen</Button>
        </ActionForm>
      )}
    </div>
  );
}
