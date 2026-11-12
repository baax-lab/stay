import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser, requirePermission } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import { Card, Notice, PageHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { COUNTRY_LABEL } from "@/components/mandates/profile-form";

export const metadata = { title: "Kaufnebenkosten" };

const dec = (v: FormDataEntryValue | null) => {
  const s = String(v ?? "").trim().replace(",", ".");
  return s === "" ? null : Number(s);
};

async function saveCost(formData: FormData) {
  "use server";
  const user = await requirePermission("editFeeBands");
  const id = String(formData.get("id") ?? "");
  const pct = dec(formData.get("pct"));
  const flat = dec(formData.get("flat"));
  const data = {
    country: String(formData.get("country") ?? "").trim().toUpperCase(),
    regionKey: String(formData.get("regionKey") ?? "") || null,
    label: String(formData.get("label") ?? "").trim(),
    pct: pct != null && Number.isFinite(pct) ? pct : null,
    flat: flat != null && Number.isFinite(flat) ? Math.round(flat) : null,
    note: String(formData.get("note") ?? "").trim() || null,
    validFrom: formData.get("validFrom") ? new Date(String(formData.get("validFrom"))) : new Date(),
  };
  if (data.country.length !== 2 || !data.label || (data.pct == null && data.flat == null)) return;
  if (id) await prisma.countryCost.update({ where: { id }, data });
  else await prisma.countryCost.create({ data });
  await audit({ userId: user.id, action: "SETTING_UPDATE", entity: "CountryCost", entityId: id || null, meta: { ...data, validFrom: data.validFrom.toISOString() } });
  revalidatePath("/einstellungen/nebenkosten");
}

async function deleteCost(id: string) {
  "use server";
  const user = await requirePermission("editFeeBands");
  await prisma.countryCost.delete({ where: { id } });
  await audit({ userId: user.id, action: "SETTING_UPDATE", entity: "CountryCost", entityId: id, meta: { deleted: true } });
  revalidatePath("/einstellungen/nebenkosten");
}

export default async function CountryCostsPage() {
  const user = await requireUser();
  if (!can.editFeeBands(user.role)) redirect("/");
  const [costs, regions] = await Promise.all([
    prisma.countryCost.findMany({ orderBy: [{ country: "asc" }, { regionKey: "asc" }, { label: "asc" }, { validFrom: "desc" }] }),
    prisma.region.findMany({ orderBy: [{ country: "asc" }, { name: "asc" }] }),
  ]);
  const regionName = Object.fromEntries(regions.map((r) => [r.key, r.name]));
  const countries = Array.from(new Set([...regions.map((r) => r.country), ...costs.map((c) => c.country)])).sort();

  return (
    <div className="mx-auto max-w-5xl">
      <Link href="/einstellungen" className="text-sm text-muted hover:text-petrol">
        ← Einstellungen
      </Link>
      <PageHeader title="Kaufnebenkosten" subtitle="Richtwerte je Land bzw. Region für die Gesamtkostenrechnung. Eine regionale Zeile ersetzt die Landeszeile mit gleicher Bezeichnung; bei mehreren Ständen gilt der jüngste gültige." />
      <Notice tone="warn">Startwerte aus dem Seed (DE-Bayern, AT-Tirol, IT-Südtirol, ES-Balearen). Inhaltlich prüfen und regelmäßig aktualisieren.</Notice>
      <div className="mt-4 space-y-4">
        {countries.map((country) => (
          <Card key={country}>
            <h2 className="mb-3 font-semibold text-petrol">{COUNTRY_LABEL[country] ?? country}</h2>
            <div className="space-y-2">
              {costs.filter((c) => c.country === country).map((c) => (
                <div key={c.id} className="rounded-xl bg-canvas p-3">
                  <form action={saveCost} className="grid gap-2 sm:grid-cols-[1.2fr_1.6fr_80px_90px_1.6fr_130px_auto] sm:items-end">
                    <input type="hidden" name="id" value={c.id} />
                    <input type="hidden" name="country" value={c.country} />
                    <Field label="Region">
                      <Select name="regionKey" defaultValue={c.regionKey ?? ""}>
                        <option value="">ganzes Land</option>
                        {regions.filter((r) => r.country === country).map((r) => (
                          <option key={r.key} value={r.key}>
                            {r.name}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field label="Bezeichnung">
                      <Input name="label" defaultValue={c.label} />
                    </Field>
                    <Field label="%">
                      <Input name="pct" defaultValue={c.pct ?? ""} />
                    </Field>
                    <Field label="€ pauschal">
                      <Input name="flat" defaultValue={c.flat ?? ""} />
                    </Field>
                    <Field label="Hinweis">
                      <Input name="note" defaultValue={c.note ?? ""} />
                    </Field>
                    <Field label="gültig ab">
                      <Input type="date" name="validFrom" defaultValue={c.validFrom.toISOString().slice(0, 10)} />
                    </Field>
                    <Button type="submit" size="sm" variant="secondary">
                      Speichern
                    </Button>
                  </form>
                  <form action={deleteCost.bind(null, c.id)} className="mt-1 text-right">
                    <button className="text-xs text-muted hover:text-danger">Löschen{c.regionKey ? ` (${regionName[c.regionKey] ?? c.regionKey})` : ""}</button>
                  </form>
                </div>
              ))}
            </div>
          </Card>
        ))}
        <Card>
          <h2 className="mb-3 font-semibold text-petrol">Neue Position</h2>
          <form action={saveCost} className="grid gap-2 sm:grid-cols-[80px_1.2fr_1.6fr_80px_90px_1.6fr_auto] sm:items-end">
            <Field label="Land">
              <Input name="country" maxLength={2} placeholder="ES" required />
            </Field>
            <Field label="Region (Key)" hint="optional">
              <Select name="regionKey" defaultValue="">
                <option value="">ganzes Land</option>
                {regions.map((r) => (
                  <option key={r.key} value={r.key}>
                    {r.country} · {r.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Bezeichnung">
              <Input name="label" required />
            </Field>
            <Field label="%">
              <Input name="pct" />
            </Field>
            <Field label="€ pauschal">
              <Input name="flat" />
            </Field>
            <Field label="Hinweis">
              <Input name="note" />
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
