"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import type { MatchStatus } from "@prisma/client";
import { matchStatusAction, setViewingAction } from "@/app/(app)/auftraege/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { ActionForm } from "@/components/ui/action-form";
import { cn } from "@/lib/cn";

export type MatchRow = {
  id: string;
  score: number;
  nearMiss: boolean;
  status: MatchStatus;
  rejectReason: string | null;
  reasons: { passt: string[]; fehlt: string[]; knapp: string[] };
  viewingAt: string | null;
  viewingNote: string | null;
  rank: { rank: number; total: number; firstTitle?: string };
  priorKnowledge: boolean;
  presentation: { channel: string; askingPrice: number; sentAt: string; viewedAt: string | null } | null;
  buyer: { action: string | null; category: string | null; text: string | null; at: string | null };
  property: { id: string; title: string; locality: string | null; region: string; country: string; price: number; segment: string; licenseLight: string; availability: string; knownSince: string };
};

export const MATCH_STATUS_LABEL: Record<MatchStatus, string> = {
  NEU: "Neu",
  GEPRUEFT: "Geprüft",
  AN_KAEUFER: "An Käufer",
  ABGELEHNT: "Abgelehnt",
  GEMERKT: "Gemerkt",
  GESCHLOSSEN: "Geschlossen",
};

const LIGHT: Record<string, string> = { GRUEN: "bg-ok", GELB: "bg-warn", ROT: "bg-danger", GRAU: "bg-muted" };

const REJECT_REASONS = ["Preis zu hoch", "Lizenz unklar oder fehlt", "Lage passt nicht", "Zustand", "Zahlen nicht plausibel", "Käufer hat abgelehnt", "Sonstiges"];

export function MatchesTable({ mandateId, matches, canEdit, canApprove }: { mandateId: string; matches: MatchRow[]; canEdit: boolean; canApprove: boolean }) {
  const [open, setOpen] = useState<string | null>(null);
  const [filter, setFilter] = useState<"offen" | "alle">("offen");
  const shown = matches.filter((m) => filter === "alle" || (m.status !== "ABGELEHNT" && m.status !== "GESCHLOSSEN"));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted">
          {shown.length} von {matches.length} Treffern · sortiert nach Punktwert
        </p>
        <div className="flex gap-1">
          {(["offen", "alle"] as const).map((f) => (
            <button key={f} type="button" onClick={() => setFilter(f)} className={cn("rounded-full px-3 py-1 text-xs font-medium", filter === f ? "bg-brand text-petrol" : "bg-canvas text-muted")}>
              {f === "offen" ? "Offene" : "Alle"}
            </button>
          ))}
        </div>
      </div>
      {shown.length === 0 && <div className="rounded-2xl border border-dashed border-line p-6 text-center text-sm text-muted">Keine Treffer. Suchprofil prüfen oder Objekte erfassen.</div>}
      {shown.map((m) => (
        <MatchCard key={m.id} m={m} mandateId={mandateId} canEdit={canEdit} canApprove={canApprove} expanded={open === m.id} onToggle={() => setOpen(open === m.id ? null : m.id)} />
      ))}
    </div>
  );
}

