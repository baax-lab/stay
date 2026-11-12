import Link from "next/link";
import { prisma } from "@/lib/db";
import { formatEur } from "@/lib/fees";
import { TRIP_COST_CATEGORIES, TRIP_COST_LABEL, tripTotals, type TripCostCategory } from "@/lib/trips";
import { addTripCostAction, createTripAction, deleteTripAction, deleteTripCostAction, toggleTripBillableAction } from "@/app/(app)/auftraege/reisen-actions";
import { ActionButton, ActionForm } from "@/components/ui/action-form";
import { Card, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/field";

export async function TripsPanel({ mandateId, canEdit, showFees }: { mandateId: string; canEdit: boolean; showFees: boolean }) {
  const [trips, fee, inspections] = await Promise.all([
    prisma.trip.findMany({ where: { mandateId }, orderBy: { startDate: "desc" }, include: { costs: { orderBy: { date: "asc" } }, inspections: { include: { property: { select: { title: true } } } } } }),
    prisma.feeAgreement.findUnique({ where: { mandateId } }),
    prisma.inspection.findMany({ where: { mandateId, tripId: null }, include: { property: { select: { title: true } } }, orderBy: { date: "desc" } }),
  ]);
  const totals = tripTotals(trips, fee?.travelFlat ?? null);
  const d = (x: Date | null) => (x ? x.toLocaleDateString("de-DE") : "");

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
      <div className="space-y-4">
        <Card>
          <CardTitle>Reisekosten je Auftrag</CardTitle>
          <div className="grid grid-cols-2 gap-3 text-center sm:grid-cols-4" data-testid="trip-totals">
            <div className="rounded-xl bg-canvas p-3">
              <div className="text-xl font-semibold text-petrol">{trips.length}</div>
              <div className="text-xs text-muted">Reisen</div>
            </div>
            <div className="rounded-xl bg-canvas p-3">
              <div className="text-xl font-semibold text-petrol">{formatEur(totals.actual)}</div>
              <div className="text-xs text-muted">tatsächliche Kosten</div>
            </div>
            {showFees && (
              <>
                <div className="rounded-xl bg-canvas p-3">
                  <div className="text-xl font-semibold text-petrol">{formatEur(totals.flatTotal)}</div>
                  <div className="text-xs text-muted">
                    Reisepauschale ({totals.billableTrips} × {formatEur(fee?.travelFlat ?? 0)})
                  </div>
                </div>
                <div className="rounded-xl bg-canvas p-3">
                  <div className={`text-xl font-semibold ${totals.difference < 0 ? "text-danger" : "text-ok"}`}>{formatEur(totals.difference)}</div>
                  <div className="text-xs text-muted">Pauschale − Kosten</div>
                </div>
              </>
            )}
          </div>
          {Object.keys(totals.byCategory).length > 0 && (
            <p className="mt-3 text-xs text-muted">
              {Object.entries(totals.byCategory)
                .map(([k, v]) => `${TRIP_COST_LABEL[k as TripCostCategory] ?? k} ${formatEur(v)}`)
                .join(" · ")}
            </p>
          )}
        </Card>

        {trips.map((t) => {
          const sum = t.costs.reduce((s, c) => s + c.amount, 0);
          return (
            <Card key={t.id}>
              <CardTitle
                action={
                  canEdit ? (
                    <span className="flex gap-1">
                      <ActionButton action={toggleTripBillableAction.bind(null, mandateId, t.id)} variant="ghost">
                        {t.billable ? "nicht abrechnen" : "abrechnen"}
                      </ActionButton>
                      <ActionButton action={deleteTripAction.bind(null, mandateId, t.id)} variant="ghost" confirm="Reise mit allen Kosten löschen?">
                        Löschen
                      </ActionButton>
                    </span>
                  ) : undefined
                }
              >
                {t.title} {t.billable ? <Badge tone="ok">abrechenbar</Badge> : <Badge>intern</Badge>}
              </CardTitle>
              <p className="mb-3 text-sm text-muted">
                {d(t.startDate)}
                {t.endDate ? ` – ${d(t.endDate)}` : ""} {t.destination ? `· ${t.destination}` : ""} {t.travelers ? `· ${t.travelers}` : ""}
              </p>
              {t.note && <p className="mb-3 text-sm">{t.note}</p>}
              <table className="w-full text-sm">
                <tbody>
                  {t.costs.map((c) => (
                    <tr key={c.id} className="border-t border-line">
                      <td className="py-1.5">{TRIP_COST_LABEL[c.category as TripCostCategory] ?? c.category}</td>
                      <td className="py-1.5 text-muted">{c.description}</td>
                      <td className="py-1.5 text-xs text-muted">{d(c.date)}</td>
                      <td className="py-1.5 text-xs">
                        {c.receiptFileId && (
                          <a href={`/api/files/${c.receiptFileId}`} target="_blank" className="underline" rel="noreferrer">
                            Beleg
                          </a>
                        )}
                      </td>
                      <td className="py-1.5 text-right">{formatEur(c.amount)}</td>
                      <td className="py-1.5 text-right">
                        {canEdit && (
                          <ActionButton action={deleteTripCostAction.bind(null, mandateId, c.id)} variant="ghost">
                            ×
                          </ActionButton>
                        )}
                      </td>
                    </tr>
                  ))}
                  <tr className="border-t border-line font-semibold text-petrol">
                    <td className="pt-2" colSpan={4}>
                      Summe
                    </td>
                    <td className="pt-2 text-right" data-testid={`trip-sum-${t.id}`}>
                      {formatEur(sum)}
                    </td>
                    <td />
                  </tr>
                </tbody>
              </table>
              {canEdit && (
                <ActionForm action={addTripCostAction.bind(null, mandateId, t.id)} resetOnSuccess className="mt-3 rounded-xl bg-canvas p-3">
                  <div className="grid gap-2 sm:grid-cols-[1fr_1.5fr_110px_130px]">
                    <Field label="Kategorie">
                      <Select name="category" defaultValue="FLUG">
                        {TRIP_COST_CATEGORIES.map((k) => (
                          <option key={k} value={k}>
                            {TRIP_COST_LABEL[k]}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field label="Beschreibung">
                      <Input name="description" />
                    </Field>
                    <Field label="Betrag (€)">
                      <Input name="amount" inputMode="decimal" required />
                    </Field>
                    <Field label="Datum">
                      <Input name="date" type="date" defaultValue={t.startDate.toISOString().slice(0, 10)} />
                    </Field>
                  </div>
                  <div className="flex flex-wrap items-end gap-2">
                    <Field label="Beleg" hint="Foto oder PDF">
                      <Input name="receipt" type="file" accept="image/*,.pdf" capture="environment" />
                    </Field>
                    <Button type="submit" size="sm" variant="secondary">
                      Kosten erfassen
                    </Button>
                  </div>
                </ActionForm>
              )}
              <div className="mt-3 text-sm">
                <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Besichtigungen auf dieser Reise</div>
                <ul className="space-y-1">
                  {t.inspections.map((i) => (
                    <li key={i.id}>
                      <Link href={`/besichtigungen/${i.id}`} className="underline">
                        {i.property.title}
                      </Link>{" "}
                      <span className="text-xs text-muted">
                        {d(i.date)} {i.rating != null ? `· ${i.rating}/5` : ""}
                      </span>
                    </li>
                  ))}
                </ul>
                {canEdit && (
                  <Link href={`/besichtigungen/neu?trip=${t.id}`} className="mt-1 inline-block text-xs text-brand-strong">
                    + Besichtigung auf dieser Reise protokollieren
                  </Link>
                )}
              </div>
            </Card>
          );
        })}

        {inspections.length > 0 && (
          <Card>
            <CardTitle>Besichtigungen ohne Reise</CardTitle>
            <ul className="space-y-1 text-sm">
              {inspections.map((i) => (
                <li key={i.id}>
                  <Link href={`/besichtigungen/${i.id}`} className="underline">
                    {i.property.title}
                  </Link>{" "}
                  <span className="text-xs text-muted">{d(i.date)}</span>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>

      {canEdit && (
        <Card className="h-fit">
          <CardTitle>Neue Reise</CardTitle>
          <ActionForm action={createTripAction.bind(null, mandateId)} resetOnSuccess>
            <Field label="Titel" required>
              <Input name="title" required placeholder="z. B. Besichtigungsreise Mallorca Nord" />
            </Field>
            <Field label="Ziel">
              <Input name="destination" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Beginn" required>
                <Input name="startDate" type="date" required />
              </Field>
              <Field label="Ende">
                <Input name="endDate" type="date" />
              </Field>
            </div>
            <Field label="Teilnehmer">
              <Input name="travelers" />
            </Field>
            <Field label="Notiz">
              <Textarea name="note" rows={2} />
            </Field>
            <Checkbox name="billable" defaultChecked label="Für die Reisepauschale des Käufers abrechenbar" />
            <Button type="submit">Reise anlegen</Button>
          </ActionForm>
        </Card>
      )}
    </div>
  );
}
