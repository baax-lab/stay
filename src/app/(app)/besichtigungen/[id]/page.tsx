import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import type { InspectionItem } from "@/lib/precheck";
import { Card, CardTitle, PageHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ActionButton } from "@/components/ui/action-form";
import { InspectionEditor } from "@/components/inspections/inspection-editor";
import { InspectionPhotoUpload } from "@/components/inspections/photo-upload";
import { adoptInspectionPhotosAction, deleteInspectionPhotoAction } from "../actions";

export const metadata = { title: "Besichtigung" };

const local = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

export default async function InspectionPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const i = await prisma.inspection.findUnique({ where: { id }, include: { property: { select: { id: true, title: true, locality: true, region: true } }, mandate: { select: { id: true, title: true } }, trip: { select: { id: true, title: true } } } });
  if (!i) notFound();
  const canEdit = can.editMandates(user.role);
  const locked = !canEdit || i.status === "ABGESCHLOSSEN";
  const photos = (i.photos as string[]) ?? [];

  return (
    <div className="mx-auto max-w-2xl">
      <Link href={`/objekte/${i.property.id}?tab=besichtigungen`} className="text-sm text-muted hover:text-petrol">
        ← {i.property.title}
      </Link>
      <PageHeader
        title="Besichtigungsprotokoll"
        subtitle={[i.property.title, i.property.locality ?? i.property.region, i.mandate?.title, i.trip?.title].filter(Boolean).join(" · ")}
        action={<Badge tone={i.status === "ABGESCHLOSSEN" ? "ok" : "warn"}>{i.status === "ABGESCHLOSSEN" ? "abgeschlossen" : "Entwurf"}</Badge>}
      />
      <Card className="mb-4">
        <CardTitle action={photos.length > 0 && can.editProperty(user.role) ? <ActionButton action={adoptInspectionPhotosAction.bind(null, i.id)}>Ins Objekt übernehmen</ActionButton> : undefined}>Fotos ({photos.length})</CardTitle>
        {canEdit && <InspectionPhotoUpload id={i.id} />}
        <div className="mt-3 grid grid-cols-3 gap-2" data-testid="inspection-photos">
          {photos.map((f) => (
            <figure key={f} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/files/${f}`} alt="" className="aspect-square w-full rounded-xl object-cover" loading="lazy" />
              {canEdit && (
                <div className="absolute right-1 top-1">
                  <ActionButton action={deleteInspectionPhotoAction.bind(null, i.id, f)} variant="danger" confirm="Foto löschen?">
                    ×
                  </ActionButton>
                </div>
              )}
            </figure>
          ))}
        </div>
      </Card>
      <InspectionEditor
        id={i.id}
        locked={locked}
        initial={{ date: local(i.date), attendees: i.attendees ?? "", items: i.items as InspectionItem[], rating: i.rating, recommendation: i.recommendation, notes: i.notes ?? "" }}
      />
    </div>
  );
}
