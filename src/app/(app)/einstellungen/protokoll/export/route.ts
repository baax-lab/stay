import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { clientIp, getSessionUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import { csvCell } from "@/lib/leads";
import { auditWhere, parseAuditFilter } from "@/lib/audit-filter";
import { auditUserNames } from "@/lib/services/audit-view";

/** Protokoll als CSV (nur Admin), höchstens 50.000 Zeilen, selbst protokolliert. */
export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  if (!can.viewAuditLog(user.role)) return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });

  const sp = Object.fromEntries(req.nextUrl.searchParams.entries());
  const filter = parseAuditFilter(sp);
  const rows = await prisma.auditLog.findMany({ where: auditWhere(filter), orderBy: { createdAt: "desc" }, take: 50_000 });
  const names = await auditUserNames(rows.map((r) => r.userId));

  const header = ["Zeitpunkt", "Nutzer-ID", "Nutzer", "IP", "Aktion", "Bereich", "Datensatz-ID", "Details"];
  const lines = rows.map((r) => [r.createdAt.toISOString(), r.userId, r.userId ? names.get(r.userId) : "", r.ip, r.action, r.entity, r.entityId, JSON.stringify(r.meta)]);
  const csv = "﻿" + [header, ...lines].map((l) => l.map(csvCell).join(";")).join("\r\n");

  await audit({ userId: user.id, action: "AUDIT_EXPORT", entity: "AuditLog", meta: { count: rows.length, filter: sp }, ip: await clientIp() });

  return new NextResponse(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="baax-stay-protokoll-${new Date().toISOString().slice(0, 10)}.csv"`,
      "cache-control": "no-store",
    },
  });
}
