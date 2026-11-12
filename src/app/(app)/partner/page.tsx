import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { PageHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Table, Td, Th } from "@/components/ui/table";
import { PARTNER_TYPE_LABEL } from "@/components/partners/partner-form";
import { averageRatings, hitRate } from "@/lib/partner-stats";

export const metadata = { title: "Partner" };

export default async function PartnersPage({ searchParams }: { searchParams: Promise<{ q?: string; country?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const partners = await prisma.partner.findMany({
    where: {
      ...(sp.country ? { country: sp.country } : {}),
      ...(sp.q ? { OR: [{ name: { contains: sp.q, mode: "insensitive" } }, { company: { contains: sp.q, mode: "insensitive" } }] } : {}),
    },
    orderBy: [{ country: "asc" }, { name: "asc" }],
    include: { _count: { select: { properties: true, sends: true } }, ratings: { select: { reliability: true, quality: true, speed: true } }, properties: { select: { _count: { select: { presentations: true } } } } },
  });
  const regions = await prisma.region.findMany({ select: { key: true, name: true } });
  const rn = Object.fromEntries(regions.map((r) => [r.key, r.name]));

  return (
    <div>
      <PageHeader
        title="Partner"
        subtitle="Partnermakler, Agenturen, Anwälte, Notare, Finanzierer je Land und Region"
        action={
          <div className="flex gap-2">
            {can.importData(user.role) && (
              <ButtonLink href="/partner/import" variant="secondary">
                CSV-Import
              </ButtonLink>
            )}
            {can.editPartners(user.role) && <ButtonLink href="/partner/neu">Partner anlegen</ButtonLink>}
          </div>
        }
      />
      <form action="/partner" className="mb-4 flex gap-2">
        <input name="q" defaultValue={sp.q ?? ""} placeholder="Name, Firma…" className="h-10 rounded-full border border-line bg-surface px-4 text-sm" />
        <input name="country" defaultValue={sp.country ?? ""} placeholder="Land (ES)" maxLength={2} className="h-10 w-24 rounded-full border border-line bg-surface px-4 text-sm uppercase" />
        <button className="h-10 rounded-full border border-line bg-surface px-4 text-sm font-medium text-petrol">Filtern</button>
      </form>
      <Table>
        <thead>
          <tr>
            <Th>Name</Th>
            <Th>Art</Th>
            <Th>Land / Regionen</Th>
            <Th>Vereinbarung</Th>
            <Th>Objekte</Th>
            <Th>Trefferquote</Th>
            <Th>Bewertung</Th>
            <Th>Profile erhalten</Th>
            <Th>Sprache</Th>
          </tr>
        </thead>
        <tbody>
          {partners.map((p) => (
            <tr key={p.id} className={p.active ? "hover:bg-canvas" : "opacity-50"}>
              <Td>
                <Link href={`/partner/${p.id}`} className="font-medium text-petrol hover:underline">
                  {p.name}
                </Link>
                {p.company && <div className="text-xs text-muted">{p.company}</div>}
              </Td>
              <Td>{PARTNER_TYPE_LABEL[p.type]}</Td>
              <Td className="text-xs">
                {p.country}
                <div className="text-muted">{p.regions.map((r) => rn[r] ?? r).join(", ") || "ganzes Land"}</div>
              </Td>
              <Td>{p.agreementAt ? <Badge tone="ok">{p.agreementAt.toLocaleDateString("de-DE")}</Badge> : <Badge tone="warn">fehlt</Badge>}</Td>
              <Td>{p._count.properties}</Td>
              <Td>{hitRate(p._count.properties, p.properties.filter((x) => x._count.presentations > 0).length) ?? "–"}{p._count.properties ? " %" : ""}</Td>
              <Td>{averageRatings(p.ratings).score?.toLocaleString("de-DE") ?? "–"}</Td>
              <Td>{p._count.sends}</Td>
              <Td>{p.language.toUpperCase()}</Td>
            </tr>
          ))}
          {partners.length === 0 && (
            <tr>
              <Td className="py-10 text-center text-muted" {...{ colSpan: 9 }}>
                Keine Partner.
              </Td>
            </tr>
          )}
        </tbody>
      </Table>
    </div>
  );
}
