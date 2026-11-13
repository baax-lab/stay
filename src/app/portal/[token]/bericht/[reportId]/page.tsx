import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { t } from "@/lib/i18n";
import { enterPortal } from "@/lib/services/portal-page";
import { PortalShell, PortalUnavailable } from "@/components/portal/portal-shell";
import { ReportView } from "@/components/reports/report-view";

export const metadata = { title: "Bericht", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function PortalReportPage({ params, searchParams }: { params: Promise<{ token: string; reportId: string }>; searchParams: Promise<{ lang?: string }> }) {
  const { token, reportId } = await params;
  const { lang: langParam } = await searchParams;
  const { r, lang } = await enterPortal(token, langParam, `report:${reportId}`);
  if (r.state !== "valid") return <PortalUnavailable token={token} lang={lang} state={r.state} contact={r.state !== "unknown" ? { name: r.mandate.ownerName, phone: r.mandate.ownerPhone, email: r.mandate.ownerEmail } : undefined} />;
  const report = await prisma.report.findFirst({ where: { id: reportId, mandateId: r.mandate.id, status: "FREIGEGEBEN" } });
  if (!report) notFound();
  return (
    <PortalShell token={token} lang={lang} path={`/bericht/${reportId}`}>
      <div className="mb-4 flex items-center justify-between">
        <Link href={`/portal/${token}?lang=${lang}`} className="text-sm text-muted hover:text-petrol">
          ← {t(lang, "common.back")}
        </Link>
        <a href={`/portal/${token}/pdf/bericht/${reportId}?lang=${lang}`} className="rounded-md bg-petrol px-4 py-2 text-sm font-medium text-white">
          {t(lang, "common.download_pdf")}
        </a>
      </div>
      <div className="rounded-2xl border border-line bg-surface p-5">
        <ReportView report={report} buyerName={r.mandate.buyerName} lang={lang} />
      </div>
    </PortalShell>
  );
}
