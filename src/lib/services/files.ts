import "server-only";
import { randomBytes } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/db";

/**
 * Uploads (Konzept §11): Typ- und Größenprüfung, Dateinamen randomisiert, kein öffentlicher Zugriff.
 * Ablage auf dem Server-Volume (UPLOAD_DIR, Standard ./uploads). Nextcloud/WebDAV ist offener Punkt.
 */

export const UPLOAD_DIR = process.env.UPLOAD_DIR ?? path.join(process.cwd(), "uploads");
export const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB

const ALLOWED: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/heic": ".heic",
  "application/pdf": ".pdf",
  "application/msword": ".doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
  "application/vnd.ms-excel": ".xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
  "text/csv": ".csv",
};

export function isImage(mime: string) {
  return mime.startsWith("image/");
}

export async function storeFile(file: File, meta: { entity: string; entityId: string; kind?: string; userId: string }) {
  if (!(file.type in ALLOWED)) throw new Error(`Dateityp ${file.type || "unbekannt"} ist nicht erlaubt`);
  if (file.size > MAX_FILE_SIZE) throw new Error("Datei ist größer als 25 MB");
  if (file.size === 0) throw new Error("Datei ist leer");

  await mkdir(UPLOAD_DIR, { recursive: true });
  const storedName = randomBytes(16).toString("hex") + ALLOWED[file.type];
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(UPLOAD_DIR, storedName), buffer, { mode: 0o600 });

  return prisma.storedFile.create({
    data: {
      fileName: file.name.slice(0, 200),
      storedName,
      mimeType: file.type,
      size: file.size,
      entity: meta.entity,
      entityId: meta.entityId,
      kind: meta.kind ?? null,
      uploadedById: meta.userId,
    },
  });
}

export async function deleteFile(id: string) {
  const f = await prisma.storedFile.findUnique({ where: { id } });
  if (!f) return;
  await prisma.storedFile.delete({ where: { id } });
  await unlink(path.join(UPLOAD_DIR, f.storedName)).catch(() => undefined);
}

export function filePath(storedName: string) {
  // Nur den Basisnamen zulassen, kein Pfad
  return path.join(UPLOAD_DIR, path.basename(storedName));
}
