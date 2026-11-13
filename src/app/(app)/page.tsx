import Link from "next/link";
import type { LeadRole, LeadSource, MandateStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getActiveEvent, getGoal } from "@/lib/settings";
import { LEAD_SOURCE_LABEL, LEAD_ROLE_LABEL } from "@/lib/labels";
import { ACTIVE_STATUSES, MAIN_FLOW, MANDATE_STATUS_LABEL } from "@/lib/mandates";
import { closingProgress, type ChecklistItem } from "@/lib/checklists";
import { formatEur } from "@/lib/fees";
import { Card, CardTitle, PageHeader } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default async function DashboardPage() {
  const user = await requireUser();
  const now = new Date();
  const since = new Date(now);
  since.setDate(since.getDate() - 7);
  const goal = await getGoal();
  const goalStart = new Date(goal.startDate);
  const goalEnd = new Date(goalStart);
  goalEnd.setDate(goalEnd.getDate() + goal.days);
  const endOfToday = new Date(now);
  endOfToday.setHours(23, 59, 59, 999);

  const [event, openLeads, totalLeads, weekLeads, pendingHub, bySource, byRole, recentLeads, mandatesByStatus, newMatches, goalMandates, funnelLeads, funnelInterview, funnelMandates, closings, followUps, staleLeads, expiring, callbacks] = await Promise.all([
    getActiveEvent(),
    prisma.lead.count({ where: { status: "NEU" } }),
    prisma.lead.count(),
    prisma.lead.count({ where: { createdAt: { gte: since } } }),
    prisma.lead.count({ where: { hubSync: { in: ["PENDING", "FAILED"] } } }),
    prisma.lead.groupBy({ by: ["source"], _count: { _all: true }, orderBy: { _count: { source: "desc" } } }),
    prisma.lead.groupBy({ by: ["role"], _count: { _all: true } }),
    prisma.lead.findMany({ orderBy: { createdAt: "desc" }, take: 5, select: { id: true, name: true, createdAt: true } }),
    prisma.mandate.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.match.findMany({ where: { status: "NEU", mandate: { status: { in: ACTIVE_STATUSES } } }, include: { mandate: { select: { id: true, title: true } }, property: { select: { title: true, price: true } } }, orderBy: { createdAt: "desc" }, take: 8 }),
    prisma.mandate.count({ where: { contractSignedAt: { gte: goalStart, lte: goalEnd } } }),
    prisma.lead.count({ where: { createdAt: { gte: goalStart } } }),
    prisma.lead.count({ where: { createdAt: { gte: goalStart }, status: { in: ["ERSTGESPRAECH", "UMGEWANDELT"] } } }),
    prisma.mandate.count({ where: { createdAt: { gte: goalStart }, status: { notIn: ["ERSTGESPRAECH"] } } }),
    prisma.closing.findMany({ include: { mandate: { select: { id: true, title: true, status: true } } } }),
    prisma.followUp.findMany({ where: { doneAt: null, dueAt: { lte: endOfToday } }, include: { mandate: { select: { id: true, title: true } } }, take: 10 }),
    prisma.lead.findMany({ where: { status: "NEU", createdAt: { lte: new Date(now.getTime() - 2 * 86400000) } }, orderBy: { createdAt: "asc" }, take: 10, select: { id: true, name: true, createdAt: true } }),
    prisma.mandate.findMany({ where: { status: { in: ACTIVE_STATUSES }, endDate: { lte: new Date(now.getTime() + 14 * 86400000) } }, select: { id: true, title: true, endDate: true }, take: 10 }),
    // Rückrufwünsche bis Ende heute, solange der Lead offen ist
    prisma.lead.findMany({
      where: { callbackAt: { lte: new Date(new Date().setHours(23, 59, 59, 999)) }, status: { in: ["NEU", "KONTAKTIERT"] } },
      orderBy: { callbackAt: "asc" },
      take: 20,
      select: { id: true, name: true, callbackAt: true },
    }),
  ]);

  const candidates = await prisma.searchCandidate.count({ where: { status: "NEU" } });
  const statusCount = Object.fromEntries(mandatesByStatus.map((m) => [m.status, m._count._all])) as Partial<Record<MandateStatus, number>>;
  const activeMandates = ACTIVE_STATUSES.reduce((n, s) => n + (statusCount[s] ?? 0), 0);
  const daysLeft = Math.max(0, Math.ceil((goalEnd.getTime() - now.getTime()) / 86400000));
  const dueClosingItems = closings.flatMap((c) =>
    (c.checklist as ChecklistItem[])
      .filter((i) => !i.done && i.dueAt && new Date(i.dueAt) <= endOfToday)
      .map((i) => ({ mandate: c.mandate, item: i, progress: closingProgress(c.checklist as ChecklistItem[]) })),
  );
  const firstName = user.name?.split(" ")[0];

  return (
    <div>
      <PageHeader title={firstName ? `Hallo ${firstName}` : "Start"} subtitle={event.active ? `Aktives Event: ${event.sourceDetail || event.source}` : "Kein aktives Event"} action={
          <div className="flex flex-wrap gap-2">
            <ButtonLink href="/besichtigungen/neu" variant="secondary">
              Besichtigung protokollieren
            </ButtonLink>
            <ButtonLink href="/leads/neu">Kontakt erfassen</ButtonLink>
          </div>
        } />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Offene Leads" value={openLeads} href="/leads?status=NEU" />
        <Stat label="Aktive Suchaufträge" value={activeMandates} href="/auftraege" />
        <Stat label="Neue Treffer" value={newMatches.length} href="/auftraege" tone={newMatches.length > 0 ? "warn" : "neutral"} />
        <Stat label={candidates > 0 ? `Ohne Hub-Übergabe · ${candidates} Kandidaten` : "Ohne Hub-Übergabe"} value={pendingHub} href="/leads?sync=PENDING" tone={pendingHub > 0 ? "warn" : "ok"} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardTitle action={<Link href="/einstellungen" className="text-xs text-brand-strong">Ziel ändern</Link>}>
            Ziel: {goal.mandates} Suchaufträge in {goal.days} Tagen
          </CardTitle>
          <div className="flex flex-wrap items-end gap-6">
            <div>
              <div className="text-4xl font-semibold text-petrol">
                {goalMandates} <span className="text-lg text-muted">/ {goal.mandates}</span>
              </div>
              <div className="text-xs text-muted">
                beauftragt seit {goalStart.toLocaleDateString("de-DE")} · noch {daysLeft} Tage
              </div>
            </div>
            <div className="h-3 flex-1 overflow-hidden rounded-full bg-canvas">
              <div className="h-full bg-brand" style={{ width: `${Math.min(100, (goalMandates / goal.mandates) * 100)}%` }} />
            </div>
          </div>
          <div className="mt-5 grid grid-cols-3 gap-2 text-center text-sm">
            <Funnel label="Leads" value={funnelLeads} href="/leads" />
            <Funnel label="Erstgespräch" value={funnelInterview} href="/leads?status=ERSTGESPRAECH" pct={funnelLeads ? funnelInterview / funnelLeads : 0} />
            <Funnel label="Auftrag" value={funnelMandates} href="/auftraege" pct={funnelInterview ? funnelMandates / funnelInterview : 0} />
          </div>
        </Card>

        <Card>
          <CardTitle>Suchaufträge nach Status</CardTitle>
          <ul className="space-y-1.5 text-sm">
            {[...MAIN_FLOW, "PAUSIERT" as MandateStatus].map((s) => (
              <li key={s} className="flex items-center justify-between">
                <Link href={`/auftraege?status=${s}`} className="hover:underline">
                  {MANDATE_STATUS_LABEL[s]}
                </Link>
                <span className={statusCount[s] ? "font-medium text-petrol" : "text-muted"}>{statusCount[s] ?? 0}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardTitle action={<Link href="/auftraege" className="text-xs text-brand-strong">Alle</Link>}>Neue Treffer</CardTitle>
          <ul className="space-y-2 text-sm">
            {newMatches.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <Link href={`/auftraege/${m.mandate.id}?tab=treffer`} className="block truncate font-medium text-petrol hover:underline">
                    {m.property.title}
                  </Link>
                  <div className="truncate text-xs text-muted">
                    {m.mandate.title} · {formatEur(m.property.price)}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {m.nearMiss && <Badge tone="warn">knapp</Badge>}
                  <span className="text-lg font-semibold text-petrol">{m.score}</span>
                </div>
              </li>
            ))}
            {newMatches.length === 0 && <li className="text-muted">Keine neuen Treffer.</li>}
          </ul>
        </Card>

        <Card>
          <CardTitle>Aufgaben heute</CardTitle>
          <ul className="space-y-2 text-sm">
            {callbacks.map((l) => (
              <li key={`cb-${l.id}`}>
                <Badge tone={l.callbackAt! < new Date() ? "danger" : "warn"}>Rückruf</Badge>{" "}
                <Link href={`/leads/${l.id}`} className="hover:underline">
                  {l.name}
                </Link>{" "}
                <span className="text-xs text-muted">{l.callbackAt!.toLocaleString("de-DE", { timeZone: "Europe/Berlin", dateStyle: "short", timeStyle: "short" })}</span>
              </li>
            ))}
            {staleLeads.map((l) => (
              <li key={l.id}>
                <Badge tone="warn">Lead</Badge>{" "}
                <Link href={`/leads/${l.id}`} className="hover:underline">
                  {l.name}
                </Link>{" "}
                <span className="text-xs text-muted">seit {l.createdAt.toLocaleDateString("de-DE")} nicht kontaktiert</span>
              </li>
            ))}
            {dueClosingItems.map(({ mandate, item }) => (
              <li key={`${mandate.id}-${item.key}`}>
                <Badge tone="brand">Kauf</Badge>{" "}
                <Link href={`/auftraege/${mandate.id}?tab=kauf`} className="hover:underline">
                  {mandate.title}
                </Link>
                : {item.label} <span className="text-xs text-muted">fällig {new Date(item.dueAt!).toLocaleDateString("de-DE")}</span>
              </li>
            ))}
            {followUps.map((f) => (
              <li key={f.id}>
                <Badge tone="ok">Nachgespräch</Badge>{" "}
                <Link href={`/auftraege/${f.mandate.id}?tab=nachbetreuung`} className="hover:underline">
                  {f.mandate.title}
                </Link>{" "}
                <span className="text-xs text-muted">fällig {f.dueAt.toLocaleDateString("de-DE")}</span>
              </li>
            ))}
            {expiring.map((m) => (
              <li key={m.id}>
                <Badge>Laufzeit</Badge>{" "}
                <Link href={`/auftraege/${m.id}`} className="hover:underline">
                  {m.title}
                </Link>{" "}
                <span className="text-xs text-muted">endet {m.endDate?.toLocaleDateString("de-DE")}</span>
              </li>
            ))}
            {callbacks.length + staleLeads.length + dueClosingItems.length + followUps.length + expiring.length === 0 && <li className="text-muted">Nichts fällig.</li>}
          </ul>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card>
          <CardTitle>Leads je Quelle</CardTitle>
          <ul className="space-y-1.5 text-sm">
            {bySource.map((s) => (
              <li key={s.source} className="flex items-center justify-between">
                <Link href={`/leads?source=${s.source}`} className="hover:underline">
                  {LEAD_SOURCE_LABEL[s.source as LeadSource]}
                </Link>
                <span className="font-medium text-petrol">{s._count._all}</span>
              </li>
            ))}
            {bySource.length === 0 && <li className="text-muted">Noch keine Leads.</li>}
          </ul>
        </Card>
        <Card>
          <CardTitle>Leads je Rolle</CardTitle>
          <ul className="space-y-1.5 text-sm">
            {byRole.map((r) => (
              <li key={r.role} className="flex items-center justify-between">
                <Link href={`/leads?role=${r.role}`} className="hover:underline">
                  {LEAD_ROLE_LABEL[r.role as LeadRole]}
                </Link>
                <span className="font-medium text-petrol">{r._count._all}</span>
              </li>
            ))}
            {byRole.length === 0 && <li className="text-muted">Noch keine Leads.</li>}
          </ul>
          <p className="mt-3 text-xs text-muted">
            {totalLeads} Leads gesamt, {weekLeads} in den letzten 7 Tagen.
          </p>
        </Card>
        <Card>
          <CardTitle action={<Link href="/leads" className="text-xs text-brand-strong">Alle</Link>}>Zuletzt erfasst</CardTitle>
          <ul className="space-y-1.5 text-sm">
            {recentLeads.map((l) => (
              <li key={l.id} className="flex items-center justify-between gap-2">
                <Link href={`/leads/${l.id}`} className="truncate hover:underline">
                  {l.name}
                </Link>
                <span className="shrink-0 text-xs text-muted">{l.createdAt.toLocaleDateString("de-DE")}</span>
              </li>
            ))}
            {recentLeads.length === 0 && <li className="text-muted">Noch keine Leads.</li>}
          </ul>
        </Card>
      </div>
    </div>
  );
}

function Stat({ label, value, href, tone = "neutral" }: { label: string; value: number; href: string; tone?: "neutral" | "warn" | "ok" }) {
  const color = tone === "warn" ? "text-warn" : tone === "ok" ? "text-ok" : "text-petrol";
  return (
    <Link href={href} className="rounded-2xl border border-line bg-surface p-4 hover:border-brand">
      <div className="text-xs font-medium uppercase tracking-wide text-muted">{label}</div>
      <div className={`mt-1 text-3xl font-semibold ${color}`}>{value}</div>
    </Link>
  );
}

function Funnel({ label, value, href, pct }: { label: string; value: number; href: string; pct?: number }) {
  return (
    <Link href={href} className="rounded-xl bg-canvas p-3 hover:bg-brand-soft">
      <div className="text-2xl font-semibold text-petrol">{value}</div>
      <div className="text-xs text-muted">{label}</div>
      {pct !== undefined && <div className="text-xs text-muted">{Math.round(pct * 100)} %</div>}
    </Link>
  );
}
