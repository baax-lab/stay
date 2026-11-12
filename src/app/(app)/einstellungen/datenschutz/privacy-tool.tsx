"use client";

import { useActionState } from "react";
import Link from "next/link";
import { privacyAction, type PrivacyState } from "./actions";
import { ERASURE_ACTION_LABEL, type ErasureAction } from "@/lib/privacy";
import { Card, CardTitle, Notice } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";

const TONE: Record<ErasureAction, "danger" | "warn" | "neutral" | "ok"> = { DELETE: "danger", ANONYMIZE: "warn", RETAIN: "neutral", BLOCKED: "neutral" };
const ENTITY_LABEL = { Lead: "Lead", Mandate: "Suchauftrag", Referrer: "Tippgeber", Partner: "Partner" } as const;
const HREF = { Lead: "/leads/", Mandate: "/auftraege/", Referrer: "/tippgeber/", Partner: "/partner/" } as const;

export function PrivacyTool() {
  const [state, action, pending] = useActionState<PrivacyState, FormData>(privacyAction, { status: "idle" });
  const q = state.status === "found" || state.status === "erased" ? state.q : "";

  return (
    <div className="space-y-4">
      <Card>
        <CardTitle>Person suchen</CardTitle>
        <form action={action} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <Field label="E-Mail, Telefon, Name oder Hub-Kontakt-ID" className="flex-1">
            <Input name="q" required minLength={3} defaultValue={q} autoComplete="off" />
          </Field>
          <Button type="submit" disabled={pending}>
            {pending ? "Bitte warten …" : "Suchen"}
          </Button>
        </form>
        {state.status === "error" && (
          <div className="mt-3">
            <Notice tone="danger">{state.error}</Notice>
          </div>
        )}
      </Card>

      {state.status === "erased" && (
        <Card>
          <CardTitle>Erledigt und protokolliert</CardTitle>
          <ul className="space-y-1 text-sm">
            <li>Gelöscht: {state.result.deleted}</li>
            <li>Anonymisiert: {state.result.anonymized}</li>
            <li>Wegen Aufbewahrungspflicht behalten: {state.result.retained}</li>
            <li>Nicht möglich (laufender Auftrag): {state.result.blocked}</li>
          </ul>
          {state.result.hubContactIds.length > 0 && (
            <div className="mt-3">
              <Notice tone="warn">
                Kontakt auch im Baax Hub löschen bzw. sperren: {state.result.hubContactIds.join(", ")}
              </Notice>
            </div>
          )}
          {state.plan.some((i) => i.action === "RETAIN") && (
            <p className="mt-3 text-sm text-muted">
              Behaltene Datensätze nur noch für die Aufbewahrungspflicht nutzen und nach Fristende erneut löschen:{" "}
              {state.plan
                .filter((i) => i.retainUntil)
                .map((i) => `${ENTITY_LABEL[i.entity]} bis ${new Date(i.retainUntil!).toLocaleDateString("de-DE")}`)
                .join(", ")}
              .
            </p>
          )}
        </Card>
      )}

      {state.status === "found" && (
        <>
          <Card>
            <CardTitle>Gefunden: {state.plan.length} Datensätze</CardTitle>
            {state.plan.length === 0 ? (
              <p className="text-sm text-muted">Zu diesem Suchbegriff sind in Baax Stay keine Daten gespeichert. Für die Auskunft trotzdem exportieren (leere Auskunft) und im Hub prüfen.</p>
            ) : (
              <ul className="divide-y divide-line text-sm">
                {state.plan.map((i) => (
                  <li key={`${i.entity}:${i.id}`} className="flex flex-col gap-1 py-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <span className="text-xs text-muted">{ENTITY_LABEL[i.entity]} · </span>
                      <Link href={HREF[i.entity] + i.id} className="font-medium text-petrol underline" target="_blank">
                        {i.label}
                      </Link>
                      <div className="text-xs text-muted">
                        {i.reason}
                        {i.retainUntil && ` Aufbewahren bis ${new Date(i.retainUntil).toLocaleDateString("de-DE")}.`}
                      </div>
                    </div>
                    <Badge tone={TONE[i.action]}>{ERASURE_ACTION_LABEL[i.action]}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardTitle>Auskunft (Art. 15 DSGVO)</CardTitle>
            <p className="mb-3 text-sm text-muted">JSON-Datei mit allen Daten zu den gefundenen Datensätzen, inklusive Verlauf und Protokoll. Der Export wird protokolliert.</p>
            <form method="post" action="/einstellungen/datenschutz/auskunft">
              <input type="hidden" name="q" value={state.q} />
              <Button type="submit" variant="secondary">
                Auskunft herunterladen
              </Button>
            </form>
          </Card>

          {state.plan.some((i) => i.action === "DELETE" || i.action === "ANONYMIZE") && (
            <Card>
              <CardTitle>Löschung (Art. 17 DSGVO)</CardTitle>
              <p className="mb-3 text-sm text-muted">
                Löscht bzw. anonymisiert die markierten Datensätze endgültig (auch Dokumente und Portal-Links). Datensätze mit Aufbewahrungspflicht oder laufendem Auftrag bleiben unverändert. Nicht gemeinte Treffer (z. B. Namensgleichheit) vorher abwählen.
              </p>
              <form action={action} className="space-y-3">
                <input type="hidden" name="intent" value="erase" />
                <input type="hidden" name="q" value={state.q} />
                <fieldset className="space-y-1 text-sm">
                  {state.plan
                    .filter((i) => i.action === "DELETE" || i.action === "ANONYMIZE")
                    .map((i) => (
                      <label key={`${i.entity}:${i.id}`} className="flex items-center gap-2">
                        <input type="checkbox" defaultChecked onChange={(e) => toggleExclude(e.currentTarget, `${i.entity}:${i.id}`)} />
                        {ENTITY_LABEL[i.entity]}: {i.label} ({ERASURE_ACTION_LABEL[i.action]})
                      </label>
                    ))}
                </fieldset>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                  <Field label="Zur Bestätigung LÖSCHEN eingeben" className="sm:w-64">
                    <Input name="confirm" autoComplete="off" />
                  </Field>
                  <Button type="submit" variant="danger" disabled={pending}>
                    {pending ? "Bitte warten …" : "Endgültig löschen"}
                  </Button>
                </div>
                {state.eraseError && <Notice tone="danger">{state.eraseError}</Notice>}
              </form>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

/** Abgewählte Treffer als versteckte exclude-Felder ins Formular schreiben. */
function toggleExclude(box: HTMLInputElement, key: string) {
  const form = box.form;
  if (!form) return;
  const existing = form.querySelector<HTMLInputElement>(`input[name="exclude"][value="${CSS.escape(key)}"]`);
  if (box.checked) existing?.remove();
  else if (!existing) {
    const hidden = document.createElement("input");
    hidden.type = "hidden";
    hidden.name = "exclude";
    hidden.value = key;
    form.appendChild(hidden);
  }
}
