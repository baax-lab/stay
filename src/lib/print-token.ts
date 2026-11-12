import { SignJWT } from "jose/jwt/sign";
import { jwtVerify } from "jose/jwt/verify";

/**
 * Kurzlebiges Druck-Token (5 Minuten) für die PDF-Erzeugung: Chromium ruft die Dossier- bzw. Berichtsseite
 * ohne Login auf; das Token erlaubt genau diese eine Ansicht.
 */
export type PrintScope = { scope: "dossier" | "report" | "template"; id: string; mandateId?: string | null; lang: "de" | "en" };

const ISSUER = "baax-stay-print";

function key() {
  const s = process.env.SESSION_SECRET ?? "";
  if (s.length < 32) throw new Error("SESSION_SECRET fehlt");
  return new TextEncoder().encode(s);
}

export async function signPrintToken(p: PrintScope, ttlSeconds = 300): Promise<string> {
  return new SignJWT({ scope: p.scope, id: p.id, mandateId: p.mandateId ?? null, lang: p.lang })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(ISSUER)
    .setIssuedAt()
    .setExpirationTime(`${ttlSeconds}s`)
    .sign(key());
}

export async function verifyPrintToken(token: string | null | undefined): Promise<PrintScope | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(), { issuer: ISSUER });
    if ((payload.scope !== "dossier" && payload.scope !== "report" && payload.scope !== "template") || typeof payload.id !== "string") return null;
    return { scope: payload.scope, id: payload.id, mandateId: typeof payload.mandateId === "string" ? payload.mandateId : null, lang: payload.lang === "en" ? "en" : "de" };
  } catch {
    return null;
  }
}
