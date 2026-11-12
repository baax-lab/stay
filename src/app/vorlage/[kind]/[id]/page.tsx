import { notFound } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { verifyPrintToken } from "@/lib/print-token";
import { asLang } from "@/lib/i18n";
import { TEMPLATE_KINDS, type TemplateKind } from "@/lib/templates";
import { renderDocument } from "@/lib/services/templates";
import { Notice } from "@/components/ui/card";

export const metadata = { title: "Dokument", robots: { index: false } };

/** Dokument aus Vorlage: Vorschau mit Login, PDF mit Druck-Token. */
export default async function TemplateDocPage({ params, searchParams }: { params: Promise<{ kind: string; id: string }>; searchParams: Promise<{ lang?: string; pt?: string }> }) {
  const { kind, id } = await params;
  const sp = await searchParams;
  if (!TEMPLATE_KINDS.includes(kind as TemplateKind)) notFound();
  const print = await verifyPrintToken(sp.pt);
  if (print && (print.scope !== "template" || print.id !== `${kind}:${id}`)) notFound();
  if (!print) {
    const user = await getSessionUser();
    if (!user || !can.viewBuyerDetails(user.role)) notFound();
  }
  const doc = await renderDocument(kind as TemplateKind, id, print ? print.lang : asLang(sp.lang));
  if (!doc) notFound();
  return (
    <main className="min-h-dvh bg-canvas px-4 py-6 print:bg-white print:p-0">
      {!print && doc.missing.length > 0 && (
        <div className="mx-auto mb-4 max-w-3xl print:hidden">
          <Notice tone="warn">Nicht befüllt (Leerstellen im Dokument): {doc.missing.join(", ")}</Notice>
        </div>
      )}
      <article className="template-doc mx-auto max-w-3xl rounded-2xl bg-surface p-8 text-[14px] leading-relaxed text-ink shadow-sm print:rounded-none print:p-0 print:shadow-none" data-testid="template-doc">
        <div className="mb-6 border-b-4 border-brand pb-3 text-sm font-semibold text-brand-strong">Baax Immobilien GmbH</div>
        <div className="space-y-3 [&_h1]:text-2xl [&_h1]:font-semibold [&_h1]:text-petrol [&_h2]:mt-5 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-petrol [&_li]:ml-5 [&_li]:list-disc" dangerouslySetInnerHTML={{ __html: doc.html }} />
      </article>
    </main>
  );
}
