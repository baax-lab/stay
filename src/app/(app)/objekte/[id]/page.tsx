import Link from "next/link";
import { notFound } from "next/navigation";
import type { Availability } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { SEGMENT_LABEL } from "@/lib/labels";
import { formatEur } from "@/lib/fees";
import { deriveLicenseLight, LICENSE_LIGHT_LABEL } from "@/lib/license";
import { MANDATE_STATUS_LABEL } from "@/lib/mandates";
import { AVAILABILITY_LABEL, findPropertyDuplicates, type PriceHistoryEntry } from "@/lib/services/properties";
import { rankMandates } from "@/lib/matching";
import { Card, CardTitle, Notice, PageHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ActionButton, ActionForm } from "@/components/ui/action-form";
import { Field, Input, Select } from "@/components/ui/field";
import { PropertyForm } from "@/components/properties/property-form";
import { getCriteria } from "@/lib/services/criteria";
import { MATCH_STATUS_LABEL } from "@/components/mandates/matches-table";
import { deletePropertyAction, deletePropertyFileAction, markDuplicateAction, setAvailabilityAction, uploadPropertyFilesAction, type PropertyFormInput } from "../actions";
import { cn } from "@/lib/cn";
import { FiguresTab } from "@/components/properties/figures-tab";
import { PrecheckPanel } from "@/components/properties/precheck-panel";
import { ENERGY_CLASSES, PROPERTY_CONDITIONS, PROPERTY_CONDITION_LABEL, formatDistance, mapsLink, oneOf } from "@/lib/form-options";

const LIGHT: Record<string, string> = { GRUEN: "bg-ok", GELB: "bg-warn", ROT: "bg-danger", GRAU: "bg-muted" };

