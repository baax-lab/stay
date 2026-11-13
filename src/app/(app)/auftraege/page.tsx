import Link from "next/link";
import type { MandateStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { MAIN_FLOW, MANDATE_STATUS_LABEL } from "@/lib/mandates";
import { formatEur } from "@/lib/fees";
import { PageHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Table, Td, Th } from "@/components/ui/table";
import { SavedViews } from "@/components/ui/saved-views";
import { cn } from "@/lib/cn";

export const metadata = { title: "Suchaufträge" };

type Search = { view?: string; status?: string; owner?: string; q?: string };

export default async function MandatesPage({ searchParams }: { searchParams: Promise<Search> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const kanban = sp.view === "kanban";

  const where: Prisma.MandateWhereInput = {};
  if (sp.status && sp.status in MANDATE_STATUS_LABEL) where.status = sp.status as MandateStatus;
  if (sp.owner === "me") where.ownerId = user.id;
  if (sp.q?.trim()) where.OR = [{ title: { contains: sp.q.trim(), mode: "insensitive" } }, { buyerName: { contains: sp.q.trim(), mode: "insensitive" } }];

  const mandates = await prisma.mandate.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    include: { profile: { select: { priceMax: true, countries: true, regions: true } }, _count: { select: { matches: { where: { status: { in: ["NEU", "GEPRUEFT"] } } }, presentations: true } } },
  });

  const qs = (patch: Partial<Search>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...sp, ...patch })) if (v) p.set(k, v);
    const s = p.toString();
    return `/auftraege${s ? `?${s}` : ""}`;
  };

  const columns: MandateStatus[] = [...MAIN_FLOW, "PAUSIERT", "BEENDET_OHNE_KAUF"];

  return (
    <div>
      <PageHeader
        title="Suchaufträge"
        subtitle={`${mandates.length} ${mandates.length === 1 ? "Auftrag" : "Aufträge"}`}
        action={
          <div className="flex flex-wrap gap-2">
            <ButtonLink href={qs({ view: kanban ? undefined : "kanban" })} variant="secondary">
              {kanban ? "Tabelle" : "Kanban"}
            </ButtonLink>
            {can.editMandates(user.role) && <ButtonLink href="/auftraege/neu">Neuer Suchauftrag</ButtonLink>}
          </div>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <form className="flex gap-2" action="/auftraege">
          {sp.view && <input type="hidden" name="view" value={sp.view} />}
          <input name="q" defaultValue={sp.q ?? ""} placeholder="Titel oder Käufer…" className="h-10 rounded-md border border-line bg-surface px-4 text-sm" />
          <select name="status" defaultValue={sp.status ?? ""} className="h-10 rounded-md border border-line bg-surface px-3 text-sm">
            <option value="">Status: alle</option>
            {columns.map((s) => (
              <option key={s} value={s}>
                {MANDATE_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
          <select name="owner" defaultValue={sp.owner ?? ""} className="h-10 rounded-md border border-line bg-surface px-3 text-sm">
            <option value="">Alle Verantwortlichen</option>
            <option value="me">Meine</option>
          </select>
          <button className="h-10 rounded-md border border-line bg-surface px-4 text-sm font-medium text-petrol">Filtern</button>
        </form>
        <SavedViews scope="auftraege" current={new URLSearchParams(Object.entries(sp).filter(([, v]) => v) as [string, string][]).toString()} />
      </div>

      {kanban ? (
        <div className="flex gap-3 overflow-x-auto pb-3">
          {columns.map((status) => {
            const items = mandates.filter((m) => m.status === status);
            return (
              <div key={status} className="w-64 shrink-0 rounded-2xl bg-canvas p-2">
                <div className="mb-2 flex items-center justify-between px-2 pt-1 text-xs font-semibold uppercase tracking-wide text-muted">
                  <span>{MANDATE_STATUS_LABEL[status]}</span>
                  <span>{items.length}</span>
                </div>
                <div className="space-y-2">
                  {items.map((m) => (
                    <Link key={m.id} href={`/auftraege/${m.id}`} className="block rounded-xl border border-line bg-surface p-3 text-sm hover:border-brand">
                      <div className="font-medium text-petrol">{m.title}</div>
                      <div className="text-xs text-muted">{m.buyerName}</div>
                      <div className="mt-1 flex flex-wrap gap-1 text-xs">
                        <span className="text-muted">{formatEur(m.profile?.priceMax)}</span>
                        {m._count.matches > 0 && <Badge tone="brand">{m._count.matches} neu</Badge>}
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Titel</Th>
              <Th>Käufer</Th>
              <Th>Status</Th>
              <Th>Budget</Th>
              <Th>Region</Th>
              <Th>Treffer neu</Th>
              <Th>Vorgestellt</Th>
              <Th>Verantwortlich</Th>
              <Th>Laufzeit</Th>
            </tr>
          </thead>
          <tbody>
            {mandates.map((m) => (
              <tr key={m.id} className="hover:bg-canvas">
                <Td>
                  <Link href={`/auftraege/${m.id}`} className="font-medium text-petrol hover:underline">
                    {m.title}
                  </Link>
                </Td>
                <Td>{m.buyerName}</Td>
                <Td>
                  <Badge tone={m.status === "GEKAUFT" || m.status === "ABGESCHLOSSEN" ? "ok" : m.status === "PAUSIERT" || m.status === "BEENDET_OHNE_KAUF" ? "neutral" : "brand"}>{MANDATE_STATUS_LABEL[m.status]}</Badge>
                </Td>
                <Td className="whitespace-nowrap">{formatEur(m.profile?.priceMax)}</Td>
                <Td className="text-xs text-muted">{[...(m.profile?.countries ?? []), ...(m.profile?.regions ?? []).slice(0, 2)].join(", ")}</Td>
                <Td className={cn(m._count.matches > 0 && "font-semibold text-petrol")}>{m._count.matches}</Td>
                <Td>{m._count.presentations}</Td>
                <Td className="text-xs">{m.ownerName ?? m.ownerId}</Td>
                <Td className="whitespace-nowrap text-xs text-muted">{m.endDate ? `bis ${m.endDate.toLocaleDateString("de-DE")}` : "–"}</Td>
              </tr>
            ))}
            {mandates.length === 0 && (
              <tr>
                <Td className="py-10 text-center text-muted" {...{ colSpan: 9 }}>
                  Keine Suchaufträge. Aus einem Käufer-Lead umwandeln oder neu anlegen.
                </Td>
              </tr>
            )}
          </tbody>
        </Table>
      )}
    </div>
  );
}
