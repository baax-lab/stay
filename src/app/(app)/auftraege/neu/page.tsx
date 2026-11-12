import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { Card, PageHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { createMandateAction } from "../actions";

export const metadata = { title: "Neuer Suchauftrag" };

export default async function NewMandatePage() {
  const user = await requireUser();
  if (!can.editMandates(user.role)) redirect("/auftraege");
  const referrers = await prisma.referrer.findMany({ where: { active: true }, orderBy: { name: "asc" } });

  return (
    <div className="mx-auto max-w-xl">
      <PageHeader title="Neuer Suchauftrag" subtitle="Für Bestandskunden ohne Lead. Messe-Leads werden direkt aus dem Lead umgewandelt." />
      <Card>
        <form action={createMandateAction} className="space-y-4">
          <Field label="Käufer (Name)" required>
            <Input name="buyerName" required />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="E-Mail">
              <Input name="buyerEmail" type="email" />
            </Field>
            <Field label="Telefon">
              <Input name="buyerPhone" type="tel" />
            </Field>
          </div>
          <Field label="Titel des Suchauftrags" required hint="z. B. FeWo Mallorca Nord, Rendite">
            <Input name="title" required />
          </Field>
          <Field label="Tippgeber / Referrer">
            <Select name="referrerId" defaultValue="">
              <option value="">–</option>
              {referrers.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </Select>
          </Field>
          <Button type="submit" size="lg">
            Anlegen und Erstgespräch starten
          </Button>
        </form>
      </Card>
    </div>
  );
}
