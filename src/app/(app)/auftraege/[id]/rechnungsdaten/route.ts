import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import { calculateFee } from "@/lib/fees";
import { csvCell } from "@/lib/leads";

/** Rechnungsdaten als CSV für die Buchhaltung (Konzept §8.16, Rechnung selbst im Hub). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  if (!can.viewFees(user.role)) return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
  const { id } = await params;
  const m = await prisma.mandate.findUnique({ where: { id }, include: { fee: true, closing: true, presentations: true } });
  if (!m || !m.fee) return NextResponse.json({ error: "Kein Honorar" }, { status: 404 });
  const property = m.closing ? await prisma.property.findUnique({ where: { id: m.closing.propertyId } }) : null;
  const calc = calculateFee({ ...m.fee, askingPrice: m.fee.askingPrice, purchasePrice: m.fee.purchasePrice });

  const rows: Array<[string, unknown]> = [
    ["Suchauftrag", m.title],
    ["Käufer", m.buyerName],
    ["Hub-Kontakt-ID", m.hubContactId],
    ["Objekt", property?.title],
    ["Land", property?.country],
    ["Angebotspreis (eingefroren)", m.fee.askingPrice],
    ["Kaufpreis", m.fee.purchasePrice],
    ["Grundhonorar", calc.baseFee],
    ["Erfolgshonorar", calc.successFee],
    ["Ersparnis", calc.savings],
    ["Verhandlungsbonus", calc.bonus],
    ["Reisekosten", calc.travel],
    ["Anrechnung Verkäuferprovision", calc.sellerSideCredited],
    ["Gesamt netto", calc.total],
    ["Beurkundung", m.closing?.notaryDate?.toLocaleDateString("de-DE")],
    ["Übergabe", m.closing?.handoverDate?.toLocaleDateString("de-DE")],
    ["Rechnung gestellt", m.fee.invoicedAt?.toLocaleDateString("de-DE")],
    ["Bezahlt", m.fee.paidAt?.toLocaleDateString("de-DE")],
  ];
  const csv = "﻿" + rows.map(([k, v]) => `${csvCell(k)};${csvCell(v)}`).join("\r\n");
  await audit({ userId: user.id, action: "EXPORT", entity: "Mandate", entityId: id, meta: { kind: "rechnungsdaten" } });
  return new NextResponse(csv, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="rechnungsdaten-${id}.csv"` } });
}
