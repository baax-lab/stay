import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { safeEqual } from "@/lib/oidc";
import { ACTIVE_STATUSES } from "@/lib/mandates";

/**
 * Status für die App-Kachel im Baax Hub (docs/APP-STATUS.md im Hub):
 *   GET /api/hub/status  mit  Authorization: Bearer <HUB_STATUS_TOKEN>
 * Nur Zahlen, keine personenbezogenen Daten; Kennzahlen 60 Sekunden zwischengespeichert.
 */
export const dynamic = "force-dynamic";

let cache: { at: number; body: unknown } | undefined;

export async function GET(req: Request) {
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!env.hub.statusToken || !safeEqual(token, env.hub.statusToken)) return Response.json({ error: "Nicht autorisiert" }, { status: 401 });
  if (cache && Date.now() - cache.at < 60_000) return Response.json(cache.body);

  const version = (process.env.APP_VERSION || "dev").slice(0, 40);
  let body: unknown;
  try {
    const weekAgo = new Date(Date.now() - 7 * 86_400_000);
    const [openLeads, activeMandates, properties, newMatches, failedSync] = await Promise.all([
      prisma.lead.count({ where: { status: "NEU" } }),
      prisma.mandate.count({ where: { status: { in: ACTIVE_STATUSES } } }),
      prisma.property.count(),
      prisma.match.count({ where: { createdAt: { gte: weekAgo } } }),
      prisma.lead.count({ where: { hubSync: "FAILED" } }),
    ]);
    body = {
      status: failedSync > 0 ? "degraded" : "ok",
      version,
      ...(failedSync > 0 ? { message: `${failedSync} Lead(s) nicht an den Hub übergeben` } : {}),
      metrics: [
        { label: "Offene Leads", value: openLeads },
        { label: "Aktive Suchaufträge", value: activeMandates },
        { label: "Neue Treffer (7 Tage)", value: newMatches },
        { label: "Objekte", value: properties },
      ],
      links: [
        { label: "Leads", url: `${env.appUrl}/leads` },
        { label: "Suchaufträge", url: `${env.appUrl}/auftraege` },
      ],
    };
  } catch {
    body = { status: "down", version, message: "Datenbank nicht erreichbar" };
  }
  cache = { at: Date.now(), body };
  return Response.json(body);
}
