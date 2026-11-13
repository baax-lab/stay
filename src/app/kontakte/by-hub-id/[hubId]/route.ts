import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

/**
 * Sprung vom Kontakt im Baax Hub („In Baax Stay öffnen“): Suchauftrag, sonst Lead, sonst Suche.
 * Ohne Sitzung leitet die Middleware zur Anmeldung, die über den Hub zurück hierher führt.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ hubId: string }> }) {
  if (!(await getSessionUser())) return new NextResponse(null, { status: 303, headers: { location: "/auth/login" } });
  const { hubId } = await params;
  const go = (location: string) => new NextResponse(null, { status: 303, headers: { location } });
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(hubId)) return go("/suche");
  const mandate = await prisma.mandate.findFirst({ where: { hubContactId: hubId }, orderBy: { updatedAt: "desc" }, select: { id: true } });
  if (mandate) return go(`/auftraege/${mandate.id}`);
  const lead = await prisma.lead.findFirst({ where: { hubContactId: hubId }, orderBy: { createdAt: "desc" }, select: { id: true } });
  if (lead) return go(`/leads/${lead.id}`);
  return go("/suche");
}
