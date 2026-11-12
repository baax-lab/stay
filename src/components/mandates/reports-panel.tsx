import Link from "next/link";
import { prisma } from "@/lib/db";
import { createMarketReportAction, createSearchReportAction } from "@/app/(app)/auftraege/kunden-actions";
import { Card, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/field";

export async function ReportsPanel({ mandateId, canEdit, status }: { mandateId: string; canEdit: boolean; status: string }) {
  const reports = await prisma.report.findMany({ where: { mandateId }, orderBy: { createdAt: "desc" } });
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
      <Card>
        <CardTitle>Berichte</CardTitle>
        <ul className="space-y-2">
          {reports.map((r) => (
            <li key={r.id}>
              <Link href={`/auftraege/${mandateId}/berichte/${r.id}`} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line px-4 py-3 text-sm hover:border-brand">
                <span>
                  <span className="font-medium text-petrol">{r.title}</span>
                  <span className="ml-2 text-xs text-muted">{r.kind === "SUCHBERICHT" ? "Suchbericht" : "Marktbericht"}</span>
                </span>
                {r.status === "FREIGEGEBEN" ? <Badge tone="ok">freigegeben {r.approvedAt?.toLocaleDateString("de-DE")}</Badge> : <Badge tone="warn">Entwurf</Badge>}
              </Link>
            </li>
          ))}
          {reports.length === 0 && <li className="text-sm text-muted">Noch keine Berichte. Suchberichte entstehen monatlich automatisch als Entwurf.</li>}
        </ul>
      </Card>
      {canEdit && (
        <div className="space-y-4">
          <Card>
            <CardTitle>Suchbericht</CardTitle>
            <p className="mb-3 text-xs text-muted">Neu gesichtet, vorgestellt, aussortiert mit Grund, Marktbeobachtung, nächste Schritte.</p>
            <form action={createSearchReportAction.bind(null, mandateId)} className="space-y-3">
              <Select name="period" defaultValue="previous">
                <option value="previous">Vormonat</option>
                <option value="current">Laufender Monat bis heute</option>
              </Select>
              <Button type="submit" variant="secondary">
                Entwurf erstellen
              </Button>
            </form>
          </Card>
          <Card>
            <CardTitle>Marktbericht</CardTitle>
            <p className="mb-3 text-xs text-muted">Je Zielregion: Vermietungsregeln, Nebenkosten, Preisniveau, Auslastung, Risiken. Gedacht für die Phase „Analyse“{status === "ANALYSE" ? " (aktuell)" : ""}.</p>
            <form action={createMarketReportAction.bind(null, mandateId)}>
              <Button type="submit" variant="secondary">
                Entwurf erstellen
              </Button>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
