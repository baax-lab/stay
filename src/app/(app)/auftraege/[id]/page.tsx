import Link from "next/link";
import { notFound } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import { MANDATE_STATUS_LABEL } from "@/lib/mandates";
import { formatEur } from "@/lib/fees";
import { mandateRankForProperty } from "@/lib/services/matching";
import { isPriorKnowledge } from "@/lib/matching";
import { ensureFeeAgreement } from "@/lib/services/mandates";
import { Card, Notice, PageHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ActionForm } from "@/components/ui/action-form";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { StatusPanel } from "@/components/mandates/status-panel";
import { ProfileForm, type RegionOption } from "@/components/mandates/profile-form";
import { InterviewForm } from "@/components/mandates/interview-form";
import { MatchesTable, type MatchRow } from "@/components/mandates/matches-table";
import { FeePanel } from "@/components/mandates/fee-panel";
import { Timeline } from "@/components/mandates/timeline";
import { OffersPanel } from "@/components/mandates/offers-panel";
import { ClosingPanel } from "@/components/mandates/closing-panel";
import { FollowUpPanel } from "@/components/mandates/followup-panel";
import { DocumentsPanel } from "@/components/mandates/documents-panel";
import { PartnerSendPanel } from "@/components/mandates/partner-send-panel";
import { saveHeaderAction, saveNoteAction, setGwgAction } from "../actions";
import type { ProfileInput } from "../actions";
import { cn } from "@/lib/cn";

const TABS = [
  ["uebersicht", "Übersicht"],
  ["erstgespraech", "Erstgespräch"],
  ["profil", "Suchprofil"],
  ["treffer", "Treffer"],
  ["angebote", "Angebote"],
  ["kauf", "Kaufabwicklung"],
  ["honorar", "Honorar"],
  ["dokumente", "Dokumente"],
  ["partner", "Partner"],
  ["nachbetreuung", "Nachbetreuung"],
  ["verlauf", "Verlauf"],
] as const;
type Tab = (typeof TABS)[number][0];

