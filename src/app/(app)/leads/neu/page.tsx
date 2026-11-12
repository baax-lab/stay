import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getActiveEvent } from "@/lib/settings";
import { LeadForm } from "@/components/leads/lead-form";
import { PageHeader } from "@/components/ui/card";

export const metadata = { title: "Kontakt erfassen" };

export default async function NewLeadPage() {
  await requireUser();
  const [event, regions] = await Promise.all([
    getActiveEvent(),
    prisma.region.findMany({ orderBy: [{ focus: "desc" }, { name: "asc" }], select: { key: true, name: true, country: true } }),
  ]);

  return (
    <div className="mx-auto max-w-xl">
      <PageHeader title="Kontakt erfassen" subtitle={event.active ? `Aktives Event: ${event.sourceDetail || event.source}` : "Kein aktives Event – Quelle bitte unter „Mehr Felder“ wählen"} />
      <LeadForm defaultSource={event.active ? event.source : "SONSTIGES"} defaultSourceDetail={event.active ? event.sourceDetail : ""} regionOptions={regions} />
    </div>
  );
}
