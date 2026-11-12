import { NextResponse } from "next/server";
import { destroySession, getSessionUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { env } from "@/lib/env";

/** Abmelden nur per POST: GET-Links werden vom Browser bzw. Next.js vorab geladen und dürfen nichts verändern. */
export async function POST() {
  const user = await getSessionUser();
  await destroySession();
  if (user) await audit({ userId: user.id, action: "LOGOUT", entity: "Session" });
  // 303: nach dem POST mit GET auf die Anmeldeseite
  return NextResponse.redirect(new URL("/auth/login", env.appUrl), 303);
}

export async function GET() {
  return NextResponse.redirect(new URL("/", env.appUrl), 303);
}
