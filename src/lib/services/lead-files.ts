import "server-only";
import { prisma } from "@/lib/db";
import { parseImageDataUrl } from "@/lib/data-url";
import { deleteFile, storeFile } from "./files";

/** Visitenkartenfoto am Lead (kommt verkleinert als data:-Adresse aus dem Erfassungsformular, auch offline gepuffert). */
export async function storeCardImage(leadId: string, dataUrl: unknown, userId: string) {
  const img = parseImageDataUrl(dataUrl);
  if (!img) return null;
  const ext = img.mime === "image/png" ? ".png" : img.mime === "image/webp" ? ".webp" : ".jpg";
  const file = new File([new Uint8Array(img.bytes)], `visitenkarte${ext}`, { type: img.mime });
  return storeFile(file, { entity: "Lead", entityId: leadId, kind: "VISITENKARTE", userId });
}

/** Dateien an Leads löschen (DSGVO-Löschung, Anonymisierung, Löschkonzept). */
export async function deleteLeadFiles(leadIds: string[]): Promise<number> {
  if (!leadIds.length) return 0;
  const files = await prisma.storedFile.findMany({ where: { entity: "Lead", entityId: { in: leadIds } }, select: { id: true } });
  for (const f of files) await deleteFile(f.id);
  return files.length;
}
