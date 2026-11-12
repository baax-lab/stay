import { NextResponse, type NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import { csvCell } from "@/lib/leads";
import { LEAD_SOURCE_LABEL } from "@/lib/labels";
import { MANDATE_STATUS_LABEL } from "@/lib/mandates";
import { loadAnalytics, parseRange } from "@/lib/services/analytics";

/** CSV-Export der Auswertung (Leitung/Admin), protokolliert. */
export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  if (!can.exportLeads(user.role)) return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
  const sp = Object.fromEntries(req.nextUrl.searchParams.entries());
  const section = sp.section ?? "funnel";
  if (section === "honorar" && !can.viewFees(user.role)) return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
  const range = parseRange(sp);
  const a = await loadAnalytics(range.from, range.to, can.viewFees(user.role));

  let rows: unknown[][];
  if (section === "status") rows = [["Status", "Abgeschlossene Phasen", "Ø Tage", "Median Tage", "Aktuell", "Ø Tage bisher"], ...a.durations.map((d) => [MANDATE_STATUS_LABEL[d.status], d.closed, d.avgDays, d.medianDays, d.current, d.currentAvgDays])];
  else if (section === "honorar") rows = [["Monat", "Käufe", "Honorar", "in Rechnung", "bezahlt"], ...a.fees.map((f) => [f.month, f.count, f.total, f.invoiced, f.paid])];
  else if (section === "referrer") rows = [["Name", "Art", "Leads", "Aufträge", "Käufe", "Honorarvolumen", "Prämien offen", "Prämien bezahlt"], ...a.referrerRows.map((r) => [r.name, r.type, r.leads, r.mandates, r.purchases, r.feeVolume, r.rewardsOpen, r.rewardsPaid])];
  else if (section === "partner") rows = [["Partner", "Land", "Eingereicht", "Vorgestellt", "Käufe", "Profile", "Rückmeldungen", "Bewertung"], ...a.partnerRows.map((p) => [p.name, p.country, p.submitted, p.presented, p.purchases, p.sends, p.replies, p.rating])];
  else rows = [["Quelle", "Leads", "Erstgespräch", "Auftrag", "Kauf"], ...a.funnel.map((r) => [r.source === "OHNE_LEAD" ? "ohne Lead" : LEAD_SOURCE_LABEL[r.source], r.leads, r.interviews, r.mandates, r.purchases])];

  const csv = "﻿" + rows.map((r) => r.map(csvCell).join(";")).join("\r\n");
  await audit({ userId: user.id, action: "EXPORT", entity: "Auswertung", meta: { section, from: range.from.toISOString(), to: range.to.toISOString() } });
  return new NextResponse(csv, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="baax-stay-auswertung-${section}.csv"`, "cache-control": "no-store" } });
}
