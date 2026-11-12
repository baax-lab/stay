import { NextResponse, type NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import { asLang } from "@/lib/i18n";
import { TEMPLATE_KINDS, TEMPLATE_KIND_LABEL, type TemplateKind } from "@/lib/templates";
import { renderTemplatePdf } from "@/lib/services/pdf-render";
import { pdfResponseHeaders } from "@/lib/services/pdf-render";

export const maxDuration = 120;

export async function GET(req: NextRequest, { params }: { params: Promise<{ kind: string; id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  if (!can.viewBuyerDetails(user.role)) return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
  const { kind, id } = await params;
  if (!TEMPLATE_KINDS.includes(kind as TemplateKind)) return NextResponse.json({ error: "Unbekannte Vorlage" }, { status: 404 });
  const lang = asLang(req.nextUrl.searchParams.get("lang"));
  const pdf = await renderTemplatePdf(kind, id, lang);
  if (!pdf) return NextResponse.json({ error: "PDF konnte nicht erzeugt werden" }, { status: 503 });
  await audit({ userId: user.id, action: "TEMPLATE_RENDER", entity: kind, entityId: id, meta: { lang } });
  return new NextResponse(new Uint8Array(pdf), { headers: pdfResponseHeaders(`${TEMPLATE_KIND_LABEL[kind as TemplateKind]}-${lang}.pdf`) });
}
