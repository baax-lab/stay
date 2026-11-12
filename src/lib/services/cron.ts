import "server-only";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { audit } from "@/lib/audit";
import { sendMail } from "@/lib/mail";
import { createHubTask } from "@/lib/hub";
import { ACTIVE_STATUSES } from "@/lib/mandates";
import { formatEur } from "@/lib/fees";
import { LEAD_SOURCE_LABEL } from "@/lib/labels";
import { previousMonth } from "@/lib/reports";
import { fetchEcbRates } from "./fx";
import { createMonthlyDrafts } from "./reports";

/** Tägliche Jobs (Konzept §8.7, §8.17, §11). Aufruf über /api/cron/daily, 7:30 Uhr. */

export type CronReport = {
  leadFollowUpTasks: number;
  digestMails: number;
  digestMatches: number;
  followUpTasks: number;
  expiryTasks: number;
  deletedLeads: number;
  fxUpdated: number;
  reportDrafts: number;
  errors: string[];
};

function addBusinessDays(date: Date, days: number): Date {
  const d = new Date(date);
  let n = 0;
  while (n < days) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() !== 0 && d.getDay() !== 6) n++;
  }
  return d;
}

export async function runDailyJobs(now = new Date()): Promise<CronReport> {
  const report: CronReport = { leadFollowUpTasks: 0, digestMails: 0, digestMatches: 0, followUpTasks: 0, expiryTasks: 0, deletedLeads: 0, fxUpdated: 0, reportDrafts: 0, errors: [] };

  // 1. Lead ohne Kontakt nach 2 Werktagen → Aufgabe im Hub
  try {
    const leads = await prisma.lead.findMany({ where: { status: "NEU", followUpTaskAt: null, createdById: { not: "" } }, orderBy: { createdAt: "asc" }, take: 200 });
    for (const lead of leads) {
      if (addBusinessDays(lead.createdAt, 2) > now) continue;
      const r = await createHubTask({
        contactId: lead.hubContactId,
        title: `Lead nicht kontaktiert: ${lead.name}`,
        description: `Seit ${lead.createdAt.toLocaleDateString("de-DE")} ohne Kontakt (Quelle ${LEAD_SOURCE_LABEL[lead.source]}${lead.sourceDetail ? ` – ${lead.sourceDetail}` : ""}).`,
        dueAt: now.toISOString(),
        assigneeId: lead.createdById !== "public" ? lead.createdById : null,
        externalRef: `baax-stay:lead-followup:${lead.id}`,
      });
      if (r.ok) {
        await prisma.lead.update({ where: { id: lead.id }, data: { followUpTaskAt: now } });
        report.leadFollowUpTasks++;
      } else if (r.configured) report.errors.push(`Hub-Aufgabe Lead ${lead.id}: ${r.error}`);
    }
  } catch (e) {
    report.errors.push(`Lead-Nachfassen: ${e instanceof Error ? e.message : e}`);
  }

  // 2. Tägliche Trefferübersicht je Verantwortlichem (nur neue Treffer, notifiedAt setzen)
  try {
    const matches = await prisma.match.findMany({
      where: { notifiedAt: null, status: "NEU", mandate: { status: { in: ACTIVE_STATUSES } } },
      include: { mandate: { select: { id: true, title: true, ownerId: true, ownerName: true, ownerEmail: true } }, property: { select: { title: true, price: true, locality: true, region: true } } },
      orderBy: [{ mandateId: "asc" }, { score: "desc" }],
    });
    const byOwner = new Map<string, typeof matches>();
    for (const m of matches) {
      const key = m.mandate.ownerEmail ?? env.digestFallbackTo ?? "";
      byOwner.set(key, [...(byOwner.get(key) ?? []), m]);
    }
    for (const [to, list] of byOwner) {
      if (!to) {
        report.errors.push(`${list.length} Treffer ohne Empfänger (ownerEmail und MAIL_DIGEST_FALLBACK_TO fehlen)`);
        continue;
      }
      const byMandate = new Map<string, typeof list>();
      for (const m of list) byMandate.set(m.mandate.id, [...(byMandate.get(m.mandate.id) ?? []), m]);
      const lines: string[] = [`Guten Morgen,`, ``, `${list.length} neue Treffer seit der letzten Übersicht:`, ``];
      for (const [mid, ms] of byMandate) {
        lines.push(`${ms[0].mandate.title} (${env.appUrl}/auftraege/${mid}?tab=treffer)`);
        for (const m of ms) lines.push(`  · ${m.score} Punkte${m.nearMiss ? " (knapp daneben)" : ""}: ${m.property.title}, ${m.property.locality ?? m.property.region}, ${formatEur(m.property.price)}`);
        lines.push("");
      }
      lines.push(`Bitte prüfen und bewerten: ${env.appUrl}/auftraege`);
      const mail = await sendMail({ to, subject: `Baax Stay: ${list.length} neue Treffer`, text: lines.join("\n"), purpose: "daily-digest", entity: "Cron" });
      // notifiedAt auch ohne SMTP setzen? Nein: ohne Versand bleiben Treffer „ungemeldet“, damit nichts verloren geht.
      if (mail.sent) {
        await prisma.match.updateMany({ where: { id: { in: list.map((m) => m.id) } }, data: { notifiedAt: now } });
        report.digestMails++;
        report.digestMatches += list.length;
      } else if (env.mailConfigured) report.errors.push(`Trefferübersicht an ${to}: ${mail.error}`);
    }
  } catch (e) {
    report.errors.push(`Trefferübersicht: ${e instanceof Error ? e.message : e}`);
  }

  // 3. Nachgespräche, die in 7 Tagen fällig sind → Aufgabe im Hub
  try {
    const soon = new Date(now);
    soon.setDate(soon.getDate() + 7);
    const followUps = await prisma.followUp.findMany({ where: { doneAt: null, hubTaskAt: null, dueAt: { lte: soon } }, include: { mandate: true } });
    for (const f of followUps) {
      const r = await createHubTask({ contactId: f.mandate.hubContactId, title: `Nachgespräch: ${f.mandate.title}`, description: "Nachbetreuung drei Monate nach Übergabe: Feedback, Empfehlung, Folgeauftrag.", dueAt: f.dueAt.toISOString(), assigneeId: f.mandate.ownerId, externalRef: `baax-stay:followup:${f.id}` });
      if (r.ok) {
        await prisma.followUp.update({ where: { id: f.id }, data: { hubTaskAt: now } });
        report.followUpTasks++;
      } else if (r.configured) report.errors.push(`Hub-Aufgabe Nachgespräch ${f.id}: ${r.error}`);
    }
  } catch (e) {
    report.errors.push(`Nachgespräche: ${e instanceof Error ? e.message : e}`);
  }

  // 4. Laufzeitende in 14 Tagen → Aufgabe im Hub (einmalig, über MandateEvent markiert)
  try {
    const soon = new Date(now);
    soon.setDate(soon.getDate() + 14);
    const mandates = await prisma.mandate.findMany({ where: { status: { in: ACTIVE_STATUSES }, endDate: { lte: soon, gte: now } }, include: { events: { where: { type: "NOTE", payload: { path: ["kind"], equals: "expiry-task" } }, take: 1 } } });
    for (const m of mandates) {
      if (m.events.length) continue;
      const r = await createHubTask({ contactId: m.hubContactId, title: `Laufzeitende Suchauftrag: ${m.title}`, description: `Laufzeit endet am ${m.endDate!.toLocaleDateString("de-DE")}. Verlängerung oder Abschluss klären.`, dueAt: m.endDate!.toISOString(), assigneeId: m.ownerId, externalRef: `baax-stay:expiry:${m.id}` });
      if (r.ok) {
        await prisma.mandateEvent.create({ data: { mandateId: m.id, type: "NOTE", payload: { kind: "expiry-task", note: "Erinnerung Laufzeitende als Aufgabe im Hub angelegt" }, userId: "cron", userName: "System" } });
        report.expiryTasks++;
      } else if (r.configured) report.errors.push(`Hub-Aufgabe Laufzeit ${m.id}: ${r.error}`);
    }
  } catch (e) {
    report.errors.push(`Laufzeitende: ${e instanceof Error ? e.message : e}`);
  }

  // 5. Löschkonzept: verworfene Leads nach n Monaten löschen
  try {
    const cutoff = new Date(now);
    cutoff.setMonth(cutoff.getMonth() - env.retentionDiscardedLeadsMonths);
    const r = await prisma.lead.deleteMany({ where: { status: "VERWORFEN", updatedAt: { lt: cutoff }, mandate: null, sellerProperties: { none: {} } } });
    report.deletedLeads = r.count;
  } catch (e) {
    report.errors.push(`Löschkonzept: ${e instanceof Error ? e.message : e}`);
  }

  // 6. Wechselkurse (EZB) täglich
  const fx = await fetchEcbRates();
  report.fxUpdated = fx.updated.length;
  if (fx.error) report.errors.push(`Wechselkurse: ${fx.error}`);

  // 7. Monatserster: Suchbericht-Entwürfe für den Vormonat
  if (now.getDate() === 1) {
    try {
      const { start, end } = previousMonth(now);
      report.reportDrafts = await createMonthlyDrafts(start, end);
    } catch (e) {
      report.errors.push(`Suchbericht-Entwürfe: ${e instanceof Error ? e.message : e}`);
    }
  }

  await audit({ userId: "cron", action: "CRON", entity: "Cron", meta: { ...report } });

  // Fehler an den Admin melden (Konzept §11)
  if (report.errors.length && env.adminEmail) {
    await sendMail({ to: env.adminEmail, subject: `Baax Stay: ${report.errors.length} Fehler im Tagesjob`, text: report.errors.join("\n"), purpose: "cron-errors", entity: "Cron" });
  }
  return report;
}
