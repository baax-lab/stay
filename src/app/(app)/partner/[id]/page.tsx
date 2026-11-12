import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { formatEur } from "@/lib/fees";
import { Card, CardTitle, PageHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ActionForm } from "@/components/ui/action-form";
import { PartnerFields, PARTNER_TYPE_LABEL } from "@/components/partners/partner-form";
import { extendPartnerAccessAction, ratePartnerAction, revokePartnerAccessAction, updatePartnerAction } from "../actions";
import { ActionButton } from "@/components/ui/action-form";
import { Field, Select, Textarea } from "@/components/ui/field";
import { PartnerAccessButtons } from "@/components/partners/partner-access-buttons";
import { accessState } from "@/lib/portal";
import { averageRatings, hitRate, ratingScore } from "@/lib/partner-stats";
import { mandateRef } from "@/lib/services/partner-access";
import { DocumentFromTemplate } from "@/components/templates/document-from-template";

export default async function PartnerPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const p = await prisma.partner.findUnique({
    where: { id },
    include: {
      properties: { orderBy: { createdAt: "desc" }, select: { id: true, title: true, price: true, availability: true, createdAt: true, submittedViaAccessId: true, _count: { select: { presentations: true } } } },
      sends: { orderBy: { sentAt: "desc" }, include: { mandate: { select: { id: true, title: true } } } },
      accesses: { orderBy: { createdAt: "desc" }, take: 20 },
      ratings: { orderBy: { createdAt: "desc" }, include: { mandate: { select: { title: true } } } },
    },
  });
  if (!p) notFound();
  const regions = await prisma.region.findMany({ orderBy: [{ country: "asc" }, { name: "asc" }], select: { key: true, name: true, country: true } });
  const canEdit = can.editPartners(user.role);
  const propIds = p.properties.map((x) => x.id);
  const closings = propIds.length ? await prisma.closing.count({ where: { propertyId: { in: propIds } } }) : 0;
  const presented = p.properties.filter((x) => x._count.presentations > 0).length;
  const replies = p.sends.filter((x) => x.repliedAt).length;
  const avg = averageRatings(p.ratings);
  const activeMandates = await prisma.mandate.findMany({ where: { status: { in: ["BEAUFTRAGT", "ANALYSE", "SUCHE", "PRUEFUNG", "VERHANDLUNG"] } }, select: { id: true, title: true }, orderBy: { updatedAt: "desc" }, take: 50 });
  const ratingMandates = await prisma.mandate.findMany({ where: { OR: [{ partnerSends: { some: { partnerId: p.id } } }, { matches: { some: { property: { partnerId: p.id } } } }] }, select: { id: true, title: true }, take: 50 });

  return (
    <div>
      <Link href="/partner" className="text-sm text-muted hover:text-petrol">
        ← Partner
      </Link>
      <PageHeader title={p.name} subtitle={`${PARTNER_TYPE_LABEL[p.type]} · ${p.country}${p.company ? ` · ${p.company}` : ""}`} action={p.agreementAt ? <Badge tone="ok">Vereinbarung {p.agreementAt.toLocaleDateString("de-DE")}</Badge> : <Badge tone="warn">keine Partnervereinbarung</Badge>} />
      {can.viewBuyerDetails(user.role) && <DocumentFromTemplate kind="PARTNERVEREINBARUNG" entityId={p.id} canSave={false} />}
      <Card className="mb-4">
        <CardTitle>Leistungsübersicht</CardTitle>
        <div className="grid grid-cols-2 gap-3 text-center sm:grid-cols-3 lg:grid-cols-6" data-testid="partner-stats">
          {[
            ["Eingereicht", String(p.properties.length)],
            ["davon über Zugang", String(p.properties.filter((x) => x.submittedViaAccessId).length)],
            ["Vorgestellt", `${presented}${hitRate(p.properties.length, presented) != null ? ` (${hitRate(p.properties.length, presented)} %)` : ""}`],
            ["Abschlüsse", String(closings)],
            ["Profile erhalten / Rückmeldungen", `${p.sends.length} / ${replies}`],
            ["Bewertung", avg.score != null ? `${avg.score.toLocaleString("de-DE")} / 5 (${avg.count})` : "–"],
          ].map(([k, v]) => (
            <div key={k} className="rounded-xl bg-canvas p-3">
              <div className="text-xl font-semibold text-petrol">{v}</div>
              <div className="text-xs text-muted">{k}</div>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
        <Card>
          <CardTitle>Stammdaten</CardTitle>
          <ActionForm action={updatePartnerAction.bind(null, p.id)}>
            <PartnerFields p={p} regions={regions} disabled={!canEdit} />
            {canEdit && <Button type="submit">Speichern</Button>}
          </ActionForm>
        </Card>
        <div className="space-y-4">
          <Card>
            <CardTitle>Partnerzugang</CardTitle>
            <p className="mb-3 text-xs text-muted">Link ohne Passwort, 90 Tage gültig. Der Partner sieht anonymisierte Suchprofile und reicht Objekte direkt ein (Sprachen DE, EN, ES, IT, FR).</p>
            {!p.agreementAt && <p className="mb-2 text-xs text-warn">Keine Partnervereinbarung hinterlegt.</p>}
            {can.sendExternal(user.role) && <PartnerAccessButtons partnerId={p.id} hasEmail={Boolean(p.email)} mandates={activeMandates.map((m) => ({ id: m.id, label: `${mandateRef(m.id)} · ${m.title}` }))} />}
            <ul className="mt-3 space-y-1 text-xs">
              {p.accesses.map((a) => {
                const st = accessState(a);
                return (
                  <li key={a.id} className="flex flex-wrap items-center justify-between gap-1 rounded-lg bg-canvas px-2 py-1">
                    <span>
                      <Badge tone={st === "valid" ? "ok" : st === "revoked" ? "danger" : "neutral"}>{st === "valid" ? "gültig" : st === "revoked" ? "widerrufen" : "abgelaufen"}</Badge> bis {a.expiresAt.toLocaleDateString("de-DE")} · {a.viewCount} Aufrufe{a.mandateId ? ` · nur ${mandateRef(a.mandateId)}` : ""}
                    </span>
                    {can.sendExternal(user.role) && (
                      <span className="flex gap-1">
                        <ActionButton action={extendPartnerAccessAction.bind(null, p.id, a.id)} variant="ghost">
                          Verlängern
                        </ActionButton>
                        {st !== "revoked" && (
                          <ActionButton action={revokePartnerAccessAction.bind(null, p.id, a.id)} variant="ghost">
                            Widerrufen
                          </ActionButton>
                        )}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </Card>
          <Card>
            <CardTitle>Bewertung nach Zusammenarbeit</CardTitle>
            {avg.count > 0 && (
              <p className="mb-2 text-sm">
                Zuverlässigkeit {avg.reliability?.toLocaleString("de-DE")} · Objektqualität {avg.quality?.toLocaleString("de-DE")} · Reaktionszeit {avg.speed?.toLocaleString("de-DE")}
              </p>
            )}
            <ul className="mb-3 space-y-1 text-xs">
              {p.ratings.map((r) => (
                <li key={r.id} className="rounded-lg bg-canvas px-2 py-1">
                  <span className="font-medium">{ratingScore(r).toLocaleString("de-DE")} / 5</span> · {r.createdAt.toLocaleDateString("de-DE")} · {r.ratedByName ?? r.ratedById}
                  {r.mandate ? ` · ${r.mandate.title}` : ""}
                  {r.comment && <div className="text-muted">{r.comment}</div>}
                </li>
              ))}
            </ul>
            {canEdit && (
              <ActionForm action={ratePartnerAction.bind(null, p.id)} resetOnSuccess>
                {(
                  [
                    ["reliability", "Zuverlässigkeit"],
                    ["quality", "Objektqualität"],
                    ["speed", "Reaktionszeit"],
                  ] as const
                ).map(([k, label]) => (
                  <Field key={k} label={label}>
                    <Select name={k} defaultValue="">
                      <option value="" disabled>
                        –
                      </option>
                      {[5, 4, 3, 2, 1].map((n) => (
                        <option key={n} value={n}>
                          {n} {"★".repeat(n)}
                        </option>
                      ))}
                    </Select>
                  </Field>
                ))}
                <Field label="Zum Suchauftrag (optional)">
                  <Select name="mandateId" defaultValue="">
                    <option value="">–</option>
                    {ratingMandates.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.title}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Kommentar">
                  <Textarea name="comment" rows={2} />
                </Field>
                <Button type="submit" size="sm">
                  Bewertung speichern
                </Button>
              </ActionForm>
            )}
          </Card>
          <Card>
            <CardTitle>Eingereichte Objekte ({p.properties.length})</CardTitle>
            <ul className="space-y-1 text-sm">
              {p.properties.map((x) => (
                <li key={x.id} className="flex justify-between gap-2">
                  <Link href={`/objekte/${x.id}`} className="truncate text-petrol hover:underline">
                    {x.title}
                  </Link>
                  <span className="shrink-0 text-xs text-muted">{formatEur(x.price)}</span>
                </li>
              ))}
              {p.properties.length === 0 && <li className="text-muted">Noch keine.</li>}
            </ul>
          </Card>
          <Card>
            <CardTitle>Erhaltene Suchprofile ({p.sends.length})</CardTitle>
            <ul className="space-y-1 text-sm">
              {p.sends.map((s) => (
                <li key={s.id} className="flex justify-between gap-2">
                  <Link href={`/auftraege/${s.mandate.id}?tab=partner`} className="truncate text-petrol hover:underline">
                    {s.mandate.title}
                  </Link>
                  <span className="shrink-0 text-xs text-muted">
                    {s.sentAt.toLocaleDateString("de-DE")} {s.repliedAt ? "· Rückmeldung" : ""}
                  </span>
                </li>
              ))}
              {p.sends.length === 0 && <li className="text-muted">Noch keine.</li>}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
