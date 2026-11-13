import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { formatEur } from "@/lib/fees";
import { MANDATE_STATUS_LABEL } from "@/lib/mandates";
import { Card, CardTitle, PageHeader } from "@/components/ui/card";
import { NumberInput } from "@/components/ui/number-input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ActionForm } from "@/components/ui/action-form";
import { Field, Input, Select } from "@/components/ui/field";
import { ReferrerFields } from "@/components/partners/referrer-form";
import { DocumentFromTemplate } from "@/components/templates/document-from-template";
import { createRewardAction, setRewardDateAction, updateReferrerAction } from "@/app/(app)/partner/actions";

export default async function ReferrerPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const r = await prisma.referrer.findUnique({
    where: { id },
    include: {
      mandates: { orderBy: { createdAt: "desc" }, select: { id: true, title: true, status: true, buyerName: true } },
      properties: { orderBy: { createdAt: "desc" }, select: { id: true, title: true, price: true } },
      rewards: { orderBy: { createdAt: "desc" }, include: { mandate: { select: { id: true, title: true } } } },
    },
  });
  if (!r) notFound();
  const leads = await prisma.lead.findMany({ where: { referrerId: id }, orderBy: { createdAt: "desc" }, select: { id: true, name: true, status: true, createdAt: true } });
  const canEdit = can.editPartners(user.role);
  const showRewards = can.viewRewards(user.role);

  return (
    <div>
      <Link href="/tippgeber" className="text-sm text-muted hover:text-petrol">
        ← Tippgeber
      </Link>
      <PageHeader title={r.name} subtitle={`${r.type}${r.company ? ` · ${r.company}` : ""}`} />
      {can.viewBuyerDetails(user.role) && <DocumentFromTemplate kind="TIPPGEBERBESTAETIGUNG" entityId={r.id} canSave={false} />}
      <div className="grid gap-4 lg:grid-cols-[1fr_400px]">
        <div className="space-y-4">
          <Card>
            <CardTitle>Stammdaten und Prämienregel</CardTitle>
            <ActionForm action={updateReferrerAction.bind(null, r.id)}>
              <ReferrerFields r={r} disabled={!canEdit} />
              {canEdit && <Button type="submit">Speichern</Button>}
            </ActionForm>
          </Card>
          {showRewards && (
            <Card>
              <CardTitle>Prämien</CardTitle>
              <ul className="space-y-2">
                {r.rewards.map((w) => (
                  <li key={w.id} className="rounded-xl border border-line p-3 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <Link href={`/auftraege/${w.mandate.id}`} className="font-medium text-petrol hover:underline">
                          {w.mandate.title}
                        </Link>
                        <div className="text-xs text-muted">{w.basis}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{formatEur(w.amount)}</span>
                        {w.paidAt ? <Badge tone="ok">bezahlt {w.paidAt.toLocaleDateString("de-DE")}</Badge> : w.dueAt ? <Badge tone="warn">fällig {w.dueAt.toLocaleDateString("de-DE")}</Badge> : <Badge>vorgeschlagen</Badge>}
                      </div>
                    </div>
                    {canEdit && (
                      <div className="mt-2 flex flex-wrap gap-3">
                        <ActionForm action={setRewardDateAction.bind(null, w.id, "dueAt")} className="flex items-end gap-2">
                          <Field label="Fällig am">
                            <Input type="date" name="dueAt" defaultValue={w.dueAt?.toISOString().slice(0, 10) ?? ""} />
                          </Field>
                          <Button type="submit" size="sm" variant="secondary">
                            Setzen
                          </Button>
                        </ActionForm>
                        <ActionForm action={setRewardDateAction.bind(null, w.id, "paidAt")} className="flex items-end gap-2">
                          <Field label="Bezahlt am">
                            <Input type="date" name="paidAt" defaultValue={w.paidAt?.toISOString().slice(0, 10) ?? ""} />
                          </Field>
                          <Button type="submit" size="sm" variant="secondary">
                            Setzen
                          </Button>
                        </ActionForm>
                      </div>
                    )}
                  </li>
                ))}
                {r.rewards.length === 0 && <li className="text-sm text-muted">Noch keine Prämien. Werden bei Status „Gekauft“ vorgeschlagen.</li>}
              </ul>
              {canEdit && r.mandates.length > 0 && (
                <ActionForm action={createRewardAction.bind(null, r.id)} resetOnSuccess className="mt-4 border-t border-line pt-4">
                  <div className="grid gap-3 sm:grid-cols-[1fr_120px_auto] sm:items-end">
                    <Field label="Prämie manuell für">
                      <Select name="mandateId">
                        {r.mandates.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.title}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field label="Betrag (€)">
                      <NumberInput name="amount" />
                    </Field>
                    <Button type="submit" size="sm" variant="secondary">
                      Anlegen
                    </Button>
                  </div>
                </ActionForm>
              )}
            </Card>
          )}
        </div>
        <div className="space-y-4">
          <Card>
            <CardTitle>Gebrachte Leads ({leads.length})</CardTitle>
            <ul className="space-y-1 text-sm">
              {leads.map((l) => (
                <li key={l.id} className="flex justify-between gap-2">
                  <Link href={`/leads/${l.id}`} className="truncate text-petrol hover:underline">
                    {l.name}
                  </Link>
                  <span className="shrink-0 text-xs text-muted">{l.status}</span>
                </li>
              ))}
              {leads.length === 0 && <li className="text-muted">Keine.</li>}
            </ul>
          </Card>
          <Card>
            <CardTitle>Suchaufträge ({r.mandates.length})</CardTitle>
            <ul className="space-y-1 text-sm">
              {r.mandates.map((m) => (
                <li key={m.id} className="flex justify-between gap-2">
                  <Link href={`/auftraege/${m.id}`} className="truncate text-petrol hover:underline">
                    {m.title}
                  </Link>
                  <span className="shrink-0 text-xs text-muted">{MANDATE_STATUS_LABEL[m.status]}</span>
                </li>
              ))}
              {r.mandates.length === 0 && <li className="text-muted">Keine.</li>}
            </ul>
          </Card>
          <Card>
            <CardTitle>Objekte ({r.properties.length})</CardTitle>
            <ul className="space-y-1 text-sm">
              {r.properties.map((p) => (
                <li key={p.id} className="flex justify-between gap-2">
                  <Link href={`/objekte/${p.id}`} className="truncate text-petrol hover:underline">
                    {p.title}
                  </Link>
                  <span className="shrink-0 text-xs text-muted">{formatEur(p.price)}</span>
                </li>
              ))}
              {r.properties.length === 0 && <li className="text-muted">Keine.</li>}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
