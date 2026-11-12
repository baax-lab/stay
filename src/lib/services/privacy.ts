import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { deleteFile } from "./files";
import {
  ANONYMIZED_NAME,
  decideLead,
  decideMandate,
  decidePartner,
  decideReferrer,
  matchesQuery,
  type ErasureDecision,
  type PrivacyQuery,
} from "@/lib/privacy";

/** Gefundene Datensätze zu einer Person (nur IDs und Anzeige; Details im Export). */
export type PrivacySubjects = {
  leads: { id: string; name: string; email: string | null; createdAt: Date; mandateId: string | null }[];
  mandates: { id: string; title: string; buyerName: string; status: string; hubContactId: string | null }[];
  referrers: { id: string; name: string; email: string | null }[];
  partners: { id: string; name: string; company: string | null; email: string | null }[];
};

export type ErasureItem = { entity: "Lead" | "Mandate" | "Referrer" | "Partner"; id: string; label: string; hubContactId?: string | null } & ErasureDecision;

const insensitive = Prisma.QueryMode.insensitive;

function textFilter(q: PrivacyQuery, fields: { name: string; email: string; hub?: string }) {
  if (q.email) return { [fields.email]: { equals: q.email, mode: insensitive } };
  if (q.text) return { OR: [{ [fields.name]: { contains: q.text, mode: insensitive } }, ...(fields.hub ? [{ [fields.hub]: q.text }] : [])] };
  return null;
}

export async function findSubjects(q: PrivacyQuery): Promise<PrivacySubjects> {
  // Leads: E-Mail, normalisierte Telefonnummer, Name oder Hub-ID
  const leadWhere: Prisma.LeadWhereInput = q.phoneNorm ? { phoneNorm: q.phoneNorm } : (textFilter(q, { name: "name", email: "email", hub: "hubContactId" }) as Prisma.LeadWhereInput);
  const leads = await prisma.lead.findMany({ where: leadWhere, select: { id: true, name: true, email: true, createdAt: true, mandate: { select: { id: true } } }, take: 200 });

  // Telefonnummern ohne normalisierte Spalte: Kandidaten laden und im Code vergleichen (überschaubare Mengen)
  const phoneOnly = { NOT: { phone: null } };
  const mandateRows = await prisma.mandate.findMany({
    where: {
      OR: [
        ...(q.phoneNorm ? [{ buyerPhone: { not: null } }] : [textFilter(q, { name: "buyerName", email: "buyerEmail", hub: "hubContactId" }) as Prisma.MandateWhereInput]),
        { leadId: { in: leads.map((l) => l.id) } },
      ],
    },
    select: { id: true, title: true, buyerName: true, buyerEmail: true, buyerPhone: true, status: true, hubContactId: true, leadId: true },
    take: 500,
  });
  const leadIds = new Set(leads.map((l) => l.id));
  const mandates = mandateRows.filter((m) => (m.leadId && leadIds.has(m.leadId)) || matchesQuery(q, { name: m.buyerName, email: m.buyerEmail, phone: m.buyerPhone, hubContactId: m.hubContactId }));

  // Leads hinter gefundenen Aufträgen ergänzen
  const extraLeadIds = mandates.map((m) => m.leadId).filter((id): id is string => !!id && !leadIds.has(id));
  if (extraLeadIds.length) {
    const extra = await prisma.lead.findMany({ where: { id: { in: extraLeadIds } }, select: { id: true, name: true, email: true, createdAt: true, mandate: { select: { id: true } } } });
    leads.push(...extra);
  }

  const referrerRows = await prisma.referrer.findMany({
    where: q.phoneNorm ? phoneOnly : (textFilter(q, { name: "name", email: "email", hub: "hubContactId" }) as Prisma.ReferrerWhereInput),
    select: { id: true, name: true, email: true, phone: true, hubContactId: true },
    take: 500,
  });
  const partnerRows = await prisma.partner.findMany({
    where: q.phoneNorm ? phoneOnly : (textFilter(q, { name: "name", email: "email", hub: "hubContactId" }) as Prisma.PartnerWhereInput),
    select: { id: true, name: true, company: true, email: true, phone: true, hubContactId: true },
    take: 500,
  });

  return {
    leads: leads.map((l) => ({ id: l.id, name: l.name, email: l.email, createdAt: l.createdAt, mandateId: l.mandate?.id ?? null })),
    mandates: mandates.map((m) => ({ id: m.id, title: m.title, buyerName: m.buyerName, status: m.status, hubContactId: m.hubContactId })),
    referrers: referrerRows.filter((r) => matchesQuery(q, r)).map((r) => ({ id: r.id, name: r.name, email: r.email })),
    partners: partnerRows.filter((p) => matchesQuery(q, p)).map((p) => ({ id: p.id, name: p.name, company: p.company, email: p.email })),
  };
}

