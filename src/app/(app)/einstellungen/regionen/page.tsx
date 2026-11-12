import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser, requirePermission } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import { Card, PageHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { COUNTRY_LABEL } from "@/components/mandates/profile-form";

export const metadata = { title: "Regionen" };

async function saveRegion(formData: FormData) {
  "use server";
  const user = await requirePermission("editEventSetting");
  const id = String(formData.get("id") ?? "");
  const key = String(formData.get("key") ?? "").trim().toLowerCase();
  const data = {
    country: String(formData.get("country") ?? "").trim().toUpperCase(),
    key,
    name: String(formData.get("name") ?? "").trim(),
    focus: formData.get("focus") === "on",
    licenseRule: String(formData.get("licenseRule") ?? "").trim() || null,
  };
  if (!/^[a-z]{2}-[a-z0-9-]+$/.test(key) || data.country.length !== 2 || !data.name) return;
  if (id) await prisma.region.update({ where: { id }, data });
  else await prisma.region.create({ data });
  // Ampel aller Objekte der Region neu ableiten
  const { deriveLicenseLight } = await import("@/lib/license");
  const props = await prisma.property.findMany({ where: { region: key }, select: { id: true, licenseStatus: true } });
  for (const p of props) await prisma.property.update({ where: { id: p.id }, data: { licenseLight: deriveLicenseLight(p.licenseStatus, data.licenseRule).light } });
  await audit({ userId: user.id, action: "SETTING_UPDATE", entity: "Region", entityId: id || key, meta: data });
  revalidatePath("/einstellungen/regionen");
}

export default async function RegionsPage() {
  const user = await requireUser();
  if (!can.editEventSetting(user.role)) redirect("/");
  const regions = await prisma.region.findMany({ orderBy: [{ country: "asc" }, { name: "asc" }] });
  const byCountry = new Map<string, typeof regions>();
  for (const r of regions) byCountry.set(r.country, [...(byCountry.get(r.country) ?? []), r]);

  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/einstellungen" className="text-sm text-muted hover:text-petrol">
        ← Einstellungen
      </Link>
      <PageHeader title="Regionen und Vermietungsregeln" subtitle="Stammdaten für Suchprofile, Objekte und Matching. Die Regel-Kurzinfo speist die Genehmigungsampel (Worte wie „Vergabestopp“ setzen Objekte ohne Lizenz auf Rot)." />
      <div className="space-y-4">
        {[...byCountry.entries()].map(([country, list]) => (
          <Card key={country}>
            <h2 className="mb-3 font-semibold text-petrol">{COUNTRY_LABEL[country] ?? country}</h2>
            <div className="space-y-2">
              {list.map((r) => (
                <form key={r.id} action={saveRegion} className="grid gap-2 rounded-xl bg-canvas p-3 sm:grid-cols-[1fr_1.4fr_2fr_auto_auto] sm:items-end">
                  <input type="hidden" name="id" value={r.id} />
                  <input type="hidden" name="country" value={r.country} />
                  <Field label="Key">
                    <Input name="key" defaultValue={r.key} />
                  </Field>
                  <Field label="Name">
                    <Input name="name" defaultValue={r.name} />
                  </Field>
                  <Field label="Vermietungs-/Zweitwohnungsregel (Kurzinfo)">
                    <Input name="licenseRule" defaultValue={r.licenseRule ?? ""} placeholder="z. B. Touristische Vermietung nur mit ETV-Lizenz; Vergabestopp seit 2022" />
                  </Field>
                  <label className="flex items-center gap-1 pb-3 text-xs">
                    <input type="checkbox" name="focus" defaultChecked={r.focus} className="h-4 w-4 accent-brand-strong" /> Fokus
                  </label>
                  <Button type="submit" size="sm" variant="secondary">
                    Speichern
                  </Button>
                </form>
              ))}
            </div>
          </Card>
        ))}
        <Card>
          <h2 className="mb-3 font-semibold text-petrol">Neue Region</h2>
          <form action={saveRegion} className="grid gap-2 sm:grid-cols-[80px_1fr_1.4fr_2fr_auto] sm:items-end">
            <Field label="Land">
              <Input name="country" placeholder="ES" maxLength={2} required />
            </Field>
            <Field label="Key" hint="land-name">
              <Input name="key" placeholder="es-formentera" required />
            </Field>
            <Field label="Name">
              <Input name="name" required />
            </Field>
            <Field label="Regel">
              <Input name="licenseRule" />
            </Field>
            <Button type="submit" size="sm">
              Anlegen
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
