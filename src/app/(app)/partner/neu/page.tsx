import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { Card, PageHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PartnerFields } from "@/components/partners/partner-form";
import { createPartnerAction } from "../actions";

export const metadata = { title: "Partner anlegen" };

export default async function NewPartnerPage() {
  const user = await requireUser();
  if (!can.editPartners(user.role)) redirect("/partner");
  const regions = await prisma.region.findMany({ orderBy: [{ country: "asc" }, { name: "asc" }], select: { key: true, name: true, country: true } });
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Partner anlegen" />
      <Card>
        <form action={createPartnerAction} className="space-y-4">
          <PartnerFields regions={regions} />
          <Button type="submit">Anlegen</Button>
        </form>
      </Card>
    </div>
  );
}
