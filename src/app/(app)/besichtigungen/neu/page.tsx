import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { Card, PageHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { createInspectionAction } from "../actions";

export const metadata = { title: "Besichtigung protokollieren" };

export default async function NewInspectionPage({ searchParams }: { searchParams: Promise<{ property?: string; mandate?: string; trip?: string }> }) {
  const user = await requireUser();
  if (!can.editMandates(user.role)) notFound();
  const sp = await searchParams;
  const trip = sp.trip ? await prisma.trip.findUnique({ where: { id: sp.trip } }) : null;
  const mandateId = sp.mandate ?? trip?.mandateId ?? null;
  const properties = sp.property
    ? await prisma.property.findMany({ where: { id: sp.property }, select: { id: true, title: true } })
    : mandateId
      ? (await prisma.match.findMany({ where: { mandateId, status: { notIn: ["ABGELEHNT", "GESCHLOSSEN"] } }, include: { property: { select: { id: true, title: true } } } })).map((m) => m.property)
      : await prisma.property.findMany({ where: { active: true }, orderBy: { updatedAt: "desc" }, take: 100, select: { id: true, title: true } });
  const mandates = sp.property
    ? (await prisma.match.findMany({ where: { propertyId: sp.property }, include: { mandate: { select: { id: true, title: true } } } })).map((m) => m.mandate)
    : mandateId
      ? await prisma.mandate.findMany({ where: { id: mandateId }, select: { id: true, title: true } })
      : [];
  const local = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);

  return (
    <div className="mx-auto max-w-xl">
      <Link href="/besichtigungen" className="text-sm text-muted hover:text-petrol">
        ← Besichtigungen
      </Link>
      <PageHeader title="Besichtigung protokollieren" subtitle="Protokoll und Fotos direkt vom Handy am Objekt." />
      <Card>
        <form action={createInspectionAction} className="space-y-4">
          <Field label="Objekt" required>
            <Select name="propertyId" required defaultValue={sp.property ?? properties[0]?.id}>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Suchauftrag" hint="optional">
            <Select name="mandateId" defaultValue={mandateId ?? ""}>
              <option value="">–</option>
              {mandates.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.title}
                </option>
              ))}
            </Select>
          </Field>
          {trip && <input type="hidden" name="tripId" value={trip.id} />}
          <Field label="Datum und Uhrzeit">
            <Input type="datetime-local" name="date" defaultValue={local} />
          </Field>
          <Button type="submit" size="lg" disabled={properties.length === 0}>
            Protokoll starten
          </Button>
        </form>
      </Card>
    </div>
  );
}
