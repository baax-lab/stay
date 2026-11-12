import "server-only";
import { asLang, type Lang } from "@/lib/i18n";
import { clientIp } from "@/lib/auth";
import { openPortal, type ResolvedPortal } from "./portal";

/** Gemeinsamer Einstieg aller Portalseiten: Token prüfen, Aufruf protokollieren, Sprache bestimmen. */
export async function enterPortal(token: string, langParam: string | undefined, page: string): Promise<{ r: ResolvedPortal; lang: Lang }> {
  const r = await openPortal(token, await clientIp(), page);
  const lang = langParam ? asLang(langParam) : r.state !== "unknown" ? asLang(r.mandate.buyerLang) : "de";
  return { r, lang };
}
