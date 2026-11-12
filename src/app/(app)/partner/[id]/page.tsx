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
import { updatePartnerAction } from "../actions";

export default async function PartnerPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const p = await prisma.partner.findUnique({
    where: { id },
    include: {
      properties: { orderBy: { createdAt: "desc" }, select: { id: true, title: true, price: true, availability: true, createdAt: true } },
      sends: { orderBy: { sentAt: "desc" }, include: { mandate: { select: { id: true, title: true } } } },
    },
  });
  if (!p) notFound();
  const regions = await prisma.region.findMany({ orderBy: [{ country: "asc" }, { name: "asc" }], select: { key: true, name: true, country: true } });
  const canEdit = can.editPartners(user.role);

  return (
    <div>
      <Link href="/partner" className="text-sm text-muted hover:text-petrol">
        ← Partner
      </Link>
      <PageHeader title={p.name} subtitle={`${PARTNER_TYPE_LABEL[p.type]} · ${p.country}${p.company ? ` · ${p.company}` : ""}`} action={p.agreementAt ? <Badge tone="ok">Vereinbarung {p.agreementAt.toLocaleDateString("de-DE")}</Badge> : <Badge tone="warn">keine Partnervereinbarung</Badge>} />
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