function MatchCard({ m, mandateId, canEdit, canApprove, expanded, onToggle }: { m: MatchRow; mandateId: string; canEdit: boolean; canApprove: boolean; expanded: boolean; onToggle: () => void }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [mode, setMode] = useState<"none" | "reject" | "send" | "viewing">("none");

  function act(status: MatchStatus, rejectReason: string | null = null, channel?: string) {
    start(async () => {
      const r = await matchStatusAction(mandateId, m.id, status, rejectReason, channel);
      setMsg(r.ok ? { ok: true, text: r.message ?? "Gespeichert." } : { ok: false, text: r.error });
      if (r.ok) setMode("none");
    });
  }

  const tone = m.status === "AN_KAEUFER" ? "ok" : m.status === "ABGELEHNT" || m.status === "GESCHLOSSEN" ? "neutral" : m.status === "GEMERKT" ? "warn" : "brand";
  const secondBuyer = m.rank.rank > 1;

  return (
    <div className={cn("rounded-2xl border bg-surface p-4", m.nearMiss ? "border-warn/40" : "border-line")}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/objekte/${m.property.id}`} className="font-medium text-petrol hover:underline">
              {m.property.title}
            </Link>
            <span className={cn("inline-block h-2.5 w-2.5 rounded-full", LIGHT[m.property.licenseLight])} title={`Ampel ${m.property.licenseLight}`} />
            {m.nearMiss && <Badge tone="warn">knapp daneben</Badge>}
            <Badge tone={tone}>{MATCH_STATUS_LABEL[m.status]}</Badge>
            {m.property.availability !== "VERFUEGBAR" && <Badge tone="danger">{m.property.availability.toLowerCase()}</Badge>}
          </div>
          <div className="mt-1 text-sm text-muted">
            {[m.property.locality, m.property.region, m.property.country].filter(Boolean).join(" · ")} · {m.property.price.toLocaleString("de-DE")} €
          </div>
          {m.presentation && (
            <div className="mt-1 text-xs text-ok">
              Vorgestellt am {new Date(m.presentation.sentAt).toLocaleDateString("de-DE")} ({m.presentation.channel}), Angebotspreis eingefroren: {m.presentation.askingPrice.toLocaleString("de-DE")} €
            </div>
          )}
          {m.presentation?.viewedAt && <div className="mt-1 text-xs text-muted">Im Portal angesehen am {new Date(m.presentation.viewedAt).toLocaleDateString("de-DE")}</div>}
          {m.buyer.action && (
            <div className="mt-1 text-xs font-medium text-petrol">
              Käufer im Portal: {m.buyer.action === "GEMERKT" ? "gemerkt" : m.buyer.action === "BESICHTIGUNG" ? "Besichtigung angefragt" : "abgelehnt"}
              {m.buyer.category ? ` (${m.buyer.category})` : ""}
              {m.buyer.text ? ` – ${m.buyer.text}` : ""}
            </div>
          )}
          {m.priorKnowledge && <div className="mt-1 text-xs font-medium text-warn">Vorkenntnis – Honoraranspruch prüfen (Objekt seit {new Date(m.property.knownSince).toLocaleDateString("de-DE")} bekannt, vor Beauftragung)</div>}
          {secondBuyer && m.status !== "AN_KAEUFER" && (
            <div className="mt-1 text-xs text-warn">
              Rang {m.rank.rank} von {m.rank.total}: Vorrang hat „{m.rank.firstTitle}“. Vorstellung nur nach Freigabe durch die Leitung.
            </div>
          )}
          {m.rejectReason && <div className="mt-1 text-xs text-muted">Grund: {m.rejectReason}</div>}
          {m.viewingAt && (
            <div className="mt-1 text-xs text-petrol">
              Besichtigung {new Date(m.viewingAt).toLocaleString("de-DE", { dateStyle: "medium", timeStyle: "short" })}
              {m.viewingNote ? ` – ${m.viewingNote}` : ""}
            </div>
          )}
        </div>
        <div className="text-right">
          <div className="text-2xl font-semibold text-petrol">{m.score}</div>
          <button type="button" onClick={onToggle} className="block text-xs text-brand-strong">
            {expanded ? "Begründung ausblenden" : "Begründung"}
          </button>
          <Link href={`/dossier/${m.property.id}?m=${mandateId}`} target="_blank" className="block text-xs text-brand-strong">
            Dossier
          </Link>
          <Link href={`/besichtigungen/neu?property=${m.property.id}&mandate=${mandateId}`} className="text-xs text-brand-strong">
            Protokoll
          </Link>
        </div>
      </div>

      {expanded && (
        <div className="mt-3 grid gap-3 rounded-xl bg-canvas p-3 text-xs sm:grid-cols-3">
          <ReasonList title="Passt" items={m.reasons.passt} className="text-ok" />
          <ReasonList title="Knapp" items={m.reasons.knapp} className="text-warn" />
          <ReasonList title="Fehlt" items={m.reasons.fehlt} className="text-danger" />
        </div>
      )}

      {msg && (
        <div className="mt-3">
          <Notice tone={msg.ok ? "ok" : "danger"}>{msg.text}</Notice>
        </div>
      )}

      {canEdit && m.status !== "GESCHLOSSEN" && (
        <div className="mt-3 flex flex-wrap gap-2">
          {m.status === "NEU" && (
            <Button size="sm" variant="secondary" disabled={pending} onClick={() => act("GEPRUEFT")}>
              Geprüft
            </Button>
          )}
          {m.status !== "GEMERKT" && m.status !== "AN_KAEUFER" && (
            <Button size="sm" variant="secondary" disabled={pending} onClick={() => act("GEMERKT")}>
              Merken
            </Button>
          )}
          {m.status !== "AN_KAEUFER" && (
            <Button size="sm" disabled={pending || (secondBuyer && !canApprove)} onClick={() => setMode(mode === "send" ? "none" : "send")}>
              {secondBuyer ? "An Käufer (mit Freigabe)" : "An Käufer vorstellen"}
            </Button>
          )}
          {m.status !== "ABGELEHNT" && (
            <Button size="sm" variant="danger" disabled={pending} onClick={() => setMode(mode === "reject" ? "none" : "reject")}>
              Ablehnen
            </Button>
          )}
          {m.status === "AN_KAEUFER" && (
            <Button size="sm" variant="secondary" onClick={() => setMode(mode === "viewing" ? "none" : "viewing")}>
              Besichtigung
            </Button>
          )}
        </div>
      )}

      {mode === "send" && (
        <SendForm onSubmit={(channel) => act("AN_KAEUFER", null, channel)} secondBuyer={secondBuyer} />
      )}
      {mode === "reject" && <RejectForm onSubmit={(reason) => act("ABGELEHNT", reason)} />}
      {mode === "viewing" && (
        <ActionForm action={setViewingAction.bind(null, mandateId, m.id)} className="mt-3 rounded-xl border border-line bg-canvas p-3" onSuccess={() => setMode("none")}>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Termin">
              <Input type="datetime-local" name="viewingAt" defaultValue={m.viewingAt ? m.viewingAt.slice(0, 16) : ""} />
            </Field>
            <Field label="Kurznotiz">
              <Input name="viewingNote" defaultValue={m.viewingNote ?? ""} placeholder="Eindruck, offene Punkte" />
            </Field>
          </div>
          <Button type="submit" size="sm">
            Speichern
          </Button>
        </ActionForm>
      )}
    </div>
  );
}

function ReasonList({ title, items, className }: { title: string; items: string[]; className: string }) {
  return (
    <div>
      <div className={cn("mb-1 font-semibold", className)}>{title}</div>
      {items.length === 0 ? <div className="text-muted">–</div> : <ul className="list-disc space-y-0.5 pl-4">{items.map((i) => <li key={i}>{i}</li>)}</ul>}
    </div>
  );
}

function SendForm({ onSubmit, secondBuyer }: { onSubmit: (channel: string) => void; secondBuyer: boolean }) {
  const [channel, setChannel] = useState("EMAIL");
  return (
    <div className="mt-3 rounded-xl border border-line bg-canvas p-3">
      <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <Field label="Kanal der Vorstellung">
          <Select value={channel} onChange={(e) => setChannel(e.target.value)}>
            <option value="EMAIL">E-Mail</option>
            <option value="DOSSIER">Dossier</option>
            <option value="VOR_ORT">Vor Ort / Gespräch</option>
            <option value="PORTAL">Käuferportal</option>
          </Select>
        </Field>
        <Button size="sm" onClick={() => onSubmit(channel)}>
          {secondBuyer ? "Freigeben und vorstellen" : "Vorstellen und Preis einfrieren"}
        </Button>
      </div>
      <p className="mt-2 text-xs text-muted">Erzeugt den Vorstellungs-Nachweis (Presentation) mit Zeitpunkt und aktuellem Angebotspreis.{secondBuyer && " Die Freigabe wird im Verlauf protokolliert."}</p>
    </div>
  );
}

function RejectForm({ onSubmit }: { onSubmit: (reason: string) => void }) {
  const [reason, setReason] = useState(REJECT_REASONS[0]);
  const [text, setText] = useState("");
  return (
    <div className="mt-3 rounded-xl border border-line bg-canvas p-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Ablehnungsgrund (Pflicht)">
          <Select value={reason} onChange={(e) => setReason(e.target.value)}>
            {REJECT_REASONS.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </Select>
        </Field>
        <Field label="Ergänzung">
          <Textarea rows={1} value={text} onChange={(e) => setText(e.target.value)} />
        </Field>
      </div>
      <Button size="sm" variant="danger" className="mt-3" onClick={() => onSubmit([reason, text.trim()].filter(Boolean).join(": "))}>
        Ablehnen
      </Button>
    </div>
  );
}
