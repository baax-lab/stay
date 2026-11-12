import { notFound } from "next/navigation";
import Link from "next/link";
import { getSessionUser } from "@/lib/auth";
import { verifyPrintToken } from "@/lib/print-token";
import { asLang } from "@/lib/i18n";
import { loadDossier } from "@/lib/services/dossier";
import { DossierView } from "@/components/dossier/dossier-view";

export const metadata = { title: "Objektdossier", robots: { index: false } };

/** Dossier-Ansicht: intern mit Login, für das PDF mit Druck-Token (?pt=). */
export default async function DossierPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ lang?: string; m?: string; pt?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const print = await verifyPrintToken(sp.pt);
  const user = print ? null : await getSessionUser();
  if (print && (print.scope !== "dossier" || print.id !== id)) notFound();
  if (!print && !user) notFound();

  const lang = print ? print.lang : asLang(sp.lang);
  const mandateId = print ? (print.mandateId ?? null) : (sp.m ?? null);
  const d = await loadDossier(id, mandateId, lang);
  if (!d) notFound();

  const photoUrl = (fileId: string) => (sp.pt ? `/api/files/${fileId}?pt=${encodeURIComponent(sp.pt)}` : `/api/files/${fileId}`);
  const q = `${mandateId ? `&m=${mandateId}` : ""}`;

  return (
    <main className="min-h-dvh bg-canvas px-4 py-6 print:bg-white print:p-0">
      {!print && (
        <div className="mx-auto mb-4 flex max-w-4xl flex-wrap items-center justify-between gap-2 print:hidden">
          <Link href={`/objekte/${id}?tab=kosten${q}`} className="text-sm text-muted hover:text-petrol">
            ← Objekt
          </Link>
          <div className="flex gap-2 text-sm">
            <Link href={`/dossier/${id}?lang=de${q}`} className={`rounded-full px-3 py-1 ${lang === "de" ? "bg-brand text-petrol" : "bg-surface"}`}>
              DE
            </Link>
            <Link href={`/dossier/${id}?lang=en${q}`} className={`rounded-full px-3 py-1 ${lang === "en" ? "bg-brand text-petrol" : "bg-surface"}`}>
              EN
            </Link>
            <a href={`/api/pdf/dossier/${id}?lang=${lang}${q}`} className="rounded-full bg-petrol px-3 py-1 text-white">
              PDF
            </a>
          </div>
        </div>
      )}
      <div className="rounded-2xl bg-surface p-6 shadow-sm print:rounded-none print:p-0 print:shadow-none">
        <DossierView d={d} lang={lang} photoUrl={photoUrl} print={Boolean(print)} />
      </div>
    </main>
  );
}
