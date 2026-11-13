import { NextResponse, type NextRequest } from "next/server";
import { clientIp, getSessionUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { createLead } from "@/lib/lead-service";
import { syncLeadToHub } from "@/lib/hub";
import type { LeadInput } from "@/lib/leads";
import { storeCardImage } from "@/lib/services/lead-files";

/**
 * Nachsenden aus dem Offline-Puffer (IndexedDB). Gleiche Prüfung wie die Server Action.
 * Idempotent über clientId.
 */
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  if (!can.createLead(user.role)) return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });

  let body: LeadInput & { cardImage?: unknown };
  try {
    body = (await req.json()) as LeadInput & { cardImage?: unknown };
  } catch {
    return NextResponse.json({ error: "Ungültiger Body" }, { status: 400 });
  }

  const result = await createLead(body, { userId: user.id, ip: await clientIp() });
  if (!result.ok) return NextResponse.json({ error: "Validierung fehlgeschlagen", errors: result.errors }, { status: 422 });

  if (!result.alreadyExisted) {
    // Visitenkartenfoto: Fehler hier dürfen den gespeicherten Kontakt nicht kippen
    if (body.cardImage) await storeCardImage(result.lead.id, body.cardImage, user.id).catch((e) => console.error("Visitenkarte nicht gespeichert:", e instanceof Error ? e.message : e));
    await syncLeadToHub(result.lead.id, user.id);
  }

  return NextResponse.json({
    id: result.lead.id,
    alreadyExisted: result.alreadyExisted,
    duplicates: result.duplicates.map((d) => ({ id: d.id, name: d.name })),
  });
}
