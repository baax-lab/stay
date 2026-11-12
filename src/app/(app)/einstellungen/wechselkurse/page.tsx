import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser, requirePermission } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import { ECB_URL, fetchEcbRates } from "@/lib/services/fx";
import { Card, Notice, PageHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Table, Td, Th } from "@/components/ui/table";

export const metadata = { title: "Wechselkurse" };

async function addRate(formData: FormData) {
  "use server";
  const user = await requirePermission("editFeeBands");
  const currency = String(formData.get("currency") ?? "").trim().toUpperCase();
  const rate = Number(String(formData.get("rateToEur") ?? "").replace(",", "."));
  if (!/^[A-Z]{3}$/.test(currency) || !(rate > 0)) return;
  await prisma.fxRate.create({ data: { currency, rateToEur: rate, source: "manuell" } });
  await audit({ userId: user.id, action: "SETTING_UPDATE", entity: "FxRate", meta: { currency, rate } });
  revalidatePath("/einstellungen/wechselkurse");
}

async function fetchNow() {
  "use server";
  const user = await requirePermission("editFeeBands");
  const r = await fetchEcbRates();
  await audit({ userId: user.id, action: "SETTING_UPDATE", entity: "FxRate", meta: { source: "EZB", ...r } });
  revalidatePath("/einstellungen/wechselkurse");
  redirect(`/einstellungen/wechselkurse?${r.error ? `error=${encodeURIComponent(r.error)}` : `ok=${r.updated.length}`}`);
}

export default async function FxPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const user = await requireUser();
  if (!can.editFeeBands(user.role)) redirect("/");
  const { ok, error } = await searchParams;
  const rates = await prisma.fxRate.findMany({ orderBy: { fetchedAt: "desc" }, take: 200 });
  const latest = new Map<string, (typeof rates)[number]>();
  for (const r of rates) if (!latest.has(r.currency)) latest.set(r.currency, r);

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/einstellungen" className="text-sm text-muted hover:text-petrol">
        ← Einstellungen
      </Link>
      <PageHeader title="Wechselkurse" subtitle="Für Objekte in Fremdwährung (z. B. CHF). Quelle: EZB-Referenzkurse, täglich per Cron; manuelle Einträge möglich. Es gilt der jüngste Eintrag je Währung." />
      {ok && <div className="mb-4"><Notice tone="ok">{ok} Kurse von der EZB übernommen.</Notice></div>}
      {error && <div className="mb-4"><Notice tone="danger">EZB-Abruf fehlgeschlagen: {error}</Notice></div>}
      <div className="space-y-4">
        <Card>
          <h2 className="mb-3 font-semibold text-petrol">Aktuell</h2>
          <Table>
            <thead>
              <tr>
                <Th>Währung</Th>
                <Th>1 Einheit = EUR</Th>
                <Th>Quelle</Th>
                <Th>Stand</Th>
              </tr>
            </thead>
            <tbody>
              {[...latest.values()].map((r) => (
                <tr key={r.id}>
                  <Td className="font-medium">{r.currency}</Td>
                  <Td>{r.rateToEur.toLocaleString("de-DE", { maximumFractionDigits: 4 })}</Td>
                  <Td>{r.source}</Td>
                  <Td>{r.fetchedAt.toLocaleString("de-DE", { dateStyle: "medium", timeStyle: "short" })}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
          <form action={fetchNow} className="mt-4 flex items-center gap-3">
            <Button type="submit" variant="secondary">
              Jetzt von der EZB abrufen
            </Button>
            <span className="text-xs text-muted">{ECB_URL}</span>
          </form>
        </Card>
        <Card>
          <h2 className="mb-3 font-semibold text-petrol">Manuell eintragen</h2>
          <form action={addRate} className="grid gap-3 sm:grid-cols-[120px_1fr_auto] sm:items-end">
            <Field label="Währung">
              <Input name="currency" maxLength={3} placeholder="CHF" required />
            </Field>
            <Field label="1 Einheit = … EUR">
              <Input name="rateToEur" placeholder="1,06" required />
            </Field>
            <Button type="submit">Eintragen</Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
