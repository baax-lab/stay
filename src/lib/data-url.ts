/** Bild als data:-Adresse prüfen und zerlegen (Visitenkartenfoto aus dem Erfassungsformular). Rein, getestet. */

export const MAX_CARD_IMAGE_BYTES = 3 * 1024 * 1024;

const PATTERN = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/;

export function parseImageDataUrl(input: unknown, maxBytes = MAX_CARD_IMAGE_BYTES): { mime: string; bytes: Uint8Array<ArrayBuffer> } | null {
  if (typeof input !== "string" || input.length > maxBytes * 1.4 + 100) return null;
  const m = PATTERN.exec(input);
  if (!m) return null;
  const bin = atob(m[2]);
  if (bin.length === 0 || bin.length > maxBytes) return null;
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  // Dateikopf muss zum angegebenen Typ passen
  const head = (n: number) => Array.from(bytes.slice(0, n));
  const ok =
    (m[1] === "image/jpeg" && head(3).join() === [0xff, 0xd8, 0xff].join()) ||
    (m[1] === "image/png" && head(4).join() === [0x89, 0x50, 0x4e, 0x47].join()) ||
    (m[1] === "image/webp" && String.fromCharCode(...head(4)) === "RIFF");
  return ok ? { mime: m[1], bytes } : null;
}
