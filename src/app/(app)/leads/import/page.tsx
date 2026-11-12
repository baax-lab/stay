import { redirect } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { Card, PageHeader } from "@/components/ui/card";
import { CsvImport } from "@/components/import/csv-import";

export const metadata = { title: "Leads importieren" };

export default async function ImportPage() {
  const user = await requireUser();
  if (!can.importData(user.role)) redirect("/leads");
  return (
    <div className="mx-auto max-w-5xl">
      <Link href="/leads" className="text-sm text-muted hover:text-petrol">← Zurück</Link>
      <PageHeader title="Leads importieren" subtitle="CSV hochladen, Spalten zuordnen, Vorschau mit Dubletten prüfen, speichern. Nur Leitung und Admin; der Import wird protokolliert." />
      <div className="mb-4 flex gap-2 text-sm">
        <Link href="/leads/import" className="rounded-full border border-line px-3 py-1 bg-brand-soft">Leads</Link>
        <Link href="/objekte/import" className="rounded-full border border-line px-3 py-1">Objekte</Link>
        <Link href="/partner/import" className="rounded-full border border-line px-3 py-1">Partner</Link>
      </div>
      <Card>
        <CsvImport scope="leads" />
      </Card>
    </div>
  );
}
