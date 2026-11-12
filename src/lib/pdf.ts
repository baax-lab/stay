import "server-only";
import { existsSync } from "node:fs";
import { env } from "./env";

/**
 * PDF aus HTML über Chromium (Playwright). Nutzt CHROMIUM_PATH oder sucht gängige Pfade.
 * Fehlt Chromium, liefert die Funktion null; Aufrufer senden dann ohne PDF.
 */
const CANDIDATES = ["/usr/bin/chromium", "/usr/bin/chromium-browser", "/usr/bin/google-chrome", "/opt/pw-browsers/chromium"];

export function chromiumPath(): string | null {
  if (env.chromiumPath && existsSync(env.chromiumPath)) return env.chromiumPath;
  return CANDIDATES.find((p) => existsSync(p)) ?? null;
}

export async function htmlToPdf(html: string): Promise<Buffer | null> {
  const exe = chromiumPath();
  if (!exe) return null;
  try {
    const { chromium } = await import("playwright-core");
    const browser = await chromium.launch({ executablePath: exe, args: ["--no-sandbox", "--disable-gpu"] });
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: "load" });
      const pdf = await page.pdf({ format: "A4", printBackground: true, margin: { top: "18mm", bottom: "18mm", left: "16mm", right: "16mm" } });
      return Buffer.from(pdf);
    } finally {
      await browser.close();
    }
  } catch (e) {
    console.error("PDF-Erzeugung fehlgeschlagen", e);
    return null;
  }
}

/** Seite per URL rendern und als PDF zurückgeben (Konzept §9.5: Playwright rendert die Dossier-Route). */
export async function urlToPdf(url: string): Promise<Buffer | null> {
  const exe = chromiumPath();
  if (!exe) return null;
  try {
    const { chromium } = await import("playwright-core");
    const browser = await chromium.launch({ executablePath: exe, args: ["--no-sandbox", "--disable-gpu"] });
    try {
      const page = await browser.newPage();
      const res = await page.goto(url, { waitUntil: "networkidle", timeout: 60_000 });
      if (!res || !res.ok()) throw new Error(`Seite antwortete ${res?.status()}`);
      await page.emulateMedia({ media: "print" });
      const pdf = await page.pdf({ format: "A4", printBackground: true, margin: { top: "14mm", bottom: "16mm", left: "14mm", right: "14mm" } });
      return Buffer.from(pdf);
    } finally {
      await browser.close();
    }
  } catch (e) {
    console.error("PDF-Erzeugung fehlgeschlagen", e);
    return null;
  }
}
