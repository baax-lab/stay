import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { Card, PageHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ReferrerFields } from "@/components/partners/referrer-form";
import { createReferrerAction } from "@/app/(app)/partner/actions";

export const metadata = { title: "Tippgeber anlegen" };

export default async function NewReferrerPage() {
  const user = await requireUser();
  if (!can.editPartners(user.role)) redirect("/tippgeber");
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Tippgeber / Agentur / Multiplikator anlegen" />
      <Card>
        <form action={createReferrerAction} className="space-y-4">
          <ReferrerFields />
          <Button type="submit">Anlegen</Button>
        </form>
      </Card>
    </div>
  );
}
