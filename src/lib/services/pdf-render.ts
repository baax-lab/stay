import "server-only";
import { env } from "@/lib/env";
import { signPrintToken } from "@/lib/print-token";
import { urlToPdf } from "@/lib/pdf";
import type { Lang } from "@/lib/i18n";

/** Dossier-PDF über die Dossier-Route rendern (gleiche Daten wie Weblink und Portal). */
export async function renderDossierPdf(propertyId: string, mandateId: string | null, lang: Lang): Promise<Buffer | null> {
  const pt = await signPrintToken({ scope: "dossier", id: propertyId, mandateId, lang });
  return urlToPdf(`${env.internalUrl}/dossier/${propertyId}?pt=${encodeURIComponent(pt)}`);
}

export async function renderReportPdf(reportId: string, lang: Lang): Promise<Buffer | null> {
  const pt = await signPrintToken({ scope: "report", id: reportId, lang });
  return urlToPdf(`${env.internalUrl}/bericht/${reportId}?pt=${encodeURIComponent(pt)}`);
}

export function pdfResponseHeaders(fileName: string): HeadersInit {
  return {
    "content-type": "application/pdf",
    "content-disposition": `attachment; filename="${fileName}"`,
    "cache-control": "private, no-store",
  };
}
