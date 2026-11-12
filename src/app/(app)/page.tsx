import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getActiveEvent } from "@/lib/settings";
import { LEAD_SOURCE_LABEL, LEAD_ROLE_LABEL } from "@/lib/labels";
import { Card, CardTitle, PageHeader } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import type { LeadRole, LeadSource } from "@prisma/client";

export default async function DashboardPage() {
  const user = await requireUser();
  const since = new Date();
  since.setDate(since.getDate() - 7);

  const [event, open, total, week, pending, bySource, byRole, recent] = await Promise.all([
    getActiveEvent(),
    prisma.lead.count({ where: { status: "NEU" } }),
    prisma.lead.count(),
    prisma.lead.count({ where: { createdAt: { gte: since } } }),
    prisma.lead.count({ where: { hubSync: { in: ["PENDING", "FAILED"] } } }),
    prisma.lead.groupBy({ by: ["source"], _count: { _all: true }, orderBy: { _count: { source: "desc" } } }),
    prisma.lead.groupBy({ by: ["role"], _count: { _all: true } }),
    prisma.lead.findMany({ orderBy: { createdAt: "desc" }, take: 5, select: { id: true, name: true, role: true, createdAt: true, status: true } }),
  ]);

  const firstName = user.name?.split(" ")[0];

  return (
    <div>
      <PageHeader title={firstName ? `Hallo ${firstName}` : "Start"} subtitle={event.active ? `Aktives Event: ${event.sourceDetail || event.source}` : "Kein aktives Event"} action={<ButtonLink href="/leads/neu">Kontakt erfassen</ButtonLink>} />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Offene Leads" value={open} href="/leads?status=NEU" />
        <Stat label="Letzte 7 Tage" value={week} href="/leads" />
        <Stat label="Ohne Hub-Übergabe" value={pending} href="/leads?sync=PENDING" tone={pending > 0 ? "warn" : "ok"} />
        <Stat label="Leads gesamt" value={total} href="/leads" />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card>
          <CardTitle>Leads je Quelle</CardTitle>
          <ul className="space-y-2 text-sm">
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
          <ul className="space-y-2 text-sm">
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
        </Card>
        <Card>
          <CardTitle action={<Link href="/leads" className="text-xs text-brand-strong">Alle</Link>}>Zuletzt erfasst</CardTitle>
          <ul className="space-y-2 text-sm">
            {recent.map((l) => (
              <li key={l.id} className="flex items-center justify-between gap-2">
                <Link href={`/leads/${l.id}`} className="truncate hover:underline">
                  {l.name}
                </Link>
                <span className="shrink-0 text-xs text-muted">{l.createdAt.toLocaleDateString("de-DE")}</span>
              </li>
            ))}
            {recent.length === 0 && <li className="text-muted">Noch keine Leads.</li>}
          </ul>
        </Card>
      </div>

      <Card className="mt-4">
        <CardTitle>Ziel: 3 Suchaufträge in 90 Tagen</CardTitle>
        <p className="text-sm text-muted">Die Zielverfolgung mit Umwandlung Lead → Erstgespräch → Auftrag folgt mit den Suchaufträgen in Phase 1. Aktuell: {total} Leads erfasst.</p>
      </Card>
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