export default async function MandatePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const { tab: tabParam } = await searchParams;
  const tab: Tab = (TABS.find((t) => t[0] === tabParam)?.[0] ?? "uebersicht") as Tab;

  const mandate = await prisma.mandate.findUnique({
    where: { id },
    include: {
      profile: true,
      fee: true,
      lead: { select: { id: true, name: true } },
      referrer: { select: { id: true, name: true } },
      matches: { include: { property: true }, orderBy: [{ score: "desc" }, { createdAt: "desc" }] },
      presentations: { include: { property: { select: { id: true, title: true } } } },
      events: { orderBy: { createdAt: "desc" }, take: 200 },
      offers: { include: { property: { select: { id: true, title: true } } }, orderBy: { madeAt: "desc" } },
      closing: true,
      followUps: { orderBy: { dueAt: "asc" } },
      documents: { orderBy: { uploadedAt: "desc" } },
      rewards: { include: { referrer: { select: { name: true } } } },
      partnerSends: { include: { partner: { select: { id: true, name: true, company: true } } }, orderBy: { sentAt: "desc" } },
    },
  });
  if (!mandate) notFound();

  const canEdit = can.editMandates(user.role);
  const canDetails = can.viewBuyerDetails(user.role);
  const canFees = can.viewFees(user.role);
  if (tab === "honorar" && !canFees) return <Notice tone="danger">Honorare sind nur für Leitung und Admin sichtbar.</Notice>;

  const regions: RegionOption[] = await prisma.region.findMany({ orderBy: [{ country: "asc" }, { name: "asc" }], select: { key: true, name: true, country: true, focus: true } });
  const presented = mandate.presentations.map((p) => ({ propertyId: p.propertyId, title: p.property.title, askingPrice: p.askingPrice }));

  const profileInput: ProfileInput = {
    segments: mandate.profile?.segments ?? [],
    countries: mandate.profile?.countries ?? [],
    regions: mandate.profile?.regions ?? [],
    priceMin: mandate.profile?.priceMin ?? null,
    priceMax: mandate.profile?.priceMax ?? 1_000_000,
    usageGoal: mandate.profile?.usageGoal ?? "RENDITE",
    minUnits: mandate.profile?.minUnits ?? null,
    maxUnits: mandate.profile?.maxUnits ?? null,
    licenseRequired: mandate.profile?.licenseRequired ?? true,
    mustCriteria: (mandate.profile?.mustCriteria as string[] | undefined) ?? [],
    wishCriteria: (mandate.profile?.wishCriteria as Array<{ key: string; weight: number }> | undefined) ?? [],
    financing: mandate.profile?.financing ?? null,
    horizon: mandate.profile?.horizon ?? null,
    active: mandate.profile?.active ?? false,
  };

  const openMatches = mandate.matches.filter((m) => m.status !== "ABGELEHNT" && m.status !== "GESCHLOSSEN").length;
  const d = (x: Date | null) => (x ? x.toLocaleDateString("de-DE") : "–");

  return (
    <div>
      <Link href="/auftraege" className="text-sm text-muted hover:text-petrol">
        ← Suchaufträge
      </Link>
      <PageHeader
        title={mandate.title}
        subtitle={`${mandate.buyerName}${mandate.ownerName ? ` · Verantwortlich: ${mandate.ownerName}` : ""} · Laufzeit ${d(mandate.startDate)} – ${d(mandate.endDate)}`}
        action={<Badge tone={mandate.status === "GEKAUFT" || mandate.status === "ABGESCHLOSSEN" ? "ok" : mandate.status === "PAUSIERT" || mandate.status === "BEENDET_OHNE_KAUF" ? "neutral" : "brand"}>{MANDATE_STATUS_LABEL[mandate.status]}</Badge>}
      />

      <Card className="mb-4">
        <StatusPanel mandateId={mandate.id} status={mandate.status} statusBeforePause={mandate.statusBeforePause} gwgDone={Boolean(mandate.gwgIdentifiedAt)} canEdit={canEdit} presented={presented} />
      </Card>

      <nav className="mb-4 flex gap-1 overflow-x-auto pb-1">
        {TABS.filter(([k]) => k !== "honorar" || canFees).map(([k, label]) => (
          <Link key={k} href={`/auftraege/${mandate.id}?tab=${k}`} className={cn("whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-medium", tab === k ? "bg-brand text-petrol" : "bg-surface text-ink border border-line hover:border-brand")}>
            {label}
            {k === "treffer" && openMatches > 0 && <span className="ml-1 rounded-full bg-petrol/10 px-1.5 text-xs">{openMatches}</span>}
          </Link>
        ))}
      </nav>

      {tab === "uebersicht" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <h2 className="mb-3 font-semibold text-petrol">Kopfdaten</h2>
            <ActionForm action={saveHeaderAction.bind(null, mandate.id)}>
              <Field label="Titel">
                <Input name="title" defaultValue={mandate.title} disabled={!canEdit} />
              </Field>
              <Field label="Käufer">
                <Input name="buyerName" defaultValue={mandate.buyerName} disabled={!canEdit} />
              </Field>
              {canDetails ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="E-Mail">
                    <Input name="buyerEmail" defaultValue={mandate.buyerEmail ?? ""} disabled={!canEdit} />
                  </Field>
                  <Field label="Telefon">
                    <Input name="buyerPhone" defaultValue={mandate.buyerPhone ?? ""} disabled={!canEdit} />
                  </Field>
                  <Field label="Hub-Kontakt-ID">
                    <Input name="hubContactId" defaultValue={mandate.hubContactId ?? ""} disabled={!canEdit} />
                  </Field>
                  <Field label="Tippgeber / Referrer">
                    <ReferrerSelect current={mandate.referrerId} disabled={!canEdit} />
                  </Field>
                </div>
              ) : (
                <p className="text-sm text-muted">Kontaktdaten sind für Ihre Rolle nicht sichtbar.</p>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Verantwortlich (Hub-User-ID)">
                  <Input name="ownerId" defaultValue={mandate.ownerId} disabled={!canEdit} />
                </Field>
                <Field label="Verantwortlich (Name)">
                  <Input name="ownerName" defaultValue={mandate.ownerName ?? ""} disabled={!canEdit} />
                </Field>
                <Field label="Laufzeit von">
                  <Input type="date" name="startDate" defaultValue={mandate.startDate?.toISOString().slice(0, 10) ?? ""} disabled={!canEdit} />
                </Field>
                <Field label="Laufzeit bis">
                  <Input type="date" name="endDate" defaultValue={mandate.endDate?.toISOString().slice(0, 10) ?? ""} disabled={!canEdit} />
                </Field>
              </div>
              {canEdit && (
                <Button type="submit" variant="secondary">
                  Kopfdaten speichern
                </Button>
              )}
            </ActionForm>
          </Card>

          <div className="space-y-4">
            <Card>
              <h2 className="mb-3 font-semibold text-petrol">GwG-Identifizierung</h2>
              {mandate.gwgIdentifiedAt ? (
                <Notice tone="ok">
                  Identifiziert am {d(mandate.gwgIdentifiedAt)} ({mandate.gwgIdentType}).
                </Notice>
              ) : (
                <Notice tone="warn">Noch nicht identifiziert. Pflicht vor Status „Beauftragt“.</Notice>
              )}
              {canEdit && (
                <ActionForm action={setGwgAction.bind(null, mandate.id)} className="mt-3">
                  <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                    <Field label="Art">
                      <Select name="gwgIdentType" defaultValue={mandate.gwgIdentType ?? "Ausweis vor Ort"}>
                        <option>Ausweis vor Ort</option>
                        <option>Video-Ident</option>
                        <option>Ausweiskopie beglaubigt</option>
                        <option>Firmenunterlagen (Handelsregister, wirtschaftlich Berechtigte)</option>
                      </Select>
                    </Field>
                    <Field label="Datum">
                      <Input type="date" name="gwgIdentifiedAt" defaultValue={mandate.gwgIdentifiedAt?.toISOString().slice(0, 10) ?? new Date().toISOString().slice(0, 10)} />
                    </Field>
                    <Button type="submit" size="sm" variant="secondary">
                      Speichern
                    </Button>
                  </div>
                </ActionForm>
              )}
            </Card>

            <Card>
              <h2 className="mb-3 font-semibold text-petrol">Stand</h2>
              <dl className="grid grid-cols-2 gap-2 text-sm">
                <dt className="text-muted">Treffer offen</dt>
                <dd>{openMatches}</dd>
                <dt className="text-muted">Vorgestellt</dt>
                <dd>{mandate.presentations.length}</dd>
                <dt className="text-muted">Angebote</dt>
                <dd>{mandate.offers.length}</dd>
                <dt className="text-muted">Suchprofil</dt>
                <dd>{mandate.profile?.active ? "aktiv" : "inaktiv"} · bis {formatEur(mandate.profile?.priceMax)}</dd>
                <dt className="text-muted">Einschätzung</dt>
                <dd>{mandate.assessment ?? "–"}</dd>
                {mandate.endReason && (
                  <>
                    <dt className="text-muted">Beendet, Grund</dt>
                    <dd>{mandate.endReason}</dd>
                  </>
                )}
                {mandate.lead && (
                  <>
                    <dt className="text-muted">Aus Lead</dt>
                    <dd>
                      <Link href={`/leads/${mandate.lead.id}`} className="underline">
                        {mandate.lead.name}
                      </Link>
                    </dd>
                  </>
                )}
                {mandate.rewards.length > 0 && can.viewRewards(user.role) && (
                  <>
                    <dt className="text-muted">Prämie</dt>
                    <dd>
                      {mandate.rewards.map((r) => `${r.referrer.name}: ${formatEur(r.amount)}${r.paidAt ? " (bezahlt)" : r.dueAt ? " (fällig)" : ""}`).join(", ")}
                    </dd>
                  </>
                )}
              </dl>
            </Card>

            {canDetails && (
              <Card>
                <h2 className="mb-3 font-semibold text-petrol">Notiz</h2>
                <ActionForm action={saveNoteAction.bind(null, mandate.id)}>
                  <Textarea name="note" rows={4} defaultValue={mandate.note ?? ""} disabled={!canEdit} />
                  {canEdit && (
                    <Button type="submit" size="sm" variant="secondary">
                      Notiz speichern
                    </Button>
                  )}
                </ActionForm>
              </Card>
            )}
          </div>
        </div>
      )}

      {tab === "erstgespraech" && (
        <Card>
          <InterviewForm mandateId={mandate.id} initial={(mandate.interviewNotes as Record<string, unknown> | null) ?? {}} assessment={mandate.assessment} regions={regions} canEdit={canEdit} profile={profileInput} />
        </Card>
      )}

      {tab === "profil" && (
        <Card>
          <ProfileForm mandateId={mandate.id} initial={profileInput} regions={regions} canEdit={canEdit} />
        </Card>
      )}

      {tab === "treffer" && <MatchesTab mandate={mandate} canEdit={canEdit} canApprove={can.approveSecondBuyer(user.role)} />}

      {tab === "angebote" && (
        <OffersPanel mandateId={mandate.id} offers={mandate.offers} presented={presented} canEdit={canEdit} bonusPct={mandate.fee?.bonusPct ?? 0.1} bonusCap={Math.round((mandate.fee?.bonusCapPct ?? 0.25) * (mandate.fee?.successFee ?? 0))} />
      )}

      {tab === "kauf" && (
        <Card>
          <ClosingPanel mandateId={mandate.id} closing={mandate.closing} presented={presented} canEdit={canEdit} propertyTitle={mandate.closing ? presented.find((p) => p.propertyId === mandate.closing!.propertyId)?.title : undefined} />
        </Card>
      )}

      {tab === "honorar" && canFees && <FeeTab mandateId={mandate.id} userId={user.id} canEdit={canEdit} country={mandate.closing?.country ?? mandate.profile?.countries[0] ?? null} />}

      {tab === "dokumente" && <DocumentsTab mandateId={mandate.id} documents={mandate.documents} canEdit={canEdit} canSeeGwg={can.viewGwgDocuments(user.role)} />}

      {tab === "partner" && (
        <PartnerSendPanel mandateId={mandate.id} sends={mandate.partnerSends} countries={mandate.profile?.countries ?? []} regions={mandate.profile?.regions ?? []} canSend={can.sendExternal(user.role)} />
      )}

      {tab === "nachbetreuung" && (
        <Card>
          <FollowUpPanel mandateId={mandate.id} followUps={mandate.followUps} canEdit={canEdit} />
        </Card>
      )}

      {tab === "verlauf" && (
        <Card>
          <Timeline events={mandate.events} />
        </Card>
      )}
    </div>
  );
}

