import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { PageHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";

export const metadata = { title: "Besichtigungen" };

export default async function InspectionsPage() {
  const user = await requireUser();
  const list = await prisma.inspection.findMany({ orderBy: { date: "desc" }, take: 100, include: { property: { select: { title: true, locality: true } }, mandate: { select: { title: true } } } });
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Besichtigungen" subtitle="Protokolle mit Fotos, mobil am Objekt erfasst" action={can.editMandates(user.role) && <ButtonLink href="/besichtigungen/neu">Neue Besichtigung</ButtonLink>} />
      <ul className="space-y-2">
        {list.map((i) => (
          <li key={i.id}>
            <Link href={`/besichtigungen/${i.id}`} className="block rounded-2xl border border-line bg-surface p-4 hover:border-brand">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium text-petrol">{i.property.title}</span>
                <Badge tone={i.status === "ABGESCHLOSSEN" ? "ok" : "warn"}>{i.status === "ABGESCHLOSSEN" ? "abgeschlossen" : "Entwurf"}</Badge>
              </div>
              <div className="mt-1 text-xs text-muted">
                {i.date.toLocaleString("de-DE", { dateStyle: "medium", timeStyle: "short" })} · {i.property.locality ?? ""} {i.mandate ? `· ${i.mandate.title}` : ""} {i.rating != null ? `· ${i.rating}/5` : ""} · {(i.photos as string[]).length} Fotos
              </div>
            </Link>
          </li>
        ))}
        {list.length === 0 && <li className="rounded-2xl border border-dashed border-line p-6 text-center text-sm text-muted">Noch keine Besichtigungen.</li>}
      </ul>
    </div>
  );
}
