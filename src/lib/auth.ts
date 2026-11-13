import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { createRemoteJWKSet } from "jose/jwks/remote";
import { jwtVerify } from "jose/jwt/verify";
import { SignJWT } from "jose/jwt/sign";
import type { Role } from "@prisma/client";
import { env } from "./env";
import { SESSION_COOKIE, SESSION_TTL_SECONDS, signSession, verifySession, type SessionUser } from "./session";
import { assertCan, type Permission } from "./permissions";
import { issuerMatches, pkceChallenge, randomToken, roleFromHubClaims, safeEqual } from "./oidc";

/**
 * Anmeldung über den Baax Hub (OpenID Connect, Authorization Code mit PKCE S256, state und nonce).
 *
 * Ablauf (Third-Party Initiated Login, docs/SSO.md im Hub):
 *   Hub-Knopf „Anmelden“ → /auth/hub?iss=…&target_link_uri=… → Hub /oauth/authorize
 *   → /auth/callback?code=…&state=… → Code gegen Tokens tauschen, ID-Token (ES256) prüfen → eigenes Session-Cookie.
 * Rolle aus den Claims role/intern, Verknüpfung über sub (nie über die E-Mail).
 */

const FLOW_COOKIE = "stay_oidc";
const FLOW_ISSUER = "baax-stay-oidc";

export class HubLoginError extends Error {
  constructor(public code: string, message?: string) {
    super(message ?? code);
    this.name = "HubLoginError";
  }
}

type Discovery = { issuer: string; authorization_endpoint: string; token_endpoint: string; jwks_uri: string };
let discoveryCache: { at: number; url: string; doc: Discovery } | undefined;
let jwksCache: { uri: string; set: ReturnType<typeof createRemoteJWKSet> } | undefined;

async function discovery(): Promise<Discovery> {
  if (discoveryCache && discoveryCache.url === env.hub.url && Date.now() - discoveryCache.at < 3600_000) return discoveryCache.doc;
  const res = await fetch(`${env.hub.url}/.well-known/openid-configuration`, { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new HubLoginError("discovery", `Discovery antwortete ${res.status}`);
  const doc = (await res.json()) as Discovery;
  if (!issuerMatches(doc.issuer, env.hub.url)) throw new HubLoginError("discovery", "Issuer passt nicht zu HUB_URL");
  discoveryCache = { at: Date.now(), url: env.hub.url, doc };
  return doc;
}

function flowKey() {
  return new TextEncoder().encode(env.sessionSecret);
}

export function hubCallbackUrl(): string {
  return `${env.appUrl}/auth/callback`;
}

/** Einstieg für die Anmeldeseite: still über den eigenen Anmelde-Einstieg zum Hub (nur Team-App, erlaubt laut Hub). */
export function hubEntryUrl(target: string): string {
  return `/auth/hub?iss=${encodeURIComponent(env.hub.url)}&target_link_uri=${encodeURIComponent(env.appUrl + target)}`;
}

/** Anmeldung beim Hub starten: state, nonce und PKCE im kurzlebigen, signierten Cookie; liefert die Authorize-Adresse. */
export async function startHubLogin(target: string): Promise<string> {
  if (!env.hub.ssoConfigured) throw new HubLoginError("not_configured");
  const d = await discovery();
  const state = randomToken();
  const nonce = randomToken();
  const verifier = randomToken(48);
  const flow = await new SignJWT({ state, nonce, verifier, target })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(FLOW_ISSUER)
    .setIssuedAt()
    .setExpirationTime("10m")
    .sign(flowKey());
  (await cookies()).set(FLOW_COOKIE, flow, { httpOnly: true, sameSite: "lax", secure: env.appUrl.startsWith("https://"), path: "/auth", maxAge: 600 });

  const url = new URL(d.authorization_endpoint);
  url.search = new URLSearchParams({
    response_type: "code",
    client_id: env.hub.clientId!,
    redirect_uri: hubCallbackUrl(),
    scope: "openid profile email",
    state,
    nonce,
    code_challenge: await pkceChallenge(verifier),
    code_challenge_method: "S256",
  }).toString();
  return url.toString();
}

/** Rücksprung vom Hub auswerten. Wirft HubLoginError mit Code für die Anmeldeseite. */
export async function finishHubLogin(params: URLSearchParams): Promise<{ user: SessionUser; target: string }> {
  const store = await cookies();
  const raw = store.get(FLOW_COOKIE)?.value;
  store.delete({ name: FLOW_COOKIE, path: "/auth" });

  const error = params.get("error");
  if (error) throw new HubLoginError(error);
  if (!raw) throw new HubLoginError("expired", "Anmeldevorgang abgelaufen oder in einem anderen Browser gestartet");
  let flow: { state: string; nonce: string; verifier: string; target: string };
  try {
    flow = (await jwtVerify(raw, flowKey(), { issuer: FLOW_ISSUER })).payload as unknown as typeof flow;
  } catch {
    throw new HubLoginError("expired");
  }
  if (!safeEqual(params.get("state") ?? "", flow.state)) throw new HubLoginError("state", "state passt nicht");

  const d = await discovery();
  const iss = params.get("iss");
  if (iss && !issuerMatches(iss, d.issuer)) throw new HubLoginError("issuer", "Rücksprung von fremdem Aussteller");
  const code = params.get("code");
  if (!code) throw new HubLoginError("no_code");

  const res = await fetch(d.token_endpoint, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: hubCallbackUrl(),
      code_verifier: flow.verifier,
      client_id: env.hub.clientId!,
      client_secret: env.hub.clientSecret!,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  const tokens = (await res.json().catch(() => ({}))) as { id_token?: string; error?: string; error_description?: string };
  if (!res.ok || !tokens.id_token) throw new HubLoginError(tokens.error ?? "token", `Token-Abruf: ${tokens.error ?? res.status}${tokens.error_description ? ` (${tokens.error_description})` : ""}`);

  if (!jwksCache || jwksCache.uri !== d.jwks_uri) jwksCache = { uri: d.jwks_uri, set: createRemoteJWKSet(new URL(d.jwks_uri)) };
  let claims: Record<string, unknown>;
  try {
    claims = (await jwtVerify(tokens.id_token, jwksCache.set, { issuer: d.issuer, audience: env.hub.clientId, algorithms: ["ES256"], clockTolerance: 30 })).payload;
  } catch (e) {
    throw new HubLoginError("id_token", `ID-Token ungültig: ${e instanceof Error ? e.message : e}`);
  }
  if (claims.nonce !== flow.nonce) throw new HubLoginError("nonce", "nonce passt nicht");
  if (typeof claims.sub !== "string" || !claims.sub) throw new HubLoginError("id_token", "ID-Token ohne sub");
  const role = roleFromHubClaims(claims);
  if (!role) throw new HubLoginError("role", `Unbekannte Rolle im Hub: ${String(claims.role)}`);

  return {
    user: {
      id: claims.sub,
      name: typeof claims.name === "string" ? claims.name : "",
      email: typeof claims.email === "string" ? claims.email : "",
      role,
    },
    target: flow.target || "/",
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
