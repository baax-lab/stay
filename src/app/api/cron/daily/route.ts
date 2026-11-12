import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";
import { runDailyJobs } from "@/lib/services/cron";

/**
 * Täglicher Job, 7:30 Uhr. Aufruf z. B. per Coolify Scheduled Task oder System-Cron:
 *   curl -H "Authorization: Bearer $CRON_SECRET" https://stay.baax.de/api/cron/daily
 */
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? "";
  if (!env.cronSecret || auth !== `Bearer ${env.cronSecret}`) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  }
  const report = await runDailyJobs();
  return NextResponse.json({ ok: report.errors.length === 0, ...report });
}

export const POST = GET;
