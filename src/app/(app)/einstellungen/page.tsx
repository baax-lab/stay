import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser, requirePermission } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import { env } from "@/lib/env";
import { activeEventSchema, getActiveEvent, getGoal, getPublicSources, goalSchema, publicSourceSchema, setActiveEvent, setGoal, setPublicSources } from "@/lib/settings";
import Link from "next/link";
import { LEAD_SOURCE_LABEL, entries } from "@/lib/labels";
import { Card, CardTitle, Notice, PageHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import { ActionButton, type ActionResult } from "@/components/ui/action-form";
import { testHubConnection } from "@/lib/hub";
import { sendMail, verifyMailConnection } from "@/lib/mail";
import { parseHex } from "@/lib/brand";

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

async function saveGoal(formData: FormData) {
  "use server";
  const user = await requirePermission("editEventSetting");
  const value = goalSchema.parse({
    mandates: Number(formData.get("mandates") ?? 3),
    days: Number(formData.get("days") ?? 90),
    startDate: String(formData.get("startDate") ?? ""),
  });
  await setGoal(value, user.id);
  await audit({ userId: user.id, action: "SETTING_UPDATE", entity: "Setting", entityId: "goal", meta: value });
  revalidatePath("/");
  redirect("/einstellungen?saved=goal");
}

async function testHub(): Promise<ActionResult> {
  "use server";
  const user = await requirePermission("editEventSetting");
  const r = await testHubConnection();
  await audit({ userId: user.id, action: "HUB_TEST", entity: "Setting", meta: r });
  return r.ok ? { ok: true, message: `${r.message}${r.ms ? ` (${r.ms} ms)` : ""}` } : { ok: false, error: r.message };
}

async function testSmtp(): Promise<ActionResult> {
  "use server";
  const user = await requirePermission("editEventSetting");
  const r = await verifyMailConnection();
  await audit({ userId: user.id, action: "MAIL_TEST", entity: "Setting", meta: { ok: r.ok, message: r.message } });
  return r.ok ? { ok: true, message: r.message } : { ok: false, error: r.message };
}

async function sendTestMail(): Promise<ActionResult> {
  "use server";
  const user = await requirePermission("editEventSetting");
  const to = user.email || env.adminEmail;
  if (!to) return { ok: false, error: "Keine Empfängeradresse (E-Mail im Konto oder ADMIN_EMAIL)." };
  const r = await sendMail({
    to,
    subject: "Baax Stay: Testmail",
    text: "Diese Testmail wurde aus den Einstellungen von Baax Stay gesendet. Absender, Signatur und Zustellung bitte prüfen.",
    userId: user.id,
    purpose: "test",
    entity: "Setting",
  });
  return r.sent ? { ok: true, message: `Testmail an ${to} gesendet.` } : { ok: false, error: r.error ?? "Nicht gesendet (SMTP nicht konfiguriert)." };
}

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string }> }) {
  const user = await requireUser();
  if (!can.editEventSetting(user.role)) redirect("/");
  const { saved, error } = await searchParams;
  const [event, sources, goal] = await Promise.all([getActiveEvent(), getPublicSources(), getGoal()]);

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

      <div className="mb-4 flex flex-wrap gap-2">
        <Link href="/einstellungen/honorar" className="rounded-full border border-line bg-surface px-4 py-2 text-sm font-medium text-petrol hover:border-brand">Honorarstaffel</Link>
        <Link href="/einstellungen/regionen" className="rounded-full border border-line bg-surface px-4 py-2 text-sm font-medium text-petrol hover:border-brand">Regionen und Vermietungsregeln</Link>
        <Link href="/einstellungen/nebenkosten" className="rounded-full border border-line bg-surface px-4 py-2 text-sm font-medium text-petrol hover:border-brand">Kaufnebenkosten</Link>
        <Link href="/einstellungen/kriterien" className="rounded-full border border-line bg-surface px-4 py-2 text-sm font-medium text-petrol hover:border-brand">Kriterienkatalog</Link>
        <Link href="/einstellungen/vorlagen" className="rounded-full border border-line bg-surface px-4 py-2 text-sm font-medium text-petrol hover:border-brand">Vorlagen</Link>
        <Link href="/einstellungen/wechselkurse" className="rounded-full border border-line bg-surface px-4 py-2 text-sm font-medium text-petrol hover:border-brand">Wechselkurse</Link>
        <Link href="/leads/import" className="rounded-full border border-line bg-surface px-4 py-2 text-sm font-medium text-petrol hover:border-brand">CSV-Import</Link>
        <Link href="/einstellungen/texte" className="rounded-full border border-line bg-surface px-4 py-2 text-sm font-medium text-petrol hover:border-brand">Rechtstexte</Link>
        {can.viewAuditLog(user.role) && (
          <Link href="/einstellungen/protokoll" className="rounded-full border border-line bg-surface px-4 py-2 text-sm font-medium text-petrol hover:border-brand">Protokoll</Link>
        )}
        {can.handlePrivacyRequests(user.role) && (
          <Link href="/einstellungen/datenschutz" className="rounded-full border border-line bg-surface px-4 py-2 text-sm font-medium text-petrol hover:border-brand">Datenschutz-Anfragen</Link>
        )}
      </div>

      <div className="space-y-4">
        <Card>
          <CardTitle>Ziel</CardTitle>
          <p className="mb-4 text-sm text-muted">Zielverfolgung auf dem Dashboard (Start: 3 Suchaufträge in 90 Tagen).</p>
          <form action={saveGoal} className="grid gap-4 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
            <Field label="Suchaufträge">
              <Input name="mandates" type="number" min={1} defaultValue={goal.mandates} />
            </Field>
            <Field label="Tage">
              <Input name="days" type="number" min={1} defaultValue={goal.days} />
            </Field>
            <Field label="Start">
              <Input name="startDate" type="date" defaultValue={goal.startDate} />
            </Field>
            <Button type="submit">Speichern</Button>
          </form>
        </Card>

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
              <dt>SMTP-Versand</dt>
              <dd>{env.mailConfigured ? <Badge tone="ok">konfiguriert</Badge> : <Badge tone="warn">nicht konfiguriert – Mails werden nur protokolliert</Badge>}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt>Cron (tägliche Jobs)</dt>
              <dd>{env.cronSecret ? <Badge tone="ok">CRON_SECRET gesetzt</Badge> : <Badge tone="warn">CRON_SECRET fehlt</Badge>}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt>Hausfarbe (BRAND_COLOR)</dt>
              <dd>
                {parseHex(env.brandColor) ? (
                  <span className="inline-flex items-center gap-2 text-xs">
                    <span className="inline-block size-4 rounded-full border border-line bg-brand" aria-hidden />
                    {parseHex(env.brandColor)}
                  </span>
                ) : (
                  <Badge tone="warn">{env.brandColor ? "ungültig, Standard aktiv" : "Platzhalter #19b5d4"}</Badge>
                )}
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt>Entwickler-Login</dt>
              <dd>{env.devLoginEnabled ? <Badge tone="danger">aktiv</Badge> : <Badge tone="ok">aus</Badge>}</dd>
            </div>
          </dl>
          <div className="mt-4 text-xs text-muted">
            Hub-Endpunkte: {env.hub.apiUrl || "–"} · Kontakte {env.hub.contactsPath} · Aufgaben {env.hub.tasksPath} · Termine {env.hub.appointmentsPath}
          </div>
          <div className="mt-4 flex flex-col gap-2">
            <ActionButton action={testHub}>Hub-Verbindung testen</ActionButton>
            <ActionButton action={testSmtp}>SMTP-Anmeldung testen</ActionButton>
            <ActionButton action={sendTestMail}>Testmail an mich senden</ActionButton>
          </div>
        </Card>
      </div>
    </div>
  );
}
