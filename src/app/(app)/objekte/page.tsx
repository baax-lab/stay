import Link from "next/link";
import type { Availability, Prisma, Segment } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { SEGMENT_LABEL, entries } from "@/lib/labels";
import { formatEur } from "@/lib/fees";
import { AVAILABILITY_LABEL } from "@/lib/services/properties";
import { PageHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Table, Td, Th } from "@/components/ui/table";
import { SavedViews } from "@/components/ui/saved-views";
import { cn } from "@/lib/cn";

export const metadata = { title: "Objekte" };

const LIGHT: Record<string, string> = { GRUEN: "bg-ok", GELB: "bg-warn", ROT: "bg-danger", GRAU: "bg-muted" };
type Search = { q?: string; segment?: string; country?: string; region?: string; availability?: string; priceMax?: string; offmarket?: string };

export default async function PropertiesPage({ searchParams }: { searchParams: Promise<Search> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const where: Prisma.PropertyWhereInput = { active: true };
  if (sp.segment && sp.segment in SEGMENT_LABEL) where.segment = sp.segment as Segment;
  if (sp.country) where.country = sp.country;
  if (sp.region) where.region = sp.region;
  if (sp.availability) where.availability = sp.availability as Availability;
  if (sp.offmarket === "1") where.offmarket = true;
  if (sp.priceMax && Number(sp.priceMax)) where.price = { lte: Number(sp.priceMax) };
  if (sp.q?.trim()) {
    const q = sp.q.trim();
    where.OR = [{ title: { contains: q, mode: "insensitive" } }, { locality: { contains: q, mode: "insensitive" } }, { region: { contains: q.toLowerCase() } }, { sourceDetail: { contains: q, mode: "insensitive" } }];
  }

  const [properties, regions] = await Promise.all([
    prisma.property.findMany({ where, orderBy: { createdAt: "desc" }, include: { _count: { select: { matches: { where: { status: { in: ["NEU", "GEPRUEFT", "GEMERKT", "AN_KAEUFER"] } } } } }, partner: { select: { name: true, agreementAt: true } } }, take: 200 }),
    prisma.region.findMany({ orderBy: [{ country: "asc" }, { name: "asc" }] }),
  ]);
  const regionName = Object.fromEntries(regions.map((r) => [r.key, r.name]));
  const countries = Array.from(new Set(regions.map((r) => r.country))).sort();

  return (
    <div>
      <PageHeader
        title="Objekte"
        subtitle={`${properties.length} Objekte`}
        action={
          <div className="flex gap-2">
            <ButtonLink href="/objekte/offmarket" variant="secondary">
              Off-Market-Pipeline
            </ButtonLink>
            {can.createProperty(user.role) && <ButtonLink href="/objekte/neu">Objekt erfassen</ButtonLink>}
          </div>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <form action="/objekte" className="flex flex-wrap gap-2">
          <input name="q" defaultValue={sp.q ?? ""} placeholder="Titel, Ort, Quelle…" className="h-10 rounded-full border border-line bg-surface px-4 text-sm" />
          <select name="segment" defaultValue={sp.segment ?? ""} className="h-10 rounded-full border border-line bg-surface px-3 text-sm">
            <option value="">Segment: alle</option>
            {entries(SEGMENT_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <select name="country" defaultValue={sp.country ?? ""} className="h-10 rounded-full border border-line bg-surface px-3 text-sm">
            <option value="">Land: alle</option>
            {countries.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <select name="region" defaultValue={sp.region ?? ""} className="h-10 rounded-full border border-line bg-surface px-3 text-sm">
            <option value="">Region: alle</option>
            {regions.filter((r) => !sp.country || r.country === sp.country).map((r) => (
              <option key={r.key} value={r.key}>
                {r.name}
              </option>
            ))}
          </select>
          <select name="availability" defaultValue={sp.availability ?? ""} className="h-10 rounded-full border border-line bg-surface px-3 text-sm">
            <option value="">Verfügbarkeit: alle</option>
            {(Object.keys(AVAILABILITY_LABEL) as Availability[]).map((k) => (
              <option key={k} value={k}>
                {AVAILABILITY_LABEL[k]}
              </option>
            ))}
          </select>
          <input name="priceMax" defaultValue={sp.priceMax ?? ""} placeholder="Preis bis" inputMode="numeric" className="h-10 w-28 rounded-full border border-line bg-surface px-4 text-sm" />
          <button className="h-10 rounded-full border border-line bg-surface px-4 text-sm font-medium text-petrol">Filtern</button>
        </form>
        <SavedViews scope="objekte" current={new URLSearchParams(Object.entries(sp).filter(([, v]) => v) as [string, string][]).toString()} />
      </div>

      <Table>
        <thead>
          <tr>
            <Th>Objekt</Th>
            <Th>Segment</Th>
            <Th>Lage</Th>
            <Th>Preis</Th>
            <Th>Einheiten</Th>
            <Th>Ampel</Th>
            <Th>Verfügbar</Th>
            <Th>Quelle</Th>
            <Th>Treffer</Th>
            <Th>Bekannt seit</Th>
          </tr>
        </thead>
        <tbody>
          {properties.map((p) => (
            <tr key={p.id} className="hover:bg-canvas">
              <Td>
                <Link href={`/objekte/${p.id}`} className="font-medium text-petrol hover:underline">
                  {p.title}
                </Link>
                <div className="flex gap-1">
                  {p.offmarket && <Badge tone="brand">Off-Market</Badge>}
                  {p.duplicateOfId && <Badge tone="warn">Dublette?</Badge>}
                </div>
              </Td>
              <Td>{SEGMENT_LABEL[p.segment]}</Td>
              <Td className="text-xs">
                {p.locality && <div>{p.locality}</div>}
                <div className="text-muted">
                  {regionName[p.region] ?? p.region}, {p.country}
                </div>
              </Td>
              <Td className="whitespace-nowrap">{formatEur(p.price)}{p.currency !== "EUR" ? ` (${p.currency})` : ""}</Td>
              <Td>{p.units ?? "–"}</Td>
              <Td>
                <span className={cn("inline-block h-3 w-3 rounded-full", LIGHT[p.licenseLight])} title={p.licenseLight} />
              </Td>
              <Td>
                <Badge tone={p.availability === "VERFUEGBAR" ? "ok" : p.availability === "RESERVIERT" ? "warn" : "neutral"}>{AVAILABILITY_LABEL[p.availability]}</Badge>
              </Td>
              <Td className="text-xs">
                {p.source}
                {p.partner && <div className={cn("text-muted", !p.partner.agreementAt && "text-warn")}>{p.partner.name}{!p.partner.agreementAt && " (keine Vereinbarung)"}</div>}
              </Td>
              <Td className={cn(p._count.matches > 0 && "font-semibold text-petrol")}>{p._count.matches}</Td>
              <Td className="whitespace-nowrap text-xs text-muted">{p.knownSince.toLocaleDateString("de-DE")}</Td>
            </tr>
          ))}
          {properties.length === 0 && (
            <tr>
              <Td className="py-10 text-center text-muted" {...{ colSpan: 10 }}>
                Keine Objekte gefunden.
              </Td>
            </tr>
          )}
        </tbody>
      </Table>
    </div>
  );
}
