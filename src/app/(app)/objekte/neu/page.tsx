import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { Card, PageHeader } from "@/components/ui/card";
import { PropertyForm } from "@/components/properties/property-form";
import type { PropertyFormInput } from "../actions";

export const metadata = { title: "Objekt erfassen" };

export default async function NewPropertyPage({ searchParams }: { searchParams: Promise<{ sellerLeadId?: string }> }) {
  const user = await requireUser();
  if (!can.createProperty(user.role)) notFound();
  const { sellerLeadId } = await searchParams;
  const [regions, partners, referrers, sellerLead] = await Promise.all([
    prisma.region.findMany({ orderBy: [{ country: "asc" }, { name: "asc" }], select: { key: true, name: true, country: true, focus: true } }),
    prisma.partner.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.referrer.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    sellerLeadId ? prisma.lead.findUnique({ where: { id: sellerLeadId } }) : null,
  ]);

  const today = new Date().toISOString().slice(0, 10);
  const initial: PropertyFormInput = {
    title: sellerLead ? `${sellerLead.interest?.slice(0, 60) || "Objekt"} (${sellerLead.name})` : "",
    segment: sellerLead?.segment ?? "FEWO",
    country: "",
    region: "",
    locality: sellerLead?.regions[0] ?? null,
    address: null,
    price: (sellerLead?.budgetMax ?? sellerLead?.budgetMin ?? 0) as number,
    currency: "EUR",
    units: null,
    livingArea: null,
    licenseStatus: "UNKLAR",
    licenseNote: null,
    occupancyPct: null,
    adr: null,
    revenueYear: null,
    features: [],
    description: sellerLead?.interest ?? null,
    source: sellerLead ? "DIREKT" : "PARTNER",
    sourceDetail: sellerLead ? `Verkäuferkontakt ${sellerLead.name}${sellerLead.sourceDetail ? ` (${sellerLead.sourceDetail})` : ""}` : null,
    knownSince: sellerLead ? sellerLead.createdAt.toISOString().slice(0, 10) : today,
    knownSourceNote: sellerLead ? `Verkäuferkontakt ${sellerLead.name}, erfasst am ${sellerLead.createdAt.toLocaleDateString("de-DE")}` : null,
    sellerLeadId: sellerLead?.id ?? null,
    offmarket: Boolean(sellerLead),
    referrerId: sellerLead?.referrerId ?? null,
    partnerId: null,
  };

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={sellerLead ? "Off-Market-Objekt anlegen" : "Objekt erfassen"} subtitle="Nach dem Speichern läuft das Matching gegen alle aktiven Suchprofile." />
      <Card>
        <PropertyForm initial={initial} regions={regions} partners={partners} referrers={referrers} sellerLead={sellerLead ? { id: sellerLead.id, name: sellerLead.name } : null} isAdmin={user.role === "ADMIN"} canEdit />
      </Card>
    </div>
  );
}
