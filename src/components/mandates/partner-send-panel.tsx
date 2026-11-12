import type { PartnerSend } from "@prisma/client";
import { prisma } from "@/lib/db";
import { sendProfileToPartnersAction, markPartnerReplyAction } from "@/app/(app)/auftraege/partner-actions";
import { ActionForm } from "@/components/ui/action-form";
import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import { Card, Notice } from "@/components/ui/card";
import { env } from "@/lib/env";

type SendRow = PartnerSend & { partner: { id: string; name: string; company: string | null } };

export async function PartnerSendPanel({ mandateId, sends, countries, regions, canSend }: { mandateId: string; sends: SendRow[]; countries: string[]; regions: string[]; canSend: boolean }) {
  const partners = await prisma.partner.findMany({
    where: { active: true, ...(countries.length ? { country: { in: countries } } : {}) },
    orderBy: [{ country: "asc" }, { name: "asc" }],
  });
  const fitting = partners.filter((p) => regions.length === 0 || p.regions.length === 0 || p.regions.some((r) => regions.includes(r)));
  const mailOk = env.mailConfigured;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      <Card>
        <h2 className="mb-3 font-semibold text-petrol">Versendet</h2>
        {sends.length === 0 && <p className="text-sm text-muted">Noch kein Versand.</p>}
        <ul className="space-y-2">
          {sends.map((s) => (
            <li key={s.id} className="rounded-xl border border-line px-4 py-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="font-medium text-petrol">{s.partner.name}</span>
                  {s.partner.company && <span className="text-muted"> · {s.partner.company}</span>}
                  <div className="text-xs text-muted">
                    {s.sentAt.toLocaleString("de-DE", { dateStyle: "medium", timeStyle: "short" })} · {s.language.toUpperCase()} · {s.subject}
                  </div>
                </div>
                {s.repliedAt ? <Badge tone="ok">Rückmeldung {s.repliedAt.toLocaleDateString("de-DE")}</Badge> : <Badge tone="warn">keine Rückmeldung</Badge>}
              </div>
              {s.replyNote && <div className="mt-1 text-xs">{s.replyNote}</div>}
              {!s.repliedAt && canSend && (
                <ActionForm action={markPartnerReplyAction.bind(null, mandateId, s.id)} className="mt-2 flex flex-wrap items-end gap-2">
                  <input name="replyNote" placeholder="Rückmeldung kurz notieren" className="flex-1 rounded-lg border border-line px-2 py-1 text-sm" />
                  <Button type="submit" size="sm" variant="secondary">
                    Rückmeldung erhalten
                  </Button>
                </ActionForm>
              )}
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <h2 className="mb-3 font-semibold text-petrol">An Partner senden</h2>
        <p className="mb-3 text-xs text-muted">Anonymisiertes Suchprofil ohne Name und Kontaktdaten des Käufers, als Text und PDF, in der Sprache des Partners. Jeder Versand wird im Verlauf protokolliert.</p>
        {!mailOk && <Notice tone="warn">SMTP ist nicht konfiguriert. Der Versand wird vorbereitet und protokolliert, die Mail aber nicht gesendet.</Notice>}
        {canSend ? (
          <ActionForm action={sendProfileToPartnersAction.bind(null, mandateId)} className="mt-3">
            <div className="max-h-72 space-y-1 overflow-y-auto rounded-xl border border-line p-2">
              {fitting.length === 0 && <p className="p-2 text-sm text-muted">Keine passenden Partner für Land/Region. Partner unter „Partner“ anlegen.</p>}
              {fitting.map((p) => (
                <label key={p.id} className="flex items-start gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-canvas">
                  <input type="checkbox" name="partnerIds" value={p.id} className="mt-1 h-4 w-4 accent-brand-strong" disabled={!p.email} />
                  <span>
                    <span className="font-medium text-petrol">{p.name}</span>
                    {p.company && <span className="text-muted"> · {p.company}</span>}
                    <span className="block text-xs text-muted">
                      {p.country} {p.regions.join(", ")} · {p.language.toUpperCase()} · {p.email ?? "keine E-Mail"}
                      {!p.agreementAt && <span className="text-warn"> · keine Partnervereinbarung</span>}
                    </span>
                  </span>
                </label>
              ))}
            </div>
            <Field label="Persönliche Anmerkung (optional)">
              <Textarea name="intro" rows={2} />
            </Field>
            <Button type="submit">Suchprofil senden</Button>
          </ActionForm>
        ) : (
          <p className="text-sm text-muted">Versand ab Rolle Mitarbeiter.</p>
        )}
      </Card>
    </div>
  );
}
