import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { asLang } from "@/lib/i18n";
import { pdfResponseHeaders, renderDossierPdf } from "@/lib/services/pdf-render";

export const maxDuration = 120;

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  const { id } = await params;
  const lang = asLang(req.nextUrl.searchParams.get("lang"));
  const mandateId = req.nextUrl.searchParams.get("m");
  const property = await prisma.property.findUnique({ where: { id }, select: { title: true } });
  if (!property) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

  const pdf = await renderDossierPdf(id, mandateId, lang);
  if (!pdf) return NextResponse.json({ error: "PDF konnte nicht erzeugt werden (Chromium fehlt oder Seite nicht erreichbar)" }, { status: 503 });
  await audit({ userId: user.id, action: "EXPORT", entity: "Property", entityId: id, meta: { kind: "dossier-pdf", lang, mandateId } });
  const safe = property.title.replace(/[^\w\-äöüÄÖÜß ]+/g, "").trim().replace(/\s+/g, "-").slice(0, 60) || "dossier";
  return new NextResponse(new Uint8Array(pdf), { headers: pdfResponseHeaders(`Dossier-${safe}-${lang}.pdf`) });
}
