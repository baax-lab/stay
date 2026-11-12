import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { asLang } from "@/lib/i18n";
import { audit } from "@/lib/audit";
import { lookupPortal } from "@/lib/services/portal";
import { pdfResponseHeaders, renderReportPdf } from "@/lib/services/pdf-render";

export const maxDuration = 120;

export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string; reportId: string }> }) {
  const { token, reportId } = await params;
  const r = await lookupPortal(token);
  if (r.state !== "valid") return new NextResponse(null, { status: 404 });
  const report = await prisma.report.findFirst({ where: { id: reportId, mandateId: r.mandate.id, status: "FREIGEGEBEN" } });
  if (!report) return new NextResponse(null, { status: 404 });
  const lang = asLang(req.nextUrl.searchParams.get("lang") ?? r.mandate.buyerLang);
  const pdf = await renderReportPdf(reportId, lang);
  if (!pdf) return NextResponse.json({ error: "PDF nicht verfügbar" }, { status: 503 });
  await audit({ action: "PORTAL_VIEW", entity: "Mandate", entityId: r.mandate.id, meta: { page: `report-pdf:${reportId}`, accessId: r.access.id } });
  return new NextResponse(new Uint8Array(pdf), { headers: pdfResponseHeaders(`Baax-${report.kind === "SUCHBERICHT" ? "Suchbericht" : "Marktbericht"}-${lang}.pdf`) });
}
