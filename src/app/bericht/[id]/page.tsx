import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { verifyPrintToken } from "@/lib/print-token";
import { asLang } from "@/lib/i18n";
import { ReportView } from "@/components/reports/report-view";

export const metadata = { title: "Bericht", robots: { index: false } };

/** Berichtsansicht: intern mit Login (Vorschau), für das PDF mit Druck-Token. */
export default async function ReportPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ lang?: string; pt?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const print = await verifyPrintToken(sp.pt);
  if (print && (print.scope !== "report" || print.id !== id)) notFound();
  if (!print && !(await getSessionUser())) notFound();
  const report = await prisma.report.findUnique({ where: { id }, include: { mandate: { select: { id: true, buyerName: true, buyerLang: true } } } });
  if (!report) notFound();
  const lang = print ? print.lang : asLang(sp.lang ?? report.mandate.buyerLang);

  return (
    <main className="min-h-dvh bg-canvas px-4 py-6 print:bg-white print:p-0">
      {!print && (
        <div className="mx-auto mb-4 flex max-w-3xl items-center justify-between print:hidden">
          <Link href={`/auftraege/${report.mandate.id}/berichte/${report.id}`} className="text-sm text-muted hover:text-petrol">
            ← Bericht bearbeiten
          </Link>
          <div className="flex gap-2 text-sm">
            <Link href={`/bericht/${id}?lang=de`} className={`rounded-full px-3 py-1 ${lang === "de" ? "bg-brand text-petrol" : "bg-surface"}`}>
              DE
            </Link>
            <Link href={`/bericht/${id}?lang=en`} className={`rounded-full px-3 py-1 ${lang === "en" ? "bg-brand text-petrol" : "bg-surface"}`}>
              EN
            </Link>
            <a href={`/api/pdf/bericht/${id}?lang=${lang}`} className="rounded-full bg-petrol px-3 py-1 text-white">
              PDF
            </a>
          </div>
        </div>
      )}
      <div className="rounded-2xl bg-surface p-6 shadow-sm print:rounded-none print:p-0 print:shadow-none">
        <ReportView report={report} buyerName={report.mandate.buyerName} lang={lang} />
      </div>
    </main>
  );
}
