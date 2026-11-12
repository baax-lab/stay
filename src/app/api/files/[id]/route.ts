import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import { filePath } from "@/lib/services/files";
import { verifyPrintToken } from "@/lib/print-token";

/** Geschützte Auslieferung von Uploads. GwG-Nachweise nur für Leitung/Admin. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const pt = new URL(req.url).searchParams.get("pt");
  if (pt) {
    // Druck-Token: nur Fotos des Objekts, für das das Dossier gerendert wird
    const scope = await verifyPrintToken(pt);
    const f = await prisma.storedFile.findUnique({ where: { id } });
    if (!scope || scope.scope !== "dossier" || !f || f.entity !== "Property" || f.entityId !== scope.id || f.kind !== "PHOTO") {
      return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
    }
    const data = await readFile(filePath(f.storedName)).catch(() => null);
    if (!data) return NextResponse.json({ error: "Datei nicht lesbar" }, { status: 404 });
    return new NextResponse(data, { headers: { "content-type": f.mimeType, "cache-control": "private, max-age=300" } });
  }

  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  const f = await prisma.storedFile.findUnique({ where: { id } });
  if (!f) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
  if (f.kind === "GWG_NACHWEIS" && !can.viewGwgDocuments(user.role)) return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
  if (f.entity === "Mandate" && !can.viewBuyerDetails(user.role) && f.kind !== "PHOTO" && f.kind !== "OWNER_PHOTO") return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });

  try {
    const data = await readFile(filePath(f.storedName));
    if (f.kind !== "PHOTO" && f.kind !== "OWNER_PHOTO") await audit({ userId: user.id, action: "FILE_VIEW", entity: f.entity, entityId: f.entityId, meta: { fileId: f.id } });
    return new NextResponse(data, {
      headers: {
        "content-type": f.mimeType,
        "content-disposition": `inline; filename="${encodeURIComponent(f.fileName)}"`,
        "cache-control": "private, max-age=300",
        "x-content-type-options": "nosniff",
      },
    });
  } catch {
    return NextResponse.json({ error: "Datei nicht lesbar" }, { status: 404 });
  }
}
