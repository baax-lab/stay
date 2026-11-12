import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import type { MarketReportContent, SearchReportContent } from "@/lib/reports";
import { approveReportAction, deleteReportAction, refreshReportAction, saveReportAction } from "@/app/(app)/auftraege/kunden-actions";
import { ActionButton, ActionForm } from "@/components/ui/action-form";
import { Card, CardTitle, Notice, PageHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Textarea } from "@/components/ui/field";
import { ReportView } from "@/components/reports/report-view";

export const metadata = { title: "Bericht" };

export default async function ReportEditPage({ params, searchParams }: { params: Promise<{ id: string; reportId: string }>; searchParams: Promise<{ ok?: string }> }) {
  const user = await requireUser();
  const { id, reportId } = await params;
  const { ok } = await searchParams;
  const report = await prisma.report.findFirst({ where: { id: reportId, mandateId: id }, include: { mandate: { select: { title: true, buyerName: true, buyerLang: true, buyerEmail: true } } } });
  if (!report) notFound();
  const canEdit = can.editMandates(user.role) && report.status === "ENTWURF";
  const isSearch = report.kind === "SUCHBERICHT";
  const lang = report.mandate.buyerLang === "en" ? "en" : "de";

  return (
    <div>
      <Link href={`/auftraege/${id}?tab=berichte`} className="text-sm text-muted hover:text-petrol">
        ← {report.mandate.title}
      </Link>
      <PageHeader
        title={report.title}
        subtitle={isSearch ? "Suchbericht" : "Marktbericht"}
        action={
          <div className="flex flex-wrap items-center gap-2">
            {report.status === "FREIGEGEBEN" ? <Badge tone="ok">freigegeben</Badge> : <Badge tone="warn">Entwurf</Badge>}
            <a href={`/bericht/${report.id}?lang=de`} target="_blank" className="rounded-full border border-line bg-surface px-3 py-1.5 text-sm" rel="noreferrer">
              Vorschau DE
            </a>
            <a href={`/bericht/${report.id}?lang=en`} target="_blank" className="rounded-full border border-line bg-surface px-3 py-1.5 text-sm" rel="noreferrer">
              Vorschau EN
            </a>
            <a href={`/api/pdf/bericht/${report.id}?lang=${lang}`} className="rounded-full bg-petrol px-3 py-1.5 text-sm text-white">
              PDF
            </a>
          </div>
        }
      />
      {ok && (
        <div className="mb-4">
          <Notice tone="ok">{ok}</Notice>
        </div>
      )}
      <div className="grid gap-4 lg:grid-cols-[420px_1fr]">
        <div className="space-y-4">
          {canEdit ? (
            <Card>
              <CardTitle action={<ActionButton action={refreshReportAction.bind(null, id, report.id)} variant="ghost">Neu berechnen</ActionButton>}>Entwurf bearbeiten</CardTitle>
              <ActionForm action={saveReportAction.bind(null, id, report.id)}>
                <Field label="Titel (intern)">
                  <Input name="title" defaultValue={report.title} />
                </Field>
                {isSearch ? (
                  <>
                    <Field label="Marktbeobachtung">
                      <Textarea name="marketNote" rows={5} defaultValue={(report.content as SearchReportContent).marketNote} placeholder="Was tut sich am Markt? Preise, Angebotslage, Besonderheiten" />
                    </Field>
                    <Field label="Nächste Schritte">
                      <Textarea name="nextSteps" rows={4} defaultValue={(report.content as SearchReportContent).nextSteps} />
                    </Field>
                  </>
                ) : (
                  <>
                    <Field label="Einleitung">
                      <Textarea name="intro" rows={3} defaultValue={(report.content as MarketReportContent).intro} />
                    </Field>
                    {(report.content as MarketReportContent).regions.map((r) => (
                      <div key={r.key} className="rounded-xl border border-line p-3">
                        <div className="mb-2 font-medium text-petrol">{r.name}</div>
                        <Field label="Preisniveau">
                          <Textarea name={`priceLevel:${r.key}`} rows={2} defaultValue={r.priceLevel} />
                        </Field>
                        <Field label="Auslastung">
                          <Textarea name={`occupancy:${r.key}`} rows={2} defaultValue={r.occupancy} />
                        </Field>
                        <Field label="Risiken">
                          <Textarea name={`risks:${r.key}`} rows={2} defaultValue={r.risks} />
                        </Field>
                        {!r.licenseRule && <p className="text-xs text-warn">Keine Vermietungsregel hinterlegt (Einstellungen → Regionen).</p>}
                      </div>
                    ))}
                    {(report.content as MarketReportContent).regions.length === 0 && <Notice tone="warn">Im Suchprofil sind keine Regionen bzw. Länder hinterlegt.</Notice>}
                    <Field label="Fazit">
                      <Textarea name="conclusion" rows={3} defaultValue={(report.content as MarketReportContent).conclusion} />
                    </Field>
                  </>
                )}
                <Button type="submit" variant="secondary">
                  Entwurf speichern
                </Button>
              </ActionForm>
            </Card>
          ) : (
            <Notice tone={report.status === "FREIGEGEBEN" ? "ok" : "neutral"}>{report.status === "FREIGEGEBEN" ? `Freigegeben am ${report.approvedAt?.toLocaleDateString("de-DE")}. Im Portal sichtbar.` : "Bearbeiten ab Rolle Mitarbeiter."}</Notice>
          )}
          {canEdit && (
            <Card>
              <CardTitle>Freigabe</CardTitle>
              <ActionForm action={approveReportAction.bind(null, id, report.id)}>
                <p className="text-sm text-muted">Nach der Freigabe ist der Bericht im Portal sichtbar und nicht mehr änderbar.</p>
                <Checkbox name="notify" defaultChecked={Boolean(report.mandate.buyerEmail)} disabled={!report.mandate.buyerEmail} label={report.mandate.buyerEmail ? `Käufer direkt per Mail informieren (${report.mandate.buyerEmail})` : "Keine E-Mail-Adresse hinterlegt – Mail-Entwurf wird angelegt"} />
                <Button type="submit">Bericht freigeben</Button>
              </ActionForm>
              <form action={deleteReportAction.bind(null, id, report.id)} className="mt-3">
                <button className="text-xs text-muted hover:text-danger">Entwurf löschen</button>
              </form>
            </Card>
          )}
        </div>
        <Card>
          <ReportView report={report} buyerName={report.mandate.buyerName} lang={lang} />
        </Card>
      </div>
    </div>
  );
}
