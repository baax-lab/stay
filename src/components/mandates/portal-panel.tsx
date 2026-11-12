import type { Mandate } from "@prisma/client";
import { prisma } from "@/lib/db";
import { accessState } from "@/lib/portal";
import { discardNotificationAction, extendAccessAction, revokeAccessAction, savePortalSettingsAction, sendNotificationAction } from "@/app/(app)/auftraege/kunden-actions";
import { ActionButton, ActionForm } from "@/components/ui/action-form";
import { Card, CardTitle, Notice } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { PortalLinkButtons } from "./portal-link-buttons";

const KIND_LABEL = { OBJEKT: "Neue Objekte", BERICHT: "Bericht", STATUS: "Statuswechsel", SONSTIGES: "Sonstiges" } as const;

export async function PortalPanel({ mandate, canEdit, canSend }: { mandate: Mandate; canEdit: boolean; canSend: boolean }) {
  const [accesses, notifications, log] = await Promise.all([
    prisma.portalAccess.findMany({ where: { mandateId: mandate.id }, orderBy: { createdAt: "desc" }, take: 20 }),
    prisma.buyerNotification.findMany({ where: { mandateId: mandate.id }, orderBy: { createdAt: "desc" }, take: 30 }),
    prisma.auditLog.findMany({ where: { entity: "Mandate", entityId: mandate.id, action: { in: ["PORTAL_VIEW", "PORTAL_ACTION", "PORTAL_DENIED"] } }, orderBy: { createdAt: "desc" }, take: 25 }),
  ]);
  const drafts = notifications.filter((n) => n.status === "ENTWURF");
  const history = notifications.filter((n) => n.status !== "ENTWURF");
  const d = (x: Date | null) => (x ? x.toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" }) : "–");

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="space-y-4">
        <Card>
          <CardTitle>Zugang zum Käuferportal</CardTitle>
          <p className="mb-3 text-sm text-muted">Persönlicher Magic Link ohne Passwort, 30 Tage gültig, verlängerbar und widerrufbar. Jede Benachrichtigung enthält einen frischen Link.</p>
          {canSend ? <PortalLinkButtons mandateId={mandate.id} hasEmail={Boolean(mandate.buyerEmail)} /> : <p className="text-sm text-muted">Linkversand ab Rolle Mitarbeiter.</p>}
          <ul className="mt-4 space-y-2">
            {accesses.map((a) => {
              const st = accessState(a);
              return (
                <li key={a.id} className="rounded-xl border border-line px-3 py-2 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <Badge tone={st === "valid" ? "ok" : st === "revoked" ? "danger" : "neutral"}>{st === "valid" ? "gültig" : st === "revoked" ? "widerrufen" : "abgelaufen"}</Badge>{" "}
                      <span className="text-xs text-muted">
                        erstellt {d(a.createdAt)} · bis {a.expiresAt.toLocaleDateString("de-DE")} · {a.viewCount} Aufrufe · zuletzt {d(a.lastSeenAt)}
                        {a.sentTo ? ` · an ${a.sentTo}` : ""}
                      </span>
                    </div>
                    {canSend && (
                      <div className="flex gap-1">
                        <ActionButton action={extendAccessAction.bind(null, mandate.id, a.id)} variant="ghost">
                          Verlängern
                        </ActionButton>
                        {st !== "revoked" && (
                          <ActionButton action={revokeAccessAction.bind(null, mandate.id, a.id)} variant="ghost" confirm="Link widerrufen? Der Käufer sieht dann eine Hinweisseite.">
                            Widerrufen
                          </ActionButton>
                        )}
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
            {accesses.length === 0 && <li className="text-sm text-muted">Noch kein Link erstellt.</li>}
          </ul>
        </Card>

        <Card>
          <CardTitle>Anzeige im Portal</CardTitle>
          <ActionForm action={savePortalSettingsAction.bind(null, mandate.id)}>
            <Field label="Sprache des Käufers (Portal, Dossier, Mails)">
              <Select name="buyerLang" defaultValue={mandate.buyerLang} disabled={!canEdit}>
                <option value="de">Deutsch</option>
                <option value="en">Englisch</option>
              </Select>
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Ansprechpartner">
                <Input name="ownerName" defaultValue={mandate.ownerName ?? ""} disabled={!canEdit} />
              </Field>
              <Field label="Telefon">
                <Input name="ownerPhone" defaultValue={mandate.ownerPhone ?? ""} disabled={!canEdit} />
              </Field>
              <Field label="E-Mail">
                <Input name="ownerEmail" type="email" defaultValue={mandate.ownerEmail ?? ""} disabled={!canEdit} />
              </Field>
              <Field label="Foto" hint={mandate.ownerPhotoFileId ? "vorhanden, neu hochladen ersetzt" : "optional"}>
                <Input name="photo" type="file" accept="image/*" disabled={!canEdit} />
              </Field>
            </div>
            <Field label="Nächste Schritte (Text im Portal)" hint="leer = Standardtext zum Status">
              <Textarea name="portalNextSteps" rows={3} defaultValue={mandate.portalNextSteps ?? ""} disabled={!canEdit} />
            </Field>
            {canEdit && <Button type="submit">Speichern</Button>}
          </ActionForm>
        </Card>
      </div>

      <div className="space-y-4">
        <Card>
          <CardTitle>Benachrichtigungen an den Käufer</CardTitle>
          <p className="mb-3 text-sm text-muted">Entstehen automatisch als Entwurf (neues freigegebenes Objekt, Bericht, Statuswechsel). Versand nur nach Sichtung.</p>
          {drafts.length === 0 && <Notice tone="neutral">Keine offenen Entwürfe.</Notice>}
          <div className="space-y-3">
            {drafts.map((n) => (
              <div key={n.id} className="rounded-xl border border-warn/40 bg-warn-soft/30 p-3" data-testid="notification-draft">
                <div className="mb-2 flex items-center justify-between">
                  <Badge tone="warn">Entwurf · {KIND_LABEL[n.kind]}</Badge>
                  <span className="text-xs text-muted">{d(n.updatedAt)}</span>
                </div>
                <ActionForm action={sendNotificationAction.bind(null, mandate.id, n.id)}>
                  <Field label="Betreff">
                    <Input name="subject" defaultValue={n.subject} disabled={!canSend} />
                  </Field>
                  <Field label="Text" hint="Portal-Link und Gruß werden beim Versand angefügt">
                    <Textarea name="body" rows={5} defaultValue={n.body} disabled={!canSend} />
                  </Field>
                  {canSend && (
                    <div className="flex flex-wrap gap-2">
                      <Button type="submit" size="sm">
                        Gesehen, senden
                      </Button>
                    </div>
                  )}
                </ActionForm>
                {canEdit && (
                  <div className="mt-2">
                    <ActionButton action={discardNotificationAction.bind(null, mandate.id, n.id)} variant="ghost">
                      Verwerfen
                    </ActionButton>
                  </div>
                )}
              </div>
            ))}
          </div>
          {history.length > 0 && (
            <details className="mt-4">
              <summary className="cursor-pointer text-sm text-petrol">Verlauf ({history.length})</summary>
              <ul className="mt-2 space-y-1 text-xs">
                {history.map((n) => (
                  <li key={n.id}>
                    {n.status === "GESENDET" ? `gesendet ${d(n.sentAt)} an ${n.sentTo}` : `verworfen ${d(n.updatedAt)}`} · {KIND_LABEL[n.kind]} · {n.subject}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </Card>

        <Card>
          <CardTitle>Portal-Zugriffe</CardTitle>
          <ul className="space-y-1 text-xs" data-testid="portal-log">
            {log.map((l) => {
              const meta = l.meta as Record<string, unknown>;
              return (
                <li key={l.id} className="flex justify-between gap-2">
                  <span>
                    {l.action === "PORTAL_VIEW" ? "Aufruf" : l.action === "PORTAL_ACTION" ? `Aktion ${String(meta.action ?? "")}` : `abgewiesen (${String(meta.reason ?? "")})`} · {String(meta.page ?? meta.propertyId ?? "")}
                  </span>
                  <span className="shrink-0 text-muted">{d(l.createdAt)}</span>
                </li>
              );
            })}
            {log.length === 0 && <li className="text-muted">Noch keine Zugriffe.</li>}
          </ul>
        </Card>
      </div>
    </div>
  );
}
