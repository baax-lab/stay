import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import { prisma } from "@/lib/db";
import { filePath } from "@/lib/services/files";
import { isReleased, lookupPortal } from "@/lib/services/portal";

/** Fotos im Portal: nur Fotos freigegebener Objekte des eigenen Suchauftrags und das Foto des Ansprechpartners. */
export async function GET(_req: Request, { params }: { params: Promise<{ token: string; fileId: string }> }) {
  const { token, fileId } = await params;
  const r = await lookupPortal(token);
  if (r.state !== "valid") return new NextResponse(null, { status: 404 });
  const f = await prisma.storedFile.findUnique({ where: { id: fileId } });
  if (!f) return new NextResponse(null, { status: 404 });
  const allowed =
    (f.kind === "OWNER_PHOTO" && r.mandate.ownerPhotoFileId === f.id) ||
    (f.kind === "PHOTO" && f.entity === "Property" && (await isReleased(r.mandate.id, f.entityId)));
  if (!allowed) return new NextResponse(null, { status: 404 });
  const data = await readFile(filePath(f.storedName)).catch(() => null);
  if (!data) return new NextResponse(null, { status: 404 });
  return new NextResponse(data, { headers: { "content-type": f.mimeType, "cache-control": "private, max-age=600", "x-content-type-options": "nosniff" } });
}
