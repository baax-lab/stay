import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser, requirePermission } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import { getCriteria, slugKey } from "@/lib/services/criteria";
import { Card, Notice, PageHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";

export const metadata = { title: "Kriterienkatalog" };

async function saveCriterion(formData: FormData) {
  "use server";
  const user = await requirePermission("editEventSetting");
  const key = String(formData.get("key") ?? "");
  const data = {
    label: String(formData.get("label") ?? "").trim(),
    labelEn: String(formData.get("labelEn") ?? "").trim() || null,
    group: String(formData.get("group") ?? "").trim() || "Sonstiges",
    sort: Number(formData.get("sort") ?? 0) || 0,
    active: formData.get("active") === "on",
  };
  if (!key || !data.label) return;
  await prisma.criterion.update({ where: { key }, data });
  await audit({ userId: user.id, action: "SETTING_UPDATE", entity: "Criterion", entityId: key, meta: data });
  revalidatePath("/einstellungen/kriterien");
}

async function createCriterion(formData: FormData) {
  "use server";
  const user = await requirePermission("editEventSetting");
  const label = String(formData.get("label") ?? "").trim();
  const key = slugKey(String(formData.get("key") ?? "").trim() || label);
  if (!label || !key) redirect("/einstellungen/kriterien?error=Bezeichnung+fehlt");
  if (await prisma.criterion.findUnique({ where: { key } })) redirect(`/einstellungen/kriterien?error=${encodeURIComponent(`Schlüssel „${key}“ existiert bereits`)}`);
  await prisma.criterion.create({
    data: { key, label, labelEn: String(formData.get("labelEn") ?? "").trim() || null, group: String(formData.get("group") ?? "").trim() || "Sonstiges", sort: 999 },
  });
  await audit({ userId: user.id, action: "SETTING_UPDATE", entity: "Criterion", entityId: key, meta: { created: true, label } });
  revalidatePath("/einstellungen/kriterien");
  redirect("/einstellungen/kriterien?ok=1");
}

export default async function CriteriaPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const user = await requireUser();
  if (!can.editEventSetting(user.role)) redirect("/");
  const { ok, error } = await searchParams;
  const criteria = await getCriteria({ includeInactive: true });
  const groups = Array.from(new Set(criteria.map((c) => c.group)));

  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/einstellungen" className="text-sm text-muted hover:text-petrol">
        ← Einstellungen
      </Link>
      <PageHeader title="Kriterienkatalog" subtitle="Muss- und Wunschkriterien für Suchprofile und Objektmerkmale. Schlüssel bleiben fest, weil Profile und Objekte sie speichern; nicht mehr benötigte Kriterien deaktivieren statt löschen." />
      {ok && <div className="mb-4"><Notice tone="ok">Kriterium angelegt.</Notice></div>}
      {error && <div className="mb-4"><Notice tone="danger">{error}</Notice></div>}
      <div className="space-y-4">
        {groups.map((g) => (
          <Card key={g}>
            <h2 className="mb-3 font-semibold text-petrol">{g}</h2>
            <div className="space-y-2">
              {criteria.filter((c) => c.group === g).map((c) => (
                <form key={c.key} action={saveCriterion} className={`grid gap-2 rounded-xl p-3 sm:grid-cols-[1fr_1.4fr_1.4fr_1fr_70px_auto_auto] sm:items-end ${c.active ? "bg-canvas" : "bg-canvas opacity-60"}`}>
                  <input type="hidden" name="key" value={c.key} />
                  <div className="pb-3 font-mono text-xs text-muted">{c.key}</div>
                  <Field label="Bezeichnung">
                    <Input name="label" defaultValue={c.label} />
                  </Field>
                  <Field label="Englisch">
                    <Input name="labelEn" defaultValue={c.labelEn ?? ""} />
                  </Field>
                  <Field label="Gruppe">
                    <Input name="group" defaultValue={c.group} />
                  </Field>
                  <Field label="Sort.">
                    <Input name="sort" defaultValue={c.sort} inputMode="numeric" />
                  </Field>
                  <label className="flex items-center gap-1 pb-3 text-xs">
                    <input type="checkbox" name="active" defaultChecked={c.active} className="h-4 w-4 accent-brand-strong" /> aktiv
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
          <h2 className="mb-3 font-semibold text-petrol">Neues Kriterium</h2>
          <form action={createCriterion} className="grid gap-2 sm:grid-cols-[1.4fr_1.4fr_1fr_1fr_auto] sm:items-end">
            <Field label="Bezeichnung">
              <Input name="label" required placeholder="z. B. Sauna" />
            </Field>
            <Field label="Englisch">
              <Input name="labelEn" placeholder="Sauna" />
            </Field>
            <Field label="Gruppe">
              <Input name="group" placeholder="Ausstattung" list="criteria-groups" />
            </Field>
            <Field label="Schlüssel" hint="optional">
              <Input name="key" placeholder="automatisch" />
            </Field>
            <datalist id="criteria-groups">
              {groups.map((g) => (
                <option key={g} value={g} />
              ))}
            </datalist>
            <Button type="submit" size="sm">
              Anlegen
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
