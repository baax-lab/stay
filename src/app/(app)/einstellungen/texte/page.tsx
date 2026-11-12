import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requirePermission, requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import { getLegalTexts, legalSchema, setLegalTexts } from "@/lib/settings";
import { Card, CardTitle, Notice, PageHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";

export const metadata = { title: "Rechtstexte" };

async function saveLegal(formData: FormData) {
  "use server";
  const user = await requirePermission("editEventSetting");
  const parsed = legalSchema.safeParse({
    privacyText: String(formData.get("privacyText") ?? ""),
    imprintUrl: String(formData.get("imprintUrl") ?? ""),
    contactEmail: String(formData.get("contactEmail") ?? ""),
  });
  if (!parsed.success) redirect("/einstellungen/texte?error=1");
  await setLegalTexts(parsed.data, user.id);
  // Nur Längen protokollieren, nicht den ganzen Text
  await audit({ userId: user.id, action: "SETTING_UPDATE", entity: "Setting", entityId: "legal", meta: { privacyTextLength: parsed.data.privacyText.length, imprintUrl: parsed.data.imprintUrl } });
  revalidatePath("/datenschutz");
  revalidatePath("/interesse");
  redirect("/einstellungen/texte?saved=1");
}

export default async function LegalTextsPage({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string }> }) {
  const user = await requireUser();
  if (!can.editEventSetting(user.role)) redirect("/");
  const { saved, error } = await searchParams;
  const legal = await getLegalTexts();

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Rechtstexte" subtitle="Datenschutzhinweise und Impressum für Interessenformular und öffentliche Seiten" />
      {saved && (
        <div className="mb-4">
          <Notice tone="ok">Gespeichert.</Notice>
        </div>
      )}
      {error && (
        <div className="mb-4">
          <Notice tone="danger">Eingabe ungültig: Impressum-Link muss mit https:// beginnen.</Notice>
        </div>
      )}
      <Card>
        <CardTitle>Datenschutzhinweise</CardTitle>
        <p className="mb-4 text-sm text-muted">
          Leer lassen, um den eingebauten Standardtext zu verwenden. Format: Absätze durch Leerzeilen, <code>## Überschrift</code> für Zwischenüberschriften, <code>**fett**</code>. Vorschau:{" "}
          <Link href="/datenschutz" target="_blank" className="underline">
            /datenschutz
          </Link>
        </p>
        <form action={saveLegal} className="space-y-4">
          <Field label="Text">
            <Textarea name="privacyText" rows={16} defaultValue={legal.privacyText} placeholder={"## Verantwortlich\nBaax Immobilien GmbH …"} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Impressum (Link)">
              <Input name="imprintUrl" type="url" defaultValue={legal.imprintUrl} placeholder="https://www.baax.de/impressum" />
            </Field>
            <Field label="Kontakt für Datenschutzanfragen">
              <Input name="contactEmail" type="email" defaultValue={legal.contactEmail} />
            </Field>
          </div>
          <Button type="submit">Speichern</Button>
        </form>
      </Card>
    </div>
  );
}
