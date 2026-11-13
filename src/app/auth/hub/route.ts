import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";
import { HubLoginError, startHubLogin } from "@/lib/auth";
import { issuerMatches, safeTarget } from "@/lib/oidc";

/**
 * Anmelde-Einstieg für den Knopf „Anmelden“ im Baax Hub (Third-Party Initiated Login):
 *   GET /auth/hub?iss=<HUB_URL>[&target_link_uri=<Seite in Baax Stay>]
 * Startet immer eine neue Anmeldung beim Hub (gemeinsam genutzte Rechner), zeigt nie eine eigene Seite.
 */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  if (!issuerMatches(q.get("iss"), env.hub.url)) return new Response("Unbekannter Aussteller", { status: 400 });
  const target = safeTarget(q.get("target_link_uri"), env.appUrl);
  try {
    return NextResponse.redirect(await startHubLogin(target), 302);
  } catch (e) {
    const code = e instanceof HubLoginError ? e.code : "failed";
    console.error("Hub-Anmeldung konnte nicht starten:", e instanceof Error ? e.message : e);
    return new NextResponse(null, { status: 303, headers: { location: `/auth/login?error=${encodeURIComponent(code)}` } });
  }
}
