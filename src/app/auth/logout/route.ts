import { NextResponse } from "next/server";
import { destroySession, getSessionUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { env } from "@/lib/env";

async function logout() {
  const user = await getSessionUser();
  await destroySession();
  if (user) await audit({ userId: user.id, action: "LOGOUT", entity: "Session" });
  return NextResponse.redirect(new URL("/auth/login", env.appUrl));
}

export const GET = logout;
export const POST = logout;
