import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser, requirePermission } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import { formatEur } from "@/lib/fees";
import { Card, Notice, PageHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";

export const metadata = { title: "Honorarstaffel" };

const num = (v: FormDataEntryValue | null) => Number(String(v ?? "").replace(/[.\s€%]/g, "").replace(",", ".")) || 0;

async function saveBand(formData: FormData) {
  "use server";
  const user = await requirePermission("editFeeBands");
  const id = String(formData.get("id") ?? "");
  const volumeTo = String(formData.get("volumeTo") ?? "").trim();
  const data = {
    volumeFrom: num(formData.get("volumeFrom")),
    volumeTo: volumeTo ? num(volumeTo) : null,
    baseFee: num(formData.get("baseFee")),
    successFee: num(formData.get("successFee")),
    bonusPct: num(formData.get("bonusPct")) / 100,
    bonusCapPct: num(formData.get("bonusCapPct")) / 100,
    note: String(formData.get("note") ?? "").trim() || null,
  };
  if (id) await prisma.feeBand.update({ where: { id }, data });
  else await prisma.feeBand.create({ data });
  await audit({ userId: user.id, action: "FEEBAND_UPDATE", entity: "FeeBand", entityId: id || null, meta: data });
  revalidatePath("/einstellungen/honorar");
}

async function deleteBand(id: string) {
  "use server";
  const user = await requirePermission("editFeeBands");
  await prisma.feeBand.delete({ where: { id } });
  await audit({ userId: user.id, action: "FEEBAND_UPDATE", entity: "FeeBand", entityId: id, meta: { deleted: true } });
  revalidatePath("/einstellungen/honorar");
}

export default async function FeeBandsPage() {
  const user = await requireUser();
  if (!can.editFeeBands(user.role)) redirect("/");
  const bands = await prisma.feeBand.findMany({ orderBy: { volumeFrom: "asc" } });

  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/einstellungen" className="text-sm text-muted hover:text-petrol">
        ← Einstellungen
      </Link>
      <PageHeader title="Honorarstaffel" subtitle="Nur Leitung und Admin. Wird beim Suchauftrag aus dem Budget vorgeschlagen und ist dort überschreibbar." />
      <Notice tone="warn">Startwerte aus dem Seed. Die Höhe je Segment ist ein offener Punkt im Konzept und von der Leitung festzulegen.</Notice>
      <div className="mt-4 space-y-3">
        {[...bands, null].map((b) => (
          <Card key={b?.id ?? "new"}>
            <form action={saveBand} className="grid gap-3 sm:grid-cols-7 sm:items-end">
              <input type="hidden" name="id" value={b?.id ?? ""} />
              <Field label="Volumen von (€)">
                <Input name="volumeFrom" defaultValue={b?.volumeFrom ?? ""} inputMode="numeric" required />
              </Field>
              <Field label="bis (€)" hint="leer = offen">
                <Input name="volumeTo" defaultValue={b?.volumeTo ?? ""} inputMode="numeric" />
              </Field>
              <Field label="Grundhonorar">
                <Input name="baseFee" defaultValue={b?.baseFee ?? 0} inputMode="numeric" />
              </Field>
              <Field label="Erfolgshonorar">
                <Input name="successFee" defaultValue={b?.successFee ?? ""} inputMode="numeric" required />
              </Field>
              <Field label="Bonus %">
                <Input name="bonusPct" defaultValue={b ? b.bonusPct * 100 : 10} />
              </Field>
              <Field label="Deckel %">
                <Input name="bonusCapPct" defaultValue={b ? b.bonusCapPct * 100 : 25} />
              </Field>
              <div className="flex gap-2">
                <Button type="submit" size="sm">
                  {b ? "Speichern" : "Band anlegen"}
                </Button>
              </div>
              <Field label="Notiz" className="sm:col-span-6">
                <Input name="note" defaultValue={b?.note ?? ""} />
              </Field>
              {b && (
                <div className="text-xs text-muted sm:col-span-1">
                  {formatEur(b.volumeFrom)} – {b.volumeTo ? formatEur(b.volumeTo) : "offen"}
                </div>
              )}
            </form>
            {b && (
              <form action={deleteBand.bind(null, b.id)} className="mt-2">
                <Button type="submit" size="sm" variant="ghost">
                  Band löschen
                </Button>
              </form>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
