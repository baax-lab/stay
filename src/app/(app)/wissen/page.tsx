import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { isStale } from "@/lib/analytics";
import { Card, PageHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const metadata = { title: "Länder- und Regionswissen" };

export default async function KnowledgePage() {
  await requireUser();
  const [countries, regions, propCounts] = await Promise.all([
    prisma.country.findMany({ orderBy: { name: "asc" } }),
    prisma.region.findMany({ orderBy: [{ country: "asc" }, { name: "asc" }] }),
    prisma.property.groupBy({ by: ["region"], _count: { _all: true }, where: { active: true } }),
  ]);
  const count = Object.fromEntries(propCounts.map((p) => [p.region, p._count._all]));
  const focus = regions.filter((r) => r.focus);
  const staleFocus = focus.filter((r) => isStale(r.reviewedAt)).length;

  return (
    <div>
      <PageHeader title="Länder- und Regionswissen" subtitle="Kaufablauf, Erwerb durch Ausländer, Steuern, Vermietungsregeln, Preisniveau und Auslastung – Grundlage für Marktberichte, Ampel und Gespräche." />
      {staleFocus > 0 && (
        <p className="mb-4 rounded-xl border border-warn/30 bg-warn-soft px-4 py-3 text-sm text-warn">
          {staleFocus} Schwerpunktregion{staleFocus === 1 ? "" : "en"} ohne Prüfung in den letzten 12 Monaten.
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {countries.map((c) => {
          const rs = regions.filter((r) => r.country === c.code);
          return (
            <Link key={c.code} href={`/wissen/${c.code}`} className="rounded-2xl border border-line bg-surface p-4 hover:border-brand" data-testid={`country-${c.code}`}>
              <div className="flex items-center justify-between">
                <span className="text-lg font-semibold text-petrol">{c.name}</span>
                {isStale(c.reviewedAt) ? <Badge tone="warn">prüfen</Badge> : <Badge tone="ok">geprüft {c.reviewedAt!.toLocaleDateString("de-DE")}</Badge>}
              </div>
              <div className="mt-1 text-xs text-muted">
                {rs.length} Regionen · {rs.filter((r) => r.focus).length} Schwerpunkt · {rs.reduce((n, r) => n + (count[r.key] ?? 0), 0)} Objekte · {c.currency}
              </div>
              {c.foreignBuyers && <p className="mt-2 line-clamp-2 text-sm">{c.foreignBuyers}</p>}
            </Link>
          );
        })}
      </div>
      <Card className="mt-6">
        <h2 className="mb-3 font-semibold text-petrol">Schwerpunktregionen</h2>
        <ul className="grid gap-2 sm:grid-cols-2">
          {focus.map((r) => (
            <li key={r.key}>
              <Link href={`/wissen/region/${r.key}`} className="flex items-center justify-between rounded-xl bg-canvas px-3 py-2 text-sm hover:bg-brand-soft">
                <span>
                  {r.name} <span className="text-xs text-muted">{r.country}</span>
                </span>
                {isStale(r.reviewedAt) ? <Badge tone="warn">prüfen</Badge> : <Badge tone="ok">geprüft</Badge>}
              </Link>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