async function ReferrerSelect({ current, disabled }: { current: string | null; disabled: boolean }) {
  const referrers = await prisma.referrer.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true, type: true } });
  return (
    <Select name="referrerId" defaultValue={current ?? ""} disabled={disabled}>
      <option value="">–</option>
      {referrers.map((r) => (
        <option key={r.id} value={r.id}>
          {r.name} ({r.type})
        </option>
      ))}
    </Select>
  );
}

type MandateWithMatches = Prisma.MandateGetPayload<{ include: { matches: { include: { property: true } }; presentations: true } }>;

async function MatchesTab({ mandate, canEdit, canApprove }: { mandate: Pick<MandateWithMatches, "id" | "matches" | "presentations" | "contractSignedAt">; canEdit: boolean; canApprove: boolean }) {
  const rows: MatchRow[] = [];
  for (const m of mandate.matches) {
    const rank = await mandateRankForProperty(m.propertyId, mandate.id);
    const presentation = mandate.presentations.find((p) => p.propertyId === m.propertyId);
    rows.push({
      id: m.id,
      score: m.score,
      nearMiss: m.nearMiss,
      status: m.status,
      rejectReason: m.rejectReason,
      reasons: m.reasons as MatchRow["reasons"],
      viewingAt: m.viewingAt?.toISOString() ?? null,
      viewingNote: m.viewingNote,
      rank: { rank: rank.rank, total: rank.total, firstTitle: rank.first?.title },
      priorKnowledge: isPriorKnowledge(m.property.knownSince, mandate.contractSignedAt),
      presentation: presentation ? { channel: presentation.channel, askingPrice: presentation.askingPrice, sentAt: presentation.sentAt.toISOString() } : null,
      property: {
        id: m.property.id,
        title: m.property.title,
        locality: m.property.locality,
        region: m.property.region,
        country: m.property.country,
        price: m.property.price,
        segment: m.property.segment,
        licenseLight: m.property.licenseLight,
        availability: m.property.availability,
        knownSince: m.property.knownSince.toISOString(),
      },
    });
  }
  return <MatchesTable mandateId={mandate.id} matches={rows} canEdit={canEdit} canApprove={canApprove} />;
}

async function FeeTab({ mandateId, userId, canEdit, country }: { mandateId: string; userId: string; canEdit: boolean; country: string | null }) {
  const fee = await ensureFeeAgreement(mandateId);
  const bands = await prisma.feeBand.findMany({ orderBy: { volumeFrom: "asc" } });
  await audit({ userId, action: "FEE_VIEW", entity: "Mandate", entityId: mandateId });
  return (
    <Card>
      <FeePanel mandateId={mandateId} fee={fee} bands={bands} country={country} canEdit={canEdit} />
    </Card>
  );
}

async function DocumentsTab({ mandateId, documents, canEdit, canSeeGwg }: { mandateId: string; documents: MandateWithDocs["documents"]; canEdit: boolean; canSeeGwg: boolean }) {
  const files = await prisma.storedFile.findMany({ where: { id: { in: documents.map((d) => d.fileId) } } });
  return (
    <Card>
      <DocumentsPanel mandateId={mandateId} documents={documents} files={new Map(files.map((f) => [f.id, f]))} canEdit={canEdit} canSeeGwg={canSeeGwg} />
    </Card>
  );
}
type MandateWithDocs = Prisma.MandateGetPayload<{ include: { documents: true } }>;
