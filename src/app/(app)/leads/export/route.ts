import { NextResponse, type NextRequest } from "next/server";
import type { LeadRole, LeadSource, LeadStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { clientIp, getSessionUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import { csvCell, formatBudget } from "@/lib/leads";
import { LEAD_ROLE_LABEL, LEAD_SOURCE_LABEL, LEAD_STATUS_LABEL, SEGMENT_LABEL, HUB_SYNC_LABEL } from "@/lib/labels";

/** CSV-Export (nur LEITUNG/ADMIN), protokolliert im AuditLog. */
export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  if (!can.exportLeads(user.role)) return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });

  const sp = req.nextUrl.searchParams;
  const where: Prisma.LeadWhereInput = {};
  const source = sp.get("source");
  const role = sp.get("role");
  const status = sp.get("status");
  const sync = sp.get("sync");
  if (source && source in LEAD_SOURCE_LABEL) where.source = source as LeadSource;
  if (role && role in LEAD_ROLE_LABEL) where.role = role as LeadRole;
  if (status && status in LEAD_STATUS_LABEL) where.status = status as LeadStatus;
  if (sync === "PENDING" || sync === "FAILED" || sync === "SYNCED") where.hubSync = sync;

  const leads = await prisma.lead.findMany({ where, orderBy: { createdAt: "desc" } });

  const header = [
    "ID", "Erfasst am", "Name", "Firma", "E-Mail", "Telefon", "Rolle", "Quelle", "Quelle Detail", "Interesse", "Segment", "Regionen",
    "Budget", "Budget von", "Budget bis", "Einwilligung E-Mail", "Einwilligung am", "Status", "Hub-Übergabe", "Hub-Kontakt-ID", "Dublette von", "Notiz",
  ];
  const rows = leads.map((l) => [
    l.id,
    l.createdAt.toLocaleString("de-DE"),
    l.name,
    l.company,
    l.email,
    l.phone,
    LEAD_ROLE_LABEL[l.role],
    LEAD_SOURCE_LABEL[l.source],
    l.sourceDetail,
    l.interest,
    l.segment ? SEGMENT_LABEL[l.segment] : "",
    l.regions,
    formatBudget(l.budgetMin, l.budgetMax),
    l.budgetMin,
    l.budgetMax,
    l.consentEmail ? "ja" : "nein",
    l.consentAt?.toLocaleString("de-DE") ?? "",
    LEAD_STATUS_LABEL[l.status],
    HUB_SYNC_LABEL[l.hubSync],
    l.hubContactId,
    l.duplicateOfId,
    l.note,
  ]);

  // Semikolon als Trennzeichen und BOM, damit Excel (DE) die Datei direkt richtig öffnet.
  const csv = "﻿" + [header, ...rows].map((r) => r.map(csvCell).join(";")).join("\r\n");

  await audit({ userId: user.id, action: "LEAD_EXPORT", entity: "Lead", meta: { count: leads.length, filter: Object.fromEntries(sp.entries()) }, ip: await clientIp() });

  const date = new Date().toISOString().slice(0, 10);
  return new NextResponse(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="baax-stay-leads-${date}.csv"`,
      "cache-control": "no-store",
    },
  });
}
