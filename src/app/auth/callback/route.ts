import { NextResponse, type NextRequest } from "next/server";
import { createSession, verifyHubToken, clientIp } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { env } from "@/lib/env";

/** Rücksprung vom Hub-Login: ?token=<JWT>&next=/pfad */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  const nextParam = req.nextUrl.searchParams.get("next") ?? "/";
  const next = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/";

  if (!token) {
    return NextResponse.redirect(new URL(`/auth/login?error=${encodeURIComponent("Kein Token vom Hub erhalten")}`, env.appUrl));
  }

  try {
    const user = await verifyHubToken(token);
    await createSession(user);
    await audit({ userId: user.id, action: "LOGIN", entity: "Session", meta: { via: "hub", role: user.role }, ip: await clientIp() });
    return NextResponse.redirect(new URL(next, env.appUrl));
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Login fehlgeschlagen";
    await audit({ action: "LOGIN", entity: "Session", meta: { via: "hub", ok: false, error: msg }, ip: await clientIp() });
    return NextResponse.redirect(new URL(`/auth/login?error=${encodeURIComponent("Hub-Login fehlgeschlagen: " + msg)}`, env.appUrl));
  }
}
