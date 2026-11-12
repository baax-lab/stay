import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser, requirePermission } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import { env } from "@/lib/env";
import { activeEventSchema, getActiveEvent, getPublicSources, publicSourceSchema, setActiveEvent, setPublicSources } from "@/lib/settings";
import { LEAD_SOURCE_LABEL, entries } from "@/lib/labels";
import { Card, CardTitle, Notice, PageHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";

export const metadata = { title: "Einstellungen" };

async function saveEvent(formData: FormData) {
  "use server";
  const user = await requirePermission("editEventSetting");
  const value = activeEventSchema.parse({
    active: formData.get("active") === "on",
    source: String(formData.get("source") ?? "MESSE"),
    sourceDetail: String(formData.get("sourceDetail") ?? ""),
  });
  await setActiveEvent(value, user.id);
  await audit({ userId: user.id, action: "SETTING_UPDATE", entity: "Setting", entityId: "activeEvent", meta: value });
  revalidatePath("/", "layout");
  redirect("/einstellungen?saved=event");
}

async function savePublicSources(formData: FormData) {
  "use server";
  const user = await requirePermission("editEventSetting");
  const text = String(formData.get("sources") ?? "");
  const record: Record<string, { source: string; sourceDetail: string }> = {};
  for (const line of text.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const [key, source, ...rest] = t.split("|").map((s) => s.trim());
    if (!key || !source) continue;
    record[key] = { source: source.toUpperCase(), sourceDetail: rest.join("|") };
  }
  const parsed = publicSourceSchema.safeParse(record);
  if (!parsed.success) redirect("/einstellungen?error=sources");
  await setPublicSources(parsed.data, user.id);
  await audit({ userId: user.id, action: "SETTING_UPDATE", entity: "Setting", entityId: "publicSources", meta: parsed.data });
  redirect("/einstellungen?saved=sources");
}

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string }> }) {
  const user = await requireUser();
  if (!can.editEventSetting(user.role)) redirect("/");
  const { saved, error } = await searchParams;
  const [event, sources] = await Promise.all([getActiveEvent(), getPublicSources()]);

  const sourcesText = Object.entries(sources)
    .map(([k, v]) => `${k} | ${v.source} | ${v.sourceDetail}`)
    .join("\n");

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Einstellungen" subtitle="Aktives Event, QR-Kennungen und Systemstatus" />

      {saved && (
        <div className="mb-4">
          <Notice tone="ok">Gespeichert.</Notice>
        </div>
      )}
      {error && (
        <div className="mb-4">
          <Notice tone="danger">Eingabe ungültig. Format je Zeile: kennung | QUELLE | Beschreibung</Notice>
        </div>
      )}

      <div className="space-y-4">
        <Card>
          <CardTitle>Aktives Event</CardTitle>
          <p className="mb-4 text-sm text-muted">Belegt die Quelle in der Schnellerfassung vor, z. B. Messe + „SuperStay LIVE 2026“.</p>
          <form action={saveEvent} className="space-y-4">
            <Checkbox name="active" defaultChecked={event.active} label="Event aktiv (Quelle wird vorbelegt)" />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Quelle">
                <Select name="source" defaultValue={event.source}>
                  {entries(LEAD_SOURCE_LABEL).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Bezeichnung">
                <Input name="sourceDetail" defaultValue={event.sourceDetail} placeholder="SuperStay LIVE 2026" />
              </Field>
            </div>
            <Button type="submit">Speichern</Button>
          </form>
        </Card>

        <Card>
          <CardTitle>QR-Kennungen für das Interessenformular</CardTitle>
          <p className="mb-4 text-sm text-muted">
            Link auf Visitenkarte oder Einseiter: <code className="rounded bg-canvas px-1.5 py-0.5">{env.appUrl}/interesse?q=superstay26</code>. Je Zeile: <code>kennung | QUELLE | Beschreibung</code>.
          </p>
          <form action={savePublicSources} className="space-y-4">
            <Textarea name="sources" defaultValue={sourcesText} rows={5} className="font-mono text-sm" />
            <Button type="submit">Speichern</Button>
          </form>
        </Card>

        <Card>
          <CardTitle>Systemstatus</CardTitle>
          <dl className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <dt>Hub-Login (SSO)</dt>
              <dd>{env.hub.ssoConfigured ? <Badge tone="ok">konfiguriert</Badge> : <Badge tone="warn">nicht konfiguriert</Badge>}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt>Hub-API (Kontakt- und Aufgabenübergabe)</dt>
              <dd>{env.hub.apiConfigured ? <Badge tone="ok">konfiguriert</Badge> : <Badge tone="warn">nicht konfiguriert – Leads bleiben „ausstehend“</Badge>}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt>Entwickler-Login</dt>
              <dd>{env.devLoginEnabled ? <Badge tone="danger">aktiv</Badge> : <Badge tone="ok">aus</Badge>}</dd>
            </div>
          </dl>
        </Card>
      </div>
    </div>
  );
}
