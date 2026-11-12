import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { formatEur } from "@/lib/fees";
import { PageHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Table, Td, Th } from "@/components/ui/table";

export const metadata = { title: "Tippgeber" };

import { REFERRER_TYPE_LABEL } from "@/components/partners/referrer-form";

export default async function ReferrersPage() {
  const user = await requireUser();
  const referrers = await prisma.referrer.findMany({ orderBy: { name: "asc" }, include: { rewards: true, _count: { select: { mandates: true, properties: true } } } });
  const leadCounts = await prisma.lead.groupBy({ by: ["referrerId"], _count: { _all: true }, where: { referrerId: { not: null } } });
  const leadsBy = Object.fromEntries(leadCounts.map((l) => [l.referrerId, l._count._all]));
  const closed = await prisma.mandate.groupBy({ by: ["referrerId"], _count: { _all: true }, where: { referrerId: { not: null }, status: { in: ["GEKAUFT", "NACHBETREUUNG", "ABGESCHLOSSEN"] } } });
  const closedBy = Object.fromEntries(closed.map((l) => [l.referrerId, l._count._all]));
  const showRewards = can.viewRewards(user.role);

  return (
    <div>
      <PageHeader title="Tippgeber, Agenturen, Multiplikatoren" subtitle="Wer bringt Kunden oder Objekte – und welche Prämie steht an?" action={can.editPartners(user.role) && <ButtonLink href="/tippgeber/neu">Anlegen</ButtonLink>} />
      <Table>
        <thead>
          <tr>
            <Th>Name</Th>
            <Th>Art</Th>
            <Th>Regel</Th>
            <Th>Leads</Th>
            <Th>Aufträge</Th>
            <Th>Objekte</Th>
            <Th>Abschlüsse</Th>
            {showRewards && <Th>Prämien offen / bezahlt</Th>}
          </tr>
        </thead>
        <tbody>
          {referrers.map((r) => {
            const open = r.rewards.filter((x) => !x.paidAt).reduce((s, x) => s + x.amount, 0);
            const paid = r.rewards.filter((x) => x.paidAt).reduce((s, x) => s + x.amount, 0);
            return (
              <tr key={r.id} className={r.active ? "hover:bg-canvas" : "opacity-50"}>
                <Td>
                  <Link href={`/tippgeber/${r.id}`} className="font-medium text-petrol hover:underline">
                    {r.name}
                  </Link>
                  {r.company && <div className="text-xs text-muted">{r.company}</div>}
                </Td>
                <Td>
                  <Badge>{REFERRER_TYPE_LABEL[r.type]}</Badge>
                </Td>
                <Td className="text-xs text-muted">{r.rewardRule ?? (r.rewardPct ? `${r.rewardPct * 100} % Netto-Erfolgshonorar` : r.rewardFlat ? `pauschal ${formatEur(r.rewardFlat)}` : "–")}</Td>
                <Td>{leadsBy[r.id] ?? 0}</Td>
                <Td>{r._count.mandates}</Td>
                <Td>{r._count.properties}</Td>
                <Td>{closedBy[r.id] ?? 0}</Td>
                {showRewards && (
                  <Td className="whitespace-nowrap">
                    {open > 0 && <span className="text-warn">{formatEur(open)}</span>}
                    {open > 0 && paid > 0 && " / "}
                    {paid > 0 && <span className="text-ok">{formatEur(paid)}</span>}
                    {open === 0 && paid === 0 && "–"}
                  </Td>
                )}
              </tr>
            );
          })}
          {referrers.length === 0 && (
            <tr>
              <Td className="py-10 text-center text-muted" {...{ colSpan: 8 }}>
                Noch keine Tippgeber.
              </Td>
            </tr>
          )}
        </tbody>
      </Table>
    </div>
  );
}
