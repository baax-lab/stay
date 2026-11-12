"use client";

import { useState, useTransition } from "react";
import { createPortalLinkAction, sendPortalLinkAction } from "@/app/(app)/auftraege/kunden-actions";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/card";

/** Neuer Magic Link: Klartext nur einmal sichtbar (gespeichert wird nur der Hash). */
export function PortalLinkButtons({ mandateId, hasEmail }: { mandateId: string; hasEmail: boolean }) {
  const [pending, start] = useTransition();
  const [res, setRes] = useState<{ ok: boolean; message: string; url?: string } | null>(null);
  const [copied, setCopied] = useState(false);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" disabled={pending} onClick={() => start(async () => setRes(await createPortalLinkAction(mandateId)))}>
          Neuen Link erzeugen
        </Button>
        <Button disabled={pending || !hasEmail} onClick={() => start(async () => setRes(await sendPortalLinkAction(mandateId)))}>
          Neuen Link per Mail senden
        </Button>
      </div>
      {!hasEmail && <p className="text-xs text-muted">Für den Mailversand fehlt die E-Mail-Adresse des Käufers (Übersicht → Kopfdaten).</p>}
      {res && (
        <Notice tone={res.ok ? "ok" : "warn"}>
          <div>{res.message}</div>
          {res.url && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <code className="break-all rounded bg-white/70 px-2 py-1 text-xs text-ink" data-testid="portal-link">
                {res.url}
              </code>
              <button
                type="button"
                className="text-xs underline"
                onClick={() => {
                  void navigator.clipboard?.writeText(res.url!);
                  setCopied(true);
                }}
              >
                {copied ? "kopiert" : "kopieren"}
              </button>
            </div>
          )}
        </Notice>
      )}
    </div>
  );
}
