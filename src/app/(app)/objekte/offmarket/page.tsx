import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { Notice, PageHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Table, Td, Th } from "@/components/ui/table";
import { LEAD_STATUS_LABEL } from "@/lib/labels";

export const metadata = { title: "Off-Market-Pipeline" };

/** Verkäuferkontakte als Objektquelle (Konzept §8.10). */
export default async function OffmarketPage() {
  const user = await requireUser();
  const sellers = await prisma.lead.findMany({
    where: { role: "VERKAEUFER", status: { not: "VERWORFEN" } },
    orderBy: { createdAt: "desc" },
    include: { sellerProperties: { select: { id: true, title: true, availability: true, _count: { select: { matches: { where: { status: { in: ["NEU", "GEPRUEFT", "GEMERKT", "AN_KAEUFER"] } } } } } } } },
  });
  const showDetails = can.viewLeadContactDetails(user.role);

  return (
    <div>
      <Link href="/objekte" className="text-sm text-muted hover:text-petrol">
        ← Objekte
      </Link>
      <PageHeader title="Off-Market-Pipeline" subtitle={`${sellers.length} Verkäuferkontakte`} />
      <div className="mb-4">
        <Notice tone="brand">Baax arbeitet auf Käuferseite. Bei Wohnungen und Häusern keine Provision vom Verkäufer; Verkäuferkontakte dienen als Objektquelle für Suchaufträge.</Notice>
      </div>
      <Table>
        <thead>
          <tr>
            <Th>Verkäufer</Th>
            <Th>Interesse / Angebot</Th>
            <Th>Status</Th>
            <Th>Objekt angelegt</Th>
            <Th>Treffer</Th>
            <Th></Th>
          </tr>
        </thead>
        <tbody>
          {sellers.map((s) => (
            <tr key={s.id} className="hover:bg-canvas">
              <Td>
                <Link href={`/leads/${s.id}`} className="font-medium text-petrol hover:underline">
                  {s.name}
                </Link>
                {showDetails && s.company && <div className="text-xs text-muted">{s.company}</div>}
                <div className="text-xs text-muted">{s.createdAt.toLocaleDateString("de-DE")} · {s.sourceDetail ?? s.source}</div>
              </Td>
              <Td className="max-w-sm text-sm text-muted">{s.interest ?? "–"}{s.regions.length ? <div className="text-xs text-petrol">{s.regions.join(", ")}</div> : null}</Td>
              <Td>
                <Badge>{LEAD_STATUS_LABEL[s.status]}</Badge>
              </Td>
              <Td>
                {s.sellerProperties.length === 0 ? (
                  <Badge tone="warn">nein</Badge>
                ) : (
                  s.sellerProperties.map((p) => (
                    <div key={p.id}>
                      <Link href={`/objekte/${p.id}`} className="underline">
                        {p.title}
                      </Link>
                    </div>
                  ))
                )}
              </Td>
              <Td>{s.sellerProperties.some((p) => p._count.matches > 0) ? <Badge tone="ok">ja ({s.sellerProperties.reduce((n, p) => n + p._count.matches, 0)})</Badge> : <Badge>nein</Badge>}</Td>
              <Td>
                {s.sellerProperties.length === 0 && can.createProperty(user.role) && (
                  <ButtonLink href={`/objekte/neu?sellerLeadId=${s.id}`} size="sm">
                    Als Objekt anlegen
                  </ButtonLink>
                )}
              </Td>
            </tr>
          ))}
          {sellers.length === 0 && (
            <tr>
              <Td className="py-10 text-center text-muted" {...{ colSpan: 6 }}>
                Keine Verkäuferkontakte.
              </Td>
            </tr>
          )}
        </tbody>
      </Table>
    </div>
  );
}
