import Link from "next/link";
import { notFound } from "next/navigation";
import type { LeadStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { HUB_SYNC_LABEL, LEAD_ROLE_LABEL, LEAD_SOURCE_LABEL, LEAD_STATUS_LABEL, SEGMENT_LABEL } from "@/lib/labels";
import { formatBudget } from "@/lib/leads";
import { findDuplicates } from "@/lib/lead-service";
import { Card, CardTitle, Notice, PageHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/field";
import { SyncOneButton } from "@/components/leads/sync-buttons";
import { mergeLeadAction, updateLeadNoteAction, updateLeadStatusAction } from "../actions";
import { convertLeadAction } from "@/app/(app)/auftraege/actions";
import { ButtonLink } from "@/components/ui/button";

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const lead = await prisma.lead.findUnique({ where: { id }, include: { duplicateOf: { select: { id: true, name: true } }, duplicates: { select: { id: true, name: true, createdAt: true } }, mandate: { select: { id: true, title: true } }, sellerProperties: { select: { id: true, title: true } } } });
  if (!lead) notFound();

  const showDetails = can.viewLeadContactDetails(user.role);
  const canEdit = can.editLead(user.role);
  const dupes = showDetails ? await findDuplicates({ email: lead.email, phone: lead.phone }, lead.id) : [];

  const fmt = (d: Date | null) => (d ? d.toLocaleString("de-DE", { dateStyle: "medium", timeStyle: "short" }) : "–");

  const statuses: LeadStatus[] = ["NEU", "KONTAKTIERT", "ERSTGESPRAECH", "VERWORFEN"];

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/leads" className="text-sm text-muted hover:text-petrol">
        ← Leads
      </Link>
      <PageHeader
        title={lead.name}
        subtitle={[showDetails ? lead.company : null, LEAD_ROLE_LABEL[lead.role], `${LEAD_SOURCE_LABEL[lead.source]}${lead.sourceDetail ? ` – ${lead.sourceDetail}` : ""}`].filter(Boolean).join(" · ")}
        action={<Badge tone={lead.status === "NEU" ? "brand" : lead.status === "VERWORFEN" ? "neutral" : "warn"}>{LEAD_STATUS_LABEL[lead.status]}</Badge>}
      />

      {lead.duplicateOf && (
        <div className="mb-4">
          <Notice tone="warn">
            Beim Erfassen als mögliche Dublette von{" "}
            <Link href={`/leads/${lead.duplicateOf.id}`} className="font-medium underline">
              {lead.duplicateOf.name}
            </Link>{" "}
            erkannt.
          </Notice>
        </div>
      )}

      {dupes.length > 0 && lead.status !== "VERWORFEN" && (
        <div className="mb-4">
          <Notice tone="warn">
            <div className="font-medium">Gleiche E-Mail oder Telefonnummer wie:</div>
            <ul className="mt-2 space-y-2">
              {dupes.map((d) => (
                <li key={d.id} className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    <Link href={`/leads/${d.id}`} className="underline">
                      {d.name}
                    </Link>{" "}
                    <span className="text-xs">({fmt(d.createdAt)}, {LEAD_STATUS_LABEL[d.status]})</span>
                  </span>
                  {canEdit && (
                    <form action={mergeLeadAction.bind(null, lead.id, d.id)}>
                      <Button type="submit" size="sm" variant="secondary">
                        In diesen zusammenführen
                      </Button>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          </Notice>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardTitle>Kontakt</CardTitle>
          <dl className="space-y-2 text-sm">
            {showDetails ? (
              <>
                <Row k="Telefon" v={lead.phone ? <a href={`tel:${lead.phone}`} className="text-brand-strong underline">{lead.phone}</a> : "–"} />
                <Row k="E-Mail" v={lead.email ? <a href={`mailto:${lead.email}`} className="text-brand-strong underline">{lead.email}</a> : "–"} />
                <Row k="Firma" v={lead.company ?? "–"} />
              </>
            ) : (
              <Row k="Kontaktdaten" v={<span className="text-muted">Für Ihre Rolle nicht sichtbar</span>} />
            )}
            <Row k="Einwilligung E-Mail" v={lead.consentEmail ? <Badge tone="ok">ja, {fmt(lead.consentAt)}</Badge> : <Badge>nein</Badge>} />
            <Row k="Erfasst" v={`${fmt(lead.createdAt)} von ${lead.createdById === "public" ? "Interessenformular" : lead.createdById}`} />
          </dl>
        </Card>

        <Card>
          <CardTitle>Suchprofil (grob)</CardTitle>
          <dl className="space-y-2 text-sm">
            <Row k="Segment" v={lead.segment ? SEGMENT_LABEL[lead.segment] : "–"} />
            <Row k="Regionen" v={lead.regions.length ? lead.regions.join(", ") : "–"} />
            <Row k="Budget" v={formatBudget(lead.budgetMin, lead.budgetMax)} />
            <Row k="Interesse" v={lead.interest ? <span className="whitespace-pre-wrap">{lead.interest}</span> : "–"} />
          </dl>
        </Card>

        <Card>
          <CardTitle>Hub</CardTitle>
          <dl className="space-y-2 text-sm">
            <Row k="Übergabe" v={<Badge tone={lead.hubSync === "SYNCED" ? "ok" : lead.hubSync === "FAILED" ? "danger" : "warn"}>{HUB_SYNC_LABEL[lead.hubSync]}</Badge>} />
            {lead.hubContactId && <Row k="Hub-Kontakt" v={lead.hubContactId} />}
            {lead.hubSyncedAt && <Row k="Übergeben am" v={fmt(lead.hubSyncedAt)} />}
            {lead.hubSyncError && <Row k="Fehler" v={<span className="text-danger">{lead.hubSyncError}</span>} />}
          </dl>
          {lead.hubSync !== "SYNCED" && can.syncHub(user.role) && (
            <div className="mt-4">
              <SyncOneButton leadId={lead.id} />
            </div>
          )}
        </Card>

        <Card>
          <CardTitle>Status</CardTitle>
          {canEdit ? (
            <div className="flex flex-wrap gap-2">
              {statuses.map((s) => (
                <form key={s} action={updateLeadStatusAction.bind(null, lead.id, s)}>
                  <Button type="submit" size="sm" variant={lead.status === s ? "primary" : "secondary"} disabled={lead.status === s || lead.status === "UMGEWANDELT"}>
                    {LEAD_STATUS_LABEL[s]}
                  </Button>
                </form>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted">Statusänderung ab Rolle Mitarbeiter.</p>
          )}
          <div className="mt-4 space-y-2 border-t border-line pt-4">
            {lead.mandate ? (
              <ButtonLink href={`/auftraege/${lead.mandate.id}`} size="sm" variant="secondary">
                Suchauftrag „{lead.mandate.title}“ öffnen
              </ButtonLink>
            ) : lead.role === "KAEUFER" && canEdit ? (
              <form action={convertLeadAction.bind(null, lead.id)}>
                <Button type="submit" size="sm">
                  In Suchauftrag umwandeln
                </Button>
              </form>
            ) : null}
            {lead.role === "VERKAEUFER" && (
              <div className="space-y-1">
                {lead.sellerProperties.map((p) => (
                  <ButtonLink key={p.id} href={`/objekte/${p.id}`} size="sm" variant="secondary">
                    Objekt „{p.title}“ öffnen
                  </ButtonLink>
                ))}
                {canEdit && (
                  <ButtonLink href={`/objekte/neu?sellerLeadId=${lead.id}`} size="sm">
                    Als Off-Market-Objekt anlegen
                  </ButtonLink>
                )}
                <p className="text-xs text-muted">Baax arbeitet auf Käuferseite; bei Wohnungen und Häusern keine Provision vom Verkäufer.</p>
              </div>
            )}
          </div>
        </Card>
      </div>

      {showDetails && (
        <Card className="mt-4">
          <CardTitle>Notiz</CardTitle>
          {canEdit ? (
            <form action={updateLeadNoteAction.bind(null, lead.id)} className="space-y-3">
              <Textarea name="note" defaultValue={lead.note ?? ""} rows={5} />
              <Button type="submit" variant="secondary">
                Notiz speichern
              </Button>
            </form>
          ) : (
            <p className="whitespace-pre-wrap text-sm">{lead.note ?? "–"}</p>
          )}
        </Card>
      )}

      {lead.duplicates.length > 0 && (
        <Card className="mt-4">
          <CardTitle>Als Dublette hierauf verweisen</CardTitle>
          <ul className="text-sm">
            {lead.duplicates.map((d) => (
              <li key={d.id}>
                <Link href={`/leads/${d.id}`} className="underline">
                  {d.name}
                </Link>{" "}
                <span className="text-xs text-muted">({fmt(d.createdAt)})</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[120px_1fr] gap-2">
      <dt className="text-muted">{k}</dt>
      <dd className="text-ink">{v}</dd>
    </div>
  );
}