export function subjectCount(s: PrivacySubjects): number {
  return s.leads.length + s.mandates.length + s.referrers.length + s.partners.length;
}

/** Auskunft nach Art. 15 DSGVO: alle gespeicherten Daten zu den gefundenen Datensätzen. */
export async function buildExport(s: PrivacySubjects) {
  const leadIds = s.leads.map((l) => l.id);
  const mandateIds = s.mandates.map((m) => m.id);
  const referrerIds = s.referrers.map((r) => r.id);
  const partnerIds = s.partners.map((p) => p.id);
  const [leads, mandates, referrers, partners, files, auditEntries] = await Promise.all([
    prisma.lead.findMany({ where: { id: { in: leadIds } } }),
    prisma.mandate.findMany({
      where: { id: { in: mandateIds } },
      include: {
        profile: true,
        fee: true,
        events: true,
        presentations: true,
        offers: true,
        closing: true,
        followUps: true,
        documents: true,
        portalAccesses: { select: { id: true, createdAt: true, expiresAt: true, revokedAt: true, lastSeenAt: true, viewCount: true, sentTo: true } },
        reports: true,
        notifications: true,
        inspections: true,
        trips: { include: { costs: true } },
        matches: { select: { id: true, propertyId: true, score: true, status: true, createdAt: true } },
        rewards: true,
      },
    }),
    prisma.referrer.findMany({ where: { id: { in: referrerIds } }, include: { rewards: true } }),
    prisma.partner.findMany({ where: { id: { in: partnerIds } }, include: { sends: true, ratings: true, accesses: { select: { id: true, createdAt: true, expiresAt: true, revokedAt: true, lastSeenAt: true } } } }),
    prisma.storedFile.findMany({ where: { entity: "Mandate", entityId: { in: mandateIds } }, select: { id: true, fileName: true, mimeType: true, size: true, kind: true, createdAt: true } }),
    prisma.auditLog.findMany({ where: { entityId: { in: [...leadIds, ...mandateIds, ...referrerIds, ...partnerIds] } }, orderBy: { createdAt: "asc" } }),
  ]);
  return {
    verantwortlicher: "Baax Immobilien GmbH",
    erstelltAm: new Date().toISOString(),
    hinweis:
      "Auskunft nach Art. 15 DSGVO aus Baax Stay. Kontaktdaten können zusätzlich im Baax Hub gespeichert sein (siehe hubContactId); dafür ist eine gesonderte Auskunft aus dem Hub nötig. Dateien sind nur aufgelistet und werden auf Wunsch einzeln übermittelt.",
    leads,
    suchauftraege: mandates,
    dateien: files,
    tippgeber: referrers,
    partner: partners,
    protokoll: auditEntries,
  };
}

/** Plan: was mit jedem gefundenen Datensatz passiert. Wird vor dem Löschen angezeigt und beim Löschen neu berechnet. */
export async function planErasure(s: PrivacySubjects, now: Date = new Date()): Promise<ErasureItem[]> {
  const items: ErasureItem[] = [];
  const mandateFacts = await prisma.mandate.findMany({
    where: { id: { in: s.mandates.map((m) => m.id) } },
    select: { id: true, title: true, buyerName: true, hubContactId: true, status: true, contractSignedAt: true, gwgIdentifiedAt: true, endDate: true, updatedAt: true, closing: { select: { handoverDate: true } } },
  });
  const byMandate = new Map<string, ErasureDecision>();
  for (const m of mandateFacts) {
    const d = decideMandate({ status: m.status, contractSignedAt: m.contractSignedAt, gwgIdentifiedAt: m.gwgIdentifiedAt, hasClosing: !!m.closing, endDate: m.endDate, handoverDate: m.closing?.handoverDate ?? null, updatedAt: m.updatedAt }, now);
    byMandate.set(m.id, d);
    items.push({ entity: "Mandate", id: m.id, label: `${m.title} (${m.buyerName})`, hubContactId: m.hubContactId, ...d });
  }
  for (const l of s.leads) {
    const d = decideLead(l.mandateId ? (byMandate.get(l.mandateId) ?? { action: "BLOCKED", reason: "Suchauftrag nicht gefunden." }) : null);
    items.push({ entity: "Lead", id: l.id, label: `${l.name}${l.email ? ` <${l.email}>` : ""}`, ...d });
  }
  if (s.referrers.length) {
    const refs = await prisma.referrer.findMany({ where: { id: { in: s.referrers.map((r) => r.id) } }, select: { id: true, name: true, hubContactId: true, rewards: { select: { paidAt: true } } } });
    for (const r of refs) items.push({ entity: "Referrer", id: r.id, label: r.name, hubContactId: r.hubContactId, ...decideReferrer(r.rewards.map((x) => x.paidAt), now) });
  }
  for (const p of s.partners) items.push({ entity: "Partner", id: p.id, label: `${p.name}${p.company ? ` (${p.company})` : ""}`, ...decidePartner() });
  return items;
}

