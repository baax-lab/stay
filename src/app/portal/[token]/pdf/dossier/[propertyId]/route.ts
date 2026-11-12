import { NextResponse, type NextRequest } from "next/server";
import { asLang } from "@/lib/i18n";
import { audit } from "@/lib/audit";
import { isReleased, lookupPortal } from "@/lib/services/portal";
import { pdfResponseHeaders, renderDossierPdf } from "@/lib/services/pdf-render";

export const maxDuration = 120;

export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string; propertyId: string }> }) {
  const { token, propertyId } = await params;
  const r = await lookupPortal(token);
  if (r.state !== "valid" || !(await isReleased(r.mandate.id, propertyId))) return new NextResponse(null, { status: 404 });
  const lang = asLang(req.nextUrl.searchParams.get("lang") ?? r.mandate.buyerLang);
  const pdf = await renderDossierPdf(propertyId, r.mandate.id, lang);
  if (!pdf) return NextResponse.json({ error: "PDF nicht verfügbar" }, { status: 503 });
  await audit({ action: "PORTAL_VIEW", entity: "Mandate", entityId: r.mandate.id, meta: { page: `dossier-pdf:${propertyId}`, accessId: r.access.id } });
  return new NextResponse(new Uint8Array(pdf), { headers: pdfResponseHeaders(`Baax-Dossier-${lang}.pdf`) });
}
