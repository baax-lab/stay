import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { Card, CardTitle, PageHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { MANDATE_STATUS_LABEL } from "@/lib/mandates";
import { LEAD_STATUS_LABEL } from "@/lib/labels";
import { formatEur } from "@/lib/fees";

export const metadata = { title: "Suche" };

/** Globale Suche über Leads, Suchaufträge, Objekte, Partner und Referrer (Konzept §8.23). */
export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const user = await requireUser();
  const { q = "" } = await searchParams;
  const term = q.trim();
  const ci = { contains: term, mode: "insensitive" as const };
  const showContacts = can.viewLeadContactDetails(user.role);

  const [leads, mandates, properties, partners, referrers] = term
    ? await Promise.all([
        prisma.lead.findMany({ where: { OR: [{ name: ci }, { company: ci }, { interest: ci }, { regions: { has: term } }, ...(showContacts ? [{ email: ci }, { phone: { contains: term } }] : [])] }, take: 20, orderBy: { createdAt: "desc" } }),
        prisma.mandate.findMany({ where: { OR: [{ title: ci }, { buyerName: ci }, { profile: { regions: { has: term.toLowerCase() } } }] }, take: 20, orderBy: { updatedAt: "desc" } }),
        prisma.property.findMany({ where: { active: true, OR: [{ title: ci }, { locality: ci }, { region: { contains: term.toLowerCase() } }, { sourceDetail: ci }, { address: ci }] }, take: 20, orderBy: { createdAt: "desc" } }),
        prisma.partner.findMany({ where: { OR: [{ name: ci }, { company: ci }, { regions: { has: term.toLowerCase() } }] }, take: 20 }),
        prisma.referrer.findMany({ where: { OR: [{ name: ci }, { company: ci }] }, take: 20 }),
      ])
    : [[], [], [], [], []];

  const total = leads.length + mandates.length + properties.length + partners.length + referrers.length;

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Suche" subtitle="Name, Ort, Region, Titel über alle Bereiche" />
      <form action="/suche" className="mb-6 flex gap-2">
        <Input name="q" defaultValue={q} placeholder="z. B. Mallorca, Müller, Pension…" autoFocus />
        <Button type="submit">Suchen</Button>
      </form>
      {term && <p className="mb-4 text-sm text-muted">{total} Ergebnisse für „{term}“</p>}
      <div className="grid gap-4 md:grid-cols-2">
        <Section title={`Leads (${leads.length})`} items={leads.map((l) => ({ id: l.id, href: `/leads/${l.id}`, title: l.name, sub: `${LEAD_STATUS_LABEL[l.status]} · ${l.regions.join(", ")}` }))} />
        <Section title={`Suchaufträge (${mandates.length})`} items={mandates.map((m) => ({ id: m.id, href: `/auftraege/${m.id}`, title: m.title, sub: `${m.buyerName} · ${MANDATE_STATUS_LABEL[m.status]}` }))} />
        <Section title={`Objekte (${properties.length})`} items={properties.map((p) => ({ id: p.id, href: `/objekte/${p.id}`, title: p.title, sub: `${p.locality ?? p.region} · ${formatEur(p.price)}` }))} />
        <Section title={`Partner (${partners.length})`} items={partners.map((p) => ({ id: p.id, href: `/partner/${p.id}`, title: p.name, sub: `${p.type} · ${p.country}` }))} />
        <Section title={`Tippgeber (${referrers.length})`} items={referrers.map((r) => ({ id: r.id, href: `/tippgeber/${r.id}`, title: r.name, sub: r.type }))} />
      </div>
    </div>
  );
}

function Section({ title, items }: { title: string; items: Array<{ id: string; href: string; title: string; sub: string }> }) {
  if (items.length === 0) return null;
  return (
    <Card>
      <CardTitle>{title}</CardTitle>
      <ul className="space-y-1 text-sm">
        {items.map((i) => (
          <li key={i.id}>
            <Link href={i.href} className="font-medium text-petrol hover:underline">
              {i.title}
            </Link>
            <div className="text-xs text-muted">{i.sub}</div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
