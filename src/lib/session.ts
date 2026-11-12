import { SignJWT } from "jose/jwt/sign";
import { jwtVerify } from "jose/jwt/verify";
import type { Role } from "@prisma/client";

/**
 * Session-Cookie von Baax Stay (unabhängig vom Hub-Token).
 * Edge-kompatibel (nur jose), damit die Middleware es prüfen kann.
 */

export const SESSION_COOKIE = "stay_session";
export const SESSION_TTL_SECONDS = 12 * 60 * 60; // 12 Stunden

export type SessionUser = {
  id: string; // Hub-User-ID (sub)
  name: string;
  email: string;
  role: Role;
};

function key(secret: string) {
  return new TextEncoder().encode(secret);
}

export async function signSession(user: SessionUser, secret: string): Promise<string> {
  return new SignJWT({ name: user.name, email: user.email, role: user.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setIssuer("baax-stay")
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(key(secret));
}

export async function verifySession(token: string, secret: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, key(secret), { issuer: "baax-stay" });
    if (!payload.sub || typeof payload.role !== "string") return null;
    return {
      id: payload.sub,
      name: typeof payload.name === "string" ? payload.name : "",
      email: typeof payload.email === "string" ? payload.email : "",
      role: payload.role as Role,
    };
  } catch {
    return null;
  }
}
