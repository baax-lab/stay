import Link from "next/link";
import { prisma } from "@/lib/db";
import { searchVsProfile } from "@/lib/candidates";
import { formatEur } from "@/lib/fees";
import { SEGMENT_LABEL } from "@/lib/labels";
import { adoptCandidateAction, adoptSearchIntoProfileAction, discardCandidateAction } from "@/app/(app)/auftraege/kandidaten-actions";
import { ActionButton } from "@/components/ui/action-form";
import { Card, CardTitle, Notice } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export async function CandidatesPanel({ mandateId, canEdit }: { mandateId: string; canEdit: boolean }) {
  const [searches, candidates, profile, regions] = await Promise.all([
    prisma.portalSearch.findMany({ where: { mandateId }, orderBy: { createdAt: "desc" } }),
    prisma.searchCandidate.findMany({ where: { mandateId }, include: { property: true, portalSearch: { select: { name: true } } }, orderBy: [{ status: "asc" }, { score: "desc" }] }),
    prisma.searchProfile.findUnique({ where: { mandateId } }),
    prisma.region.findMany({ select: { key: true, name: true } }),
  ]);
  const rn = Object.fromEntries(regions.map((r) => [r.key, r.name]));
  const open = candidates.filter((c) => c.status === "NEU");
  const done = candidates.filter((c) => c.status !== "NEU");

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
      <div className="space-y-3">
        <Card>
          <CardTitle>Kandidaten aus Suchwünschen ({open.length})</CardTitle>
          <p className="mb-3 text-sm text-muted">Objekte, die zu einem im Portal gespeicherten Suchwunsch passen, aber nicht zum vereinbarten Suchprofil. Sie werden dem Käufer erst nach Übernahme und Freigabe gezeigt.</p>
          {open.length === 0 && <Notice tone="neutral">Keine offenen Kandidaten.</Notice>}
          <ul className="space-y-2" data-testid="candidates">
            {open.map((c) => {
              const reasons = c.reasons as { passt?: string[]; fehlt?: string[] };
              return (
                <li key={c.id} className="rounded-xl border border-line p-3 text-sm">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <Link href={`/objekte/${c.propertyId}`} className="font-medium text-petrol hover:underline">
                        {c.property.title}
                      </Link>
                      <div className="text-xs text-muted">
                        {[c.property.locality, rn[c.property.region] ?? c.property.region].filter(Boolean).join(", ")} · {formatEur(c.property.price)} · Suchwunsch „{c.portalSearch.name}“
                      </div>
                      {reasons.passt && <div className="mt-1 text-xs text-ok">{reasons.passt.slice(0, 4).join(" · ")}</div>}
                    </div>
                    <span className="text-xl font-semibold text-petrol">{c.score}</span>
                  </div>
                  {canEdit && (
                    <div className="mt-2 flex gap-2">
                      <ActionButton action={adoptCandidateAction.bind(null, mandateId, c.id)} variant="primary">
                        Als Treffer übernehmen
                      </ActionButton>
                      <ActionButton action={discardCandidateAction.bind(null, mandateId, c.id)} variant="ghost">
                        Verwerfen
                      </ActionButton>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </Card>
        {done.length > 0 && (
          <Card>
            <CardTitle>Entschieden</CardTitle>
            <ul className="space-y-1 text-xs">
              {done.map((c) => (
                <li key={c.id}>
                  {c.property.title} · <Badge tone={c.status === "UEBERNOMMEN" ? "ok" : "neutral"}>{c.status === "UEBERNOMMEN" ? "übernommen" : "verworfen"}</Badge> {c.decidedAt?.toLocaleDateString("de-DE")}
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
      <Card className="h-fit">
        <CardTitle>Suchwünsche des Käufers</CardTitle>
        {searches.length === 0 && <p className="text-sm text-muted">Der Käufer hat im Portal noch keine Suchwünsche gespeichert.</p>}
        <ul className="space-y-3">
          {searches.map((s) => {
            const diff = searchVsProfile(s, profile);
            return (
              <li key={s.id} className={`rounded-xl border border-line p-3 text-sm ${s.active ? "" : "opacity-60"}`} data-testid="portal-search-internal">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-petrol">{s.name}</span>
                  {!s.active && <Badge>gelöscht</Badge>}
                </div>
                <div className="mt-1 text-xs text-muted">
                  {[s.segments.map((x) => SEGMENT_LABEL[x]).join(", "), s.regions.map((k) => rn[k] ?? k).join(", "), `${s.priceMin ? `${formatEur(s.priceMin)} – ` : "bis "}${formatEur(s.priceMax)}`].filter(Boolean).join(" · ")}
                </div>
                {s.note && <div className="mt-1 text-xs">„{s.note}“</div>}
                {s.active && diff.any && (
                  <div className="mt-2 rounded-lg bg-brand-soft px-2 py-1.5 text-xs text-petrol">
                    Geht über das Suchprofil hinaus:{" "}
                    {[diff.newRegions.length ? `Regionen ${diff.newRegions.map((k) => rn[k] ?? k).join(", ")}` : null, diff.newCountries.length ? `Länder ${diff.newCountries.join(", ")}` : null, diff.newSegments.length ? `Objektart ${diff.newSegments.map((x) => SEGMENT_LABEL[x]).join(", ")}` : null, diff.higherBudget ? `Budget bis ${formatEur(diff.higherBudget)}` : null]
                      .filter(Boolean)
                      .join(" · ")}
                    {canEdit && (
                      <div className="mt-1">
                        <ActionButton action={adoptSearchIntoProfileAction.bind(null, mandateId, s.id)} variant="secondary">
                          Suchprofil erweitern?
                        </ActionButton>
                      </div>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
}