/** Löschung bzw. Anonymisierung ausführen. Protokolliert ohne personenbezogene Inhalte. */
export async function executeErasure(items: ErasureItem[], userId: string): Promise<{ deleted: number; anonymized: number; retained: number; blocked: number; hubContactIds: string[] }> {
  const result = { deleted: 0, anonymized: 0, retained: 0, blocked: 0, hubContactIds: [] as string[] };
  const touched: string[] = [];

  for (const it of items) {
    if (it.action === "RETAIN") {
      result.retained++;
      continue;
    }
    if (it.action === "BLOCKED") {
      result.blocked++;
      continue;
    }
    touched.push(it.id);
    if (it.entity === "Lead") {
      const lead = await prisma.lead.findUnique({ where: { id: it.id }, select: { hubContactId: true } });
      if (lead?.hubContactId) result.hubContactIds.push(lead.hubContactId);
      if (it.action === "DELETE") {
        await prisma.$transaction([
          prisma.property.updateMany({ where: { sellerLeadId: it.id }, data: { sellerLeadId: null } }),
          prisma.lead.updateMany({ where: { duplicateOfId: it.id }, data: { duplicateOfId: null } }),
          prisma.lead.delete({ where: { id: it.id } }),
        ]);
        result.deleted++;
      } else {
        await prisma.lead.update({
          where: { id: it.id },
          data: { name: ANONYMIZED_NAME, company: null, email: null, phone: null, phoneNorm: null, hubContactId: null, hubSyncError: null, interest: null, note: null, consentEmail: false, consentAt: null, clientId: null },
        });
        result.anonymized++;
      }
    } else if (it.entity === "Mandate") {
      if (it.hubContactId) result.hubContactIds.push(it.hubContactId);
      // Dokumente (Vertrag, Ausweis, Finanzierungsnachweis …) samt Dateien löschen
      const docs = await prisma.mandateDocument.findMany({ where: { mandateId: it.id }, select: { fileId: true } });
      const files = await prisma.storedFile.findMany({ where: { entity: "Mandate", entityId: it.id }, select: { id: true } });
      for (const id of new Set([...docs.map((d) => d.fileId), ...files.map((f) => f.id)])) await deleteFile(id);
      await prisma.$transaction([
        prisma.mandateDocument.deleteMany({ where: { mandateId: it.id } }),
        prisma.portalAccess.deleteMany({ where: { mandateId: it.id } }),
        prisma.buyerNotification.deleteMany({ where: { mandateId: it.id } }),
        prisma.report.deleteMany({ where: { mandateId: it.id } }),
        prisma.followUp.updateMany({ where: { mandateId: it.id }, data: { feedback: null } }),
        prisma.mandateEvent.updateMany({ where: { mandateId: it.id }, data: { payload: { geschwaerzt: true } } }),
        prisma.mandate.update({
          where: { id: it.id },
          data: {
            title: `Suchauftrag ${it.id.slice(-6)} (anonymisiert)`,
            buyerName: ANONYMIZED_NAME,
            buyerEmail: null,
            buyerPhone: null,
            hubContactId: null,
            note: null,
            interviewNotes: Prisma.DbNull,
            assessment: null,
            portalNextSteps: null,
            gwgIdentType: null,
            endReason: null,
          },
        }),
      ]);
      result.anonymized++;
    } else if (it.entity === "Referrer") {
      if (it.hubContactId) result.hubContactIds.push(it.hubContactId);
      await prisma.referrer.update({ where: { id: it.id }, data: { name: ANONYMIZED_NAME, company: null, email: null, phone: null, hubContactId: null, note: null, active: false } });
      result.anonymized++;
    } else if (it.entity === "Partner") {
      if (it.hubContactId) result.hubContactIds.push(it.hubContactId);
      await prisma.$transaction([
        prisma.partnerAccess.updateMany({ where: { partnerId: it.id, revokedAt: null }, data: { revokedAt: new Date() } }),
        prisma.partner.update({ where: { id: it.id }, data: { name: ANONYMIZED_NAME, email: null, phone: null, hubContactId: null, note: null, active: false } }),
      ]);
      result.anonymized++;
    }
  }

  // Inhalte älterer Protokolleinträge zu diesen Datensätzen schwärzen (Aktion, Zeitpunkt und Nutzer bleiben)
  if (touched.length) {
    await prisma.auditLog.updateMany({ where: { entityId: { in: touched } }, data: { meta: { geschwaerzt: true } } });
  }
  await audit({
    userId,
    action: "PRIVACY_ERASURE",
    entity: "Privacy",
    meta: {
      items: items.map((i) => ({ entity: i.entity, id: i.id, action: i.action, retainUntil: i.retainUntil?.toISOString() ?? null })),
      hubContactIds: result.hubContactIds,
    },
  });
  return result;
}
