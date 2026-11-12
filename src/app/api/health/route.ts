import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/** Gesundheitsprüfung für Docker, Coolify und Uptime-Monitoring. Keine vertraulichen Angaben. */
export const dynamic = "force-dynamic";

export async function GET() {
  const started = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true, db: "ok", version: process.env.APP_VERSION ?? "dev", ms: Date.now() - started }, { headers: { "cache-control": "no-store" } });
  } catch {
    return NextResponse.json({ ok: false, db: "error", version: process.env.APP_VERSION ?? "dev" }, { status: 503, headers: { "cache-control": "no-store" } });
  }
}
