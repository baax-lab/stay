import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { createRemoteJWKSet } from "jose/jwks/remote";
import { jwtVerify } from "jose/jwt/verify";
import type { JWTPayload } from "jose";
import type { Role } from "@prisma/client";
import { env } from "./env";
import { SESSION_COOKIE, SESSION_TTL_SECONDS, signSession, verifySession, type SessionUser } from "./session";
import { assertCan, mapHubRole, type Permission } from "./permissions";

/**
 * Hub-Login (SSO).
 *
 * Ablauf: /auth/login → Hub-Login-Seite (redirect_uri) → /auth/callback?token=<JWT>
 * Das Hub-Token wird hier geprüft (HS256 mit gemeinsamem Geheimnis oder JWKS),
 * die Rolle aus dem Claim gelesen und ein eigenes Session-Cookie gesetzt.
 *
 * Erwartete Claims im Hub-Token: sub (User-ID), name, email, role (String oder Array).
 * Claim-Name für die Rolle ist über HUB_ROLE_CLAIM konfigurierbar.
 */

export function hubLoginUrl(next?: string): string {
  const cb = new URL("/auth/callback", env.appUrl);
  if (next) cb.searchParams.set("next", next);
  const url = new URL(env.hub.loginPath, env.hub.url);
  url.searchParams.set("redirect_uri", cb.toString());
  url.searchParams.set("client", "baax-stay");
  return url.toString();
}

let jwks: ReturnType<typeof createRemoteJWKSet> | undefined;

export async function verifyHubToken(token: string): Promise<SessionUser> {
  const opts = {
    issuer: env.hub.issuer,
    audience: env.hub.audience,
    clockTolerance: 30,
  };

  let payload: JWTPayload;
  if (env.hub.jwksUrl) {
    jwks ??= createRemoteJWKSet(new URL(env.hub.jwksUrl));
    payload = (await jwtVerify(token, jwks, opts)).payload;
  } else if (env.hub.jwtSecret) {
    payload = (await jwtVerify(token, new TextEncoder().encode(env.hub.jwtSecret), opts)).payload;
  } else {
    throw new Error("Hub-Login ist nicht konfiguriert (HUB_JWT_SECRET oder HUB_JWKS_URL fehlt)");
  }

  if (!payload.sub) throw new Error("Hub-Token ohne sub");
  const role = mapHubRole(payload[env.hub.roleClaim] ?? payload.roles);
  if (!role) throw new Error("Hub-Token enthält keine bekannte Rolle");

  return {
    id: payload.sub,
    name: typeof payload.name === "string" ? payload.name : "",
    email: typeof payload.email === "string" ? payload.email : "",
    role,
  };
}

export async function createSession(user: SessionUser): Promise<void> {
  const token = await signSession(user, env.sessionSecret);
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.appUrl.startsWith("https://"),
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySession(token, env.sessionSecret);
}

/** Für Seiten: leitet ohne Login zur Anmeldung um. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/auth/login");
  return user;
}

/** Für Server Actions und Route Handler: wirft statt umzuleiten. */
export async function requireUserOrThrow(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new Error("Nicht angemeldet");
  return user;
}

export async function requirePermission(permission: Permission): Promise<SessionUser> {
  const user = await requireUserOrThrow();
  assertCan(user.role, permission);
  return user;
}

export async function clientIp(): Promise<string | undefined> {
  const h = await headers();
  const fwd = h.get("x-forwarded-for");
  return fwd?.split(",")[0]?.trim() || h.get("x-real-ip") || undefined;
}

export type { SessionUser, Role };
