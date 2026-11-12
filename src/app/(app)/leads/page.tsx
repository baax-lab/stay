import Link from "next/link";
import type { LeadRole, LeadSource, LeadStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { HUB_SYNC_LABEL, LEAD_ROLE_LABEL, LEAD_SOURCE_LABEL, LEAD_STATUS_LABEL, entries } from "@/lib/labels";
import { formatBudget } from "@/lib/leads";
import { PageHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Table, Td, Th } from "@/components/ui/table";
import { LeadFilters } from "@/components/leads/lead-filters";
import { SyncAllButton } from "@/components/leads/sync-buttons";

export const metadata = { title: "Leads" };

type Search = { q?: string; source?: string; role?: string; status?: string; sync?: string; page?: string };

const PAGE_SIZE = 50;

function statusTone(s: LeadStatus) {
  return s === "NEU" ? "brand" : s === "VERWORFEN" ? "neutral" : s === "UMGEWANDELT" ? "ok" : "warn";
}

export default async function LeadsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const showDetails = can.viewLeadContactDetails(user.role);

  const where: Prisma.LeadWhereInput = {};
  if (sp.source && sp.source in LEAD_SOURCE_LABEL) where.source = sp.source as LeadSource;
  if (sp.role && sp.role in LEAD_ROLE_LABEL) where.role = sp.role as LeadRole;
  if (sp.status && sp.status in LEAD_STATUS_LABEL) where.status = sp.status as LeadStatus;
  if (sp.sync === "PENDING" || sp.sync === "FAILED" || sp.sync === "SYNCED") where.hubSync = sp.sync;
  if (sp.q?.trim()) {
    const q = sp.q.trim();
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { company: { contains: q, mode: "insensitive" } },
      { interest: { contains: q, mode: "insensitive" } },
      { regions: { has: q } },
      ...(showDetails ? [{ email: { contains: q, mode: "insensitive" as const } }, { phone: { contains: q } }] : []),
    ];
  }

  const page = Math.max(1, Number(sp.page ?? 1) || 1);
  const [leads, total, pendingCount] = await Promise.all([
    prisma.lead.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE }),
    prisma.lead.count({ where }),
    prisma.lead.count({ where: { hubSync: { in: ["PENDING", "FAILED"] } } }),
  ]);

  const exportQs = new URLSearchParams(Object.entries(sp).filter(([k, v]) => v && k !== "page") as [string, string][]).toString();

  return (
    <div>
      <PageHeader
        title="Leads"
        subtitle={`${total} ${total === 1 ? "Kontakt" : "Kontakte"}${pendingCount ? ` · ${pendingCount} ohne Hub-Übergabe` : ""}`}
        action={
          <div className="flex flex-wrap gap-2">
            {can.syncHub(user.role) && pendingCount > 0 && <SyncAllButton />}
            {can.exportLeads(user.role) && (
              <ButtonLink href={`/leads/export${exportQs ? `?${exportQs}` : ""}`} variant="secondary" prefetch={false}>
                CSV-Export
              </ButtonLink>
            )}
            <ButtonLink href="/leads/neu">Erfassen</ButtonLink>
          </div>
        }
      />

      <LeadFilters
        values={{ q: sp.q ?? "", source: sp.source ?? "", role: sp.role ?? "", status: sp.status ?? "", sync: sp.sync ?? "" }}
        options={{
          source: entries(LEAD_SOURCE_LABEL),
          role: entries(LEAD_ROLE_LABEL),
          status: entries(LEAD_STATUS_LABEL),
          sync: entries(HUB_SYNC_LABEL),
        }}
      />

      {/* Mobil: Karten */}
      <ul className="mt-4 space-y-2 md:hidden">
        {leads.map((l) => (
          <li key={l.id}>
            <Link href={`/leads/${l.id}`} className="block rounded-2xl border border-line bg-surface p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-medium text-petrol">{l.name}</div>
                  {showDetails && l.company && <div className="text-xs text-muted">{l.company}</div>}
                </div>
                <Badge tone={statusTone(l.status)}>{LEAD_STATUS_LABEL[l.status]}</Badge>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
                <Badge>{LEAD_ROLE_LABEL[l.role]}</Badge>
                <Badge>{LEAD_SOURCE_LABEL[l.source]}</Badge>
                {l.hubSync !== "SYNCED" && <Badge tone={l.hubSync === "FAILED" ? "danger" : "warn"}>{HUB_SYNC_LABEL[l.hubSync]}</Badge>}
              </div>
              <div className="mt-2 text-xs text-muted">
                {new Date(l.createdAt).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" })}
                {" · "}
                {formatBudget(l.budgetMin, l.budgetMax)}
              </div>
            </Link>
          </li>
        ))}
        {leads.length === 0 && <li className="rounded-2xl border border-dashed border-line p-6 text-center text-sm text-muted">Keine Leads gefunden.</li>}
      </ul>

      {/* Desktop: Tabelle */}
      <div className="mt-4 hidden md:block">
        <Table>
          <thead>
            <tr>
              <Th>Name</Th>
              <Th>Rolle</Th>
              {showDetails && <Th>Kontakt</Th>}
              <Th>Interesse</Th>
              <Th>Budget</Th>
              <Th>Quelle</Th>
              <Th>Status</Th>
              <Th>Hub</Th>
              <Th>Erfasst</Th>
            </tr>
          </thead>
          <tbody>
            {leads.map((l) => (
              <tr key={l.id} className="hover:bg-canvas">
                <Td>
                  <Link href={`/leads/${l.id}`} className="font-medium text-petrol hover:underline">
                    {l.name}
                  </Link>
                  {showDetails && l.company && <div className="text-xs text-muted">{l.company}</div>}
                  {l.duplicateOfId && (
                    <div className="text-xs text-warn">
                      Dublette?{" "}
                      <Link href={`/leads/${l.duplicateOfId}`} className="underline">
                        Original
                      </Link>
                    </div>
                  )}
                </Td>
                <Td>{LEAD_ROLE_LABEL[l.role]}</Td>
                {showDetails && (
                  <Td className="text-xs">
                    {l.phone && <div>{l.phone}</div>}
                    {l.email && <div className="text-muted">{l.email}</div>}
                  </Td>
                )}
                <Td className="max-w-xs">
                  <div className="line-clamp-2 text-muted">{l.interest ?? "–"}</div>
                  {l.regions.length > 0 && <div className="mt-1 text-xs text-petrol">{l.regions.join(", ")}</div>}
                </Td>
                <Td className="whitespace-nowrap">{formatBudget(l.budgetMin, l.budgetMax)}</Td>
                <Td>
                  <div>{LEAD_SOURCE_LABEL[l.source]}</div>
                  {l.sourceDetail && <div className="text-xs text-muted">{l.sourceDetail}</div>}
                </Td>
                <Td>
                  <Badge tone={statusTone(l.status)}>{LEAD_STATUS_LABEL[l.status]}</Badge>
                </Td>
                <Td>
                  <Badge tone={l.hubSync === "SYNCED" ? "ok" : l.hubSync === "FAILED" ? "danger" : "warn"}>{HUB_SYNC_LABEL[l.hubSync]}</Badge>
                </Td>
                <Td className="whitespace-nowrap text-xs text-muted">{new Date(l.createdAt).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" })}</Td>
              </tr>
            ))}
            {leads.length === 0 && (
              <tr>
                <Td className="py-10 text-center text-muted" {...{ colSpan: 9 }}>
                  Keine Leads gefunden.
                </Td>
              </tr>
            )}
          </tbody>
        </Table>
      </div>

      {total > PAGE_SIZE && (
        <div className="mt-4 flex items-center justify-between text-sm text-muted">
          <span>
            Seite {page} von {Math.ceil(total / PAGE_SIZE)}
          </span>
          <div className="flex gap-2">
            {page > 1 && (
              <ButtonLink variant="secondary" size="sm" href={`/leads?${new URLSearchParams({ ...Object.fromEntries(Object.entries(sp).filter(([, v]) => v) as [string, string][]), page: String(page - 1) })}`}>
                Zurück
              </ButtonLink>
            )}
            {page * PAGE_SIZE < total && (
              <ButtonLink variant="secondary" size="sm" href={`/leads?${new URLSearchParams({ ...Object.fromEntries(Object.entries(sp).filter(([, v]) => v) as [string, string][]), page: String(page + 1) })}`}>
                Weiter
              </ButtonLink>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
