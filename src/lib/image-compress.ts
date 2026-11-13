"use client";

/**
 * Foto im Browser verkleinern (Visitenkarte): längste Seite höchstens `maxSide`, JPEG.
 * Ergebnis als data:-Adresse, damit es mit dem Kontakt im Offline-Puffer (IndexedDB) liegen kann.
 */
export async function compressImage(file: File, maxSide = 1600, quality = 0.78): Promise<string> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" }).catch(() => null);
  if (!bitmap) {
    // Format, das der Browser nicht dekodiert: unverändert, wenn klein genug
    if (file.size > 2_500_000 || !/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error("Bildformat wird nicht unterstützt");
    return await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = () => reject(r.error);
      r.readAsDataURL(file);
    });
  }
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Bild konnte nicht verarbeitet werden");
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", quality);
}
