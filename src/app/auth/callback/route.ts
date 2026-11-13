import { NextResponse, type NextRequest } from "next/server";
import { clientIp, createSession, finishHubLogin, HubLoginError } from "@/lib/auth";
import { audit } from "@/lib/audit";

/** Rücksprung vom Baax Hub: ?code=…&state=…[&iss=…] oder ?error=… */
export async function GET(req: NextRequest) {
  try {
    const { user, target } = await finishHubLogin(req.nextUrl.searchParams);
    await createSession(user);
    await audit({ userId: user.id, action: "LOGIN", entity: "Session", meta: { via: "hub", role: user.role, name: user.name, email: user.email }, ip: await clientIp() });
    // relativ weiterleiten, damit es unter jedem Hostnamen funktioniert
    return new NextResponse(null, { status: 303, headers: { location: target } });
  } catch (e) {
    const code = e instanceof HubLoginError ? e.code : "failed";
    const detail = e instanceof Error ? e.message : String(e);
    if (code !== "access_denied" && code !== "login_required") console.error("Hub-Anmeldung fehlgeschlagen:", detail);
    await audit({ action: "LOGIN", entity: "Session", meta: { via: "hub", ok: false, code, error: detail.slice(0, 300) }, ip: await clientIp() });
    return new NextResponse(null, { status: 303, headers: { location: `/auth/login?error=${encodeURIComponent(code)}` } });
  }
}