export default async function PropertyPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string; neu?: string; m?: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const { tab = "uebersicht", neu, m: mandateParam } = await searchParams;
  const property = await prisma.property.findUnique({
    where: { id },
    include: {
      matches: { include: { mandate: { select: { id: true, title: true, status: true, buyerName: true, contractSignedAt: true, createdAt: true } } }, orderBy: { score: "desc" } },
      presentations: { select: { mandateId: true, askingPrice: true, sentAt: true, channel: true } },
      sellerLead: { select: { id: true, name: true } },
      partner: { select: { id: true, name: true, agreementAt: true } },
      referrer: { select: { id: true, name: true } },
      duplicateOf: { select: { id: true, title: true, knownSince: true } },
      duplicates: { select: { id: true, title: true, knownSince: true } },
      precheck: true,
      inspections: { orderBy: { date: "desc" }, select: { id: true, date: true, status: true, rating: true, recommendation: true, createdByName: true, mandateId: true } },
    },
  });
  if (!property || !property.active) notFound();

  const canEdit = can.editProperty(user.role);
  const [regions, partners, referrers, region, files, duplicates] = await Promise.all([
    prisma.region.findMany({ orderBy: [{ country: "asc" }, { name: "asc" }], select: { key: true, name: true, country: true, focus: true } }),
    prisma.partner.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.referrer.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.region.findUnique({ where: { key: property.region } }),
    prisma.storedFile.findMany({ where: { entity: "Property", entityId: id }, orderBy: { createdAt: "asc" } }),
    findPropertyDuplicates(property, property.id),
  ]);
  const light = deriveLicenseLight(property.licenseStatus, region?.licenseRule);
  const photos = files.filter((f) => f.kind === "PHOTO");
  const docs = files.filter((f) => f.kind !== "PHOTO");
  const history = (property.priceHistory as PriceHistoryEntry[]) ?? [];
  const rankedMandates = rankMandates(property.matches.map((m) => m.mandate));

  const initial: PropertyFormInput = {
    ...property,
    knownSince: property.knownSince.toISOString().slice(0, 10),
    features: property.features as string[],
    condition: oneOf(PROPERTY_CONDITIONS, property.condition),
    energyClass: oneOf(ENERGY_CLASSES, property.energyClass),
  };
  const condition = oneOf(PROPERTY_CONDITIONS, property.condition);
  const map = mapsLink(property);

  const tabs = [
    ["uebersicht", "Übersicht"],
    ["bearbeiten", "Bearbeiten"],
    ["kosten", "Kosten & Rendite"],
    ["vorpruefung", "Vorprüfung"],
    ["besichtigungen", `Besichtigungen (${property.inspections.length})`],
    ["treffer", `Treffer (${property.matches.length})`],
    ["dateien", `Fotos & Unterlagen (${files.length})`],
  ] as const;

  return (
    <div>
      <Link href="/objekte" className="text-sm text-muted hover:text-petrol">
        ← Objekte
      </Link>
      <PageHeader
        title={property.title}
        subtitle={`${SEGMENT_LABEL[property.segment]} · ${[property.locality, region?.name ?? property.region, property.country].filter(Boolean).join(", ")} · ${formatEur(property.price)}${property.currency !== "EUR" ? ` ${property.currency}` : ""}`}
        action={
          <div className="flex items-center gap-2">
            <span className={cn("inline-block h-3.5 w-3.5 rounded-full", LIGHT[property.licenseLight])} title={light.reason} />
            <Badge tone={property.availability === "VERFUEGBAR" ? "ok" : property.availability === "RESERVIERT" ? "warn" : "neutral"}>{AVAILABILITY_LABEL[property.availability]}</Badge>
            {property.offmarket && <Badge tone="brand">Off-Market</Badge>}
          </div>
        }
      />

      {neu && <div className="mb-4"><Notice tone="ok">Objekt angelegt. Fotos und Unterlagen können jetzt hochgeladen werden.</Notice></div>}
      {property.partner && !property.partner.agreementAt && (
        <div className="mb-4">
          <Notice tone="warn">Objekt kommt von Partner {property.partner.name} ohne Partnervereinbarung. Provisionsteilung vor Vorstellung klären.</Notice>
        </div>
      )}
      {(property.duplicateOf || duplicates.length > 0) && (
        <div className="mb-4">
          <Notice tone="warn">
            <div className="font-medium">Möglicherweise dasselbe Objekt aus anderer Quelle:</div>
            <ul className="mt-1 space-y-1 text-sm">
              {property.duplicateOf && (
                <li>
                  <Link href={`/objekte/${property.duplicateOf.id}`} className="underline">{property.duplicateOf.title}</Link> (bekannt seit {property.duplicateOf.knownSince.toLocaleDateString("de-DE")}, markiert als Original)
                  {canEdit && <> · <ActionButton action={markDuplicateAction.bind(null, property.id, null)} variant="ghost">Markierung entfernen</ActionButton></>}
                </li>
              )}
              {duplicates.filter((d) => d.id !== property.duplicateOfId).map((d) => (
                <li key={d.id} className="flex flex-wrap items-center gap-2">
                  <Link href={`/objekte/${d.id}`} className="underline">{d.title}</Link>
                  <span className="text-xs">bekannt seit {d.knownSince.toLocaleDateString("de-DE")} · {d.source} {d.sourceDetail ?? ""}</span>
                  {d.knownSince < property.knownSince ? <Badge tone="warn">frühere Quelle</Badge> : <Badge>spätere Quelle</Badge>}
                  {canEdit && d.knownSince < property.knownSince && (
                    <ActionButton action={markDuplicateAction.bind(null, property.id, d.id)} variant="secondary">Dieses Objekt als Dublette markieren</ActionButton>
                  )}
                </li>
              ))}
            </ul>
            <p className="mt-1 text-xs">Maßgeblich ist die früheste Quelle (bekannt seit).</p>
          </Notice>
        </div>
      )}

      <nav className="mb-4 flex gap-1 overflow-x-auto">
        {tabs.map(([k, label]) => (
          <Link key={k} href={`/objekte/${id}?tab=${k}`} className={cn("whitespace-nowrap rounded-md px-3.5 py-1.5 text-sm font-medium", tab === k ? "bg-brand text-on-brand" : "border border-line bg-surface text-ink hover:border-brand")}>
            {label}
          </Link>
        ))}
      </nav>

      {tab === "uebersicht" && (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardTitle>Eckdaten</CardTitle>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
              <Dt>Preis</Dt><Dd>{formatEur(property.price)}</Dd>
              <Dt>{property.segment === "PENSION_HOTEL" ? "Zimmer" : "Einheiten"}</Dt><Dd>{property.units ?? "–"}</Dd>
              <Dt>Wohnfläche</Dt><Dd>{property.livingArea ? `${property.livingArea} m²` : "–"}</Dd>
              <Dt>Auslastung</Dt><Dd>{property.occupancyPct != null ? `${property.occupancyPct} %` : "–"}</Dd>
              <Dt>Ø Tagespreis</Dt><Dd>{property.adr ? formatEur(property.adr) : "–"}</Dd>
              <Dt>Jahresumsatz</Dt><Dd>{property.revenueYear ? formatEur(property.revenueYear) : "–"}</Dd>
              {property.yearBuilt != null && (<><Dt>Baujahr</Dt><Dd>{property.yearBuilt}</Dd></>)}
              {condition && (<><Dt>Zustand</Dt><Dd>{PROPERTY_CONDITION_LABEL[condition]}</Dd></>)}
              {(property.bedrooms != null || property.bathrooms != null) && (<><Dt>Schlafzimmer / Bäder</Dt><Dd>{property.bedrooms ?? "–"} / {property.bathrooms ?? "–"}</Dd></>)}
              {property.plotArea != null && (<><Dt>Grundstück</Dt><Dd>{property.plotArea.toLocaleString("de-DE")} m²</Dd></>)}
              {property.distanceBeachM != null && (<><Dt>Zum Strand</Dt><Dd>{formatDistance(property.distanceBeachM)}</Dd></>)}
              {property.distanceSkiM != null && (<><Dt>Zur Piste / zum Lift</Dt><Dd>{formatDistance(property.distanceSkiM)}</Dd></>)}
              {property.distanceAirportKm != null && (<><Dt>Zum Flughafen</Dt><Dd>{property.distanceAirportKm} km</Dd></>)}
              {property.energyClass && (<><Dt>Energieklasse</Dt><Dd>{property.energyClass}</Dd></>)}
              <Dt>Quelle</Dt><Dd>{property.source}{property.sourceDetail ? ` · ${property.sourceDetail}` : ""}</Dd>
              <Dt>Partner</Dt><Dd>{property.partner ? <Link href={`/partner/${property.partner.id}`} className="underline">{property.partner.name}</Link> : "–"}</Dd>
              <Dt>Tippgeber</Dt><Dd>{property.referrer ? <Link href={`/tippgeber/${property.referrer.id}`} className="underline">{property.referrer.name}</Link> : "–"}</Dd>
              <Dt>Verkäuferkontakt</Dt><Dd>{property.sellerLead ? <Link href={`/leads/${property.sellerLead.id}`} className="underline">{property.sellerLead.name}</Link> : "–"}</Dd>
              <Dt>Adresse (intern)</Dt><Dd>{property.address ?? "–"}{map && <> · <a href={map} target="_blank" rel="noopener noreferrer" className="text-brand-strong underline">Karte</a></>}</Dd>
              <Dt>Bekannt seit</Dt><Dd>{property.knownSince.toLocaleDateString("de-DE")}{property.knownSourceNote ? ` · ${property.knownSourceNote}` : ""}</Dd>
            </dl>
            {property.description && <p className="mt-4 whitespace-pre-wrap text-sm">{property.description}</p>}
            {(property.features as string[]).length > 0 && (
              <div className="mt-4 flex flex-wrap gap-1.5">
                {(property.features as string[]).map((f) => (
                  <Badge key={f}>{f.replace(/_/g, " ")}</Badge>
                ))}
              </div>
            )}
          </Card>

          <div className="space-y-4">
            <Card>
              <CardTitle>Genehmigungsampel</CardTitle>
              <div className="flex items-center gap-3">
                <span className={cn("inline-block h-5 w-5 rounded-full", LIGHT[light.light])} />
                <div>
                  <div className="font-medium text-petrol">{LICENSE_LIGHT_LABEL[light.light]}</div>
                  <div className="text-sm text-muted">{light.reason}</div>
                </div>
              </div>
              {property.licenseNote && <p className="mt-2 text-sm">{property.licenseNote}</p>}
              {region?.licenseRule && <p className="mt-2 text-xs text-muted">Regionsregel: {region.licenseRule}</p>}
            </Card>

            <Card>
              <CardTitle>Verfügbarkeit</CardTitle>
              {canEdit ? (
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(AVAILABILITY_LABEL) as Availability[]).map((a) => (
                    <ActionButton key={a} action={setAvailabilityAction.bind(null, property.id, a)} variant={property.availability === a ? "primary" : "secondary"} confirm={a === "VERKAUFT" || a === "ZURUECKGEZOGEN" ? "Offene Treffer werden geschlossen. Fortfahren?" : undefined}>
                      {AVAILABILITY_LABEL[a]}
                    </ActionButton>
                  ))}
                </div>
              ) : (
                <p className="text-sm">{AVAILABILITY_LABEL[property.availability]}</p>
              )}
            </Card>

            <Card>
              <CardTitle>Preisverlauf</CardTitle>
              <ul className="space-y-1 text-sm">
                {history.map((h, i) => (
                  <li key={i} className="flex justify-between">
                    <span className="text-muted">{new Date(h.at).toLocaleDateString("de-DE")}{h.note ? ` · ${h.note}` : ""}</span>
                    <span>{formatEur(h.price)}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-muted">Der für den Bonus maßgebliche Angebotspreis wird bei der Vorstellung eingefroren.</p>
            </Card>
          </div>
        </div>
      )}

      {tab === "kosten" && (
        <FiguresTab
          property={property}
          mandateId={mandateParam && property.matches.some((x) => x.mandateId === mandateParam) ? mandateParam : null}
          mandates={property.matches.map((x) => ({ id: x.mandate.id, title: x.mandate.title }))}
          canEdit={canEdit}
        />
      )}

      {tab === "vorpruefung" && <PrecheckPanel propertyId={property.id} precheck={property.precheck} canEdit={canEdit} segmentCountry={`${SEGMENT_LABEL[property.segment]}, ${property.country}`} />}

      {tab === "besichtigungen" && (
        <Card>
          <CardTitle
            action={
              canEdit ? (
                <Link href={`/besichtigungen/neu?property=${property.id}`} className="inline-flex h-9 items-center rounded-md bg-brand px-3.5 text-sm font-medium text-on-brand">
                  Besichtigung protokollieren
                </Link>
              ) : undefined
            }
          >
            Besichtigungen
          </CardTitle>
          <ul className="space-y-2 text-sm">
            {property.inspections.map((i) => (
              <li key={i.id}>
                <Link href={`/besichtigungen/${i.id}`} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line px-4 py-2 hover:border-brand">
                  <span>
                    {i.date.toLocaleDateString("de-DE")} · {i.createdByName ?? ""}
                  </span>
                  <span className="flex items-center gap-2">
                    {i.rating != null && <span className="font-semibold text-petrol">{i.rating} / 5</span>}
                    {i.recommendation && <Badge tone={i.recommendation === "EMPFEHLEN" ? "ok" : i.recommendation === "BEDINGT" ? "warn" : "danger"}>{i.recommendation === "EMPFEHLEN" ? "empfehlen" : i.recommendation === "BEDINGT" ? "bedingt" : "nicht empfehlen"}</Badge>}
                    <Badge tone={i.status === "ABGESCHLOSSEN" ? "ok" : "warn"}>{i.status === "ABGESCHLOSSEN" ? "abgeschlossen" : "Entwurf"}</Badge>
                  </span>
                </Link>
              </li>
            ))}
            {property.inspections.length === 0 && <li className="text-muted">Noch keine Besichtigung protokolliert.</li>}
          </ul>
        </Card>
      )}

      {tab === "bearbeiten" && (
        <Card>
          <PropertyForm criteria={await getCriteria()} id={property.id} initial={initial} regions={regions} partners={partners} referrers={referrers} sellerLead={property.sellerLead} isAdmin={user.role === "ADMIN"} canEdit={canEdit} />
          {canEdit && (
            <form action={deletePropertyAction.bind(null, property.id)} className="mt-6 border-t border-line pt-4">
              <Button type="submit" variant="danger" size="sm">
                Objekt deaktivieren
              </Button>
            </form>
          )}
        </Card>
      )}

      {tab === "treffer" && (
        <Card>
          <CardTitle>Passende Suchaufträge</CardTitle>
          <p className="mb-3 text-xs text-muted">Reihenfolge nach Beauftragungsdatum (Vorrang). Vorstellung an einen zweiten Käufer nur nach Freigabe durch die Leitung.</p>
          <ul className="space-y-2">
            {rankedMandates.map((mandate, i) => {
              const m = property.matches.find((x) => x.mandateId === mandate.id)!;
              const pres = property.presentations.find((p) => p.mandateId === mandate.id);
              return (
                <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line px-4 py-3 text-sm">
                  <div>
                    <span className="mr-2 text-xs font-semibold text-muted">#{i + 1}</span>
                    <Link href={`/auftraege/${mandate.id}?tab=treffer`} className="font-medium text-petrol hover:underline">
                      {mandate.title}
                    </Link>
                    <span className="text-muted"> · {mandate.buyerName} · {MANDATE_STATUS_LABEL[mandate.status]}</span>
                    {pres && <div className="text-xs text-ok">vorgestellt {pres.sentAt.toLocaleDateString("de-DE")} zu {formatEur(pres.askingPrice)}</div>}
                  </div>
                  <div className="flex items-center gap-2">
                    {m.nearMiss && <Badge tone="warn">knapp daneben</Badge>}
                    <Badge tone={m.status === "AN_KAEUFER" ? "ok" : m.status === "ABGELEHNT" || m.status === "GESCHLOSSEN" ? "neutral" : "brand"}>{MATCH_STATUS_LABEL[m.status]}</Badge>
                    <span className="text-lg font-semibold text-petrol">{m.score}</span>
                  </div>
                </li>
              );
            })}
            {property.matches.length === 0 && <li className="text-sm text-muted">Keine passenden Suchaufträge.</li>}
          </ul>
        </Card>
      )}

      {tab === "dateien" && (
        <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
          <div className="space-y-4">
            <Card>
              <CardTitle>Fotos</CardTitle>
              {photos.length === 0 && <p className="text-sm text-muted">Noch keine Fotos.</p>}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                {photos.map((f) => (
                  <figure key={f.id} className="group relative overflow-hidden rounded-xl border border-line">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`/api/files/${f.id}`} alt={f.fileName} className="aspect-[4/3] w-full object-cover" loading="lazy" />
                    {canEdit && (
                      <div className="absolute right-1 top-1 opacity-0 group-hover:opacity-100">
                        <ActionButton action={deletePropertyFileAction.bind(null, property.id, f.id)} variant="danger" confirm="Foto löschen?">×</ActionButton>
                      </div>
                    )}
                  </figure>
                ))}
              </div>
            </Card>
            <Card>
              <CardTitle>Unterlagen</CardTitle>
              <ul className="space-y-1 text-sm">
                {docs.length === 0 && <li className="text-muted">Keine Unterlagen.</li>}
                {docs.map((f) => (
                  <li key={f.id} className="flex items-center justify-between gap-2 rounded-lg px-2 py-1 hover:bg-canvas">
                    <a href={`/api/files/${f.id}`} target="_blank" rel="noreferrer" className="text-petrol underline">{f.fileName}</a>
                    <span className="flex items-center gap-2 text-xs text-muted">
                      {Math.round(f.size / 1024)} KB
                      {canEdit && <ActionButton action={deletePropertyFileAction.bind(null, property.id, f.id)} variant="ghost" confirm="Datei löschen?">Löschen</ActionButton>}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
          {can.createProperty(user.role) && (
            <ActionForm action={uploadPropertyFilesAction.bind(null, property.id)} resetOnSuccess className="h-fit rounded-2xl border border-line bg-surface p-4">
              <div className="font-semibold text-petrol">Hochladen</div>
              <Field label="Art">
                <Select name="kind" defaultValue="PHOTO">
                  <option value="PHOTO">Fotos</option>
                  <option value="DOCUMENT">Unterlagen</option>
                </Select>
              </Field>
              <Field label="Dateien" hint="mehrere möglich, je max. 25 MB">
                <Input type="file" name="files" multiple required accept=".jpg,.jpeg,.png,.webp,.heic,.pdf,.doc,.docx,.xls,.xlsx" />
              </Field>
              <Button type="submit">Hochladen</Button>
            </ActionForm>
          )}
        </div>
      )}
    </div>
  );
}

function Dt({ children }: { children: React.ReactNode }) {
  return <dt className="text-muted">{children}</dt>;
}
function Dd({ children }: { children: React.ReactNode }) {
  return <dd className="text-ink">{children}</dd>;
}
