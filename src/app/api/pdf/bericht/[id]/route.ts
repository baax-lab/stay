import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { asLang } from "@/lib/i18n";
import { pdfResponseHeaders, renderReportPdf } from "@/lib/services/pdf-render";

export const maxDuration = 120;

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  const { id } = await params;
  const report = await prisma.report.findUnique({ where: { id } });
  if (!report) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
  const lang = asLang(req.nextUrl.searchParams.get("lang"));
  const pdf = await renderReportPdf(id, lang);
  if (!pdf) return NextResponse.json({ error: "PDF konnte nicht erzeugt werden" }, { status: 503 });
  await audit({ userId: user.id, action: "EXPORT", entity: "Report", entityId: id, meta: { kind: "report-pdf", lang } });
  return new NextResponse(new Uint8Array(pdf), { headers: pdfResponseHeaders(`${report.kind === "SUCHBERICHT" ? "Suchbericht" : "Marktbericht"}-${lang}.pdf`) });
}
