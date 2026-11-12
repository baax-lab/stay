"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { buyerRejectAction, buyerRememberAction, buyerViewingAction, requestNewLinkAction } from "@/app/portal/[token]/actions";
import { Button } from "@/components/ui/button";
import { Field, Select, Textarea } from "@/components/ui/field";
import { Notice } from "@/components/ui/card";

type Labels = {
  remember: string;
  remembered: string;
  reject: string;
  rejected: string;
  viewing: string;
  viewingRequested: string;
  rejectReason: string;
  rejectText: string;
  rejectSubmit: string;
  viewingNote: string;
  viewingSubmit: string;
  thanksReject: string;
  thanksViewing: string;
  thanksRemember: string;
  reasons: Array<{ value: string; label: string }>;
};

export function BuyerActions({ token, propertyId, current, labels }: { token: string; propertyId: string; current: string | null; labels: Labels }) {
  const router = useRouter();
  const [mode, setMode] = useState<"none" | "reject" | "viewing">("none");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function run(fn: () => Promise<{ ok: boolean }>, thanks: string) {
    start(async () => {
      const r = await fn();
      if (r.ok) {
        setMsg(thanks);
        setMode("none");
        router.refresh();
      }
    });
  }

  if (current === "ABGELEHNT") return <Notice tone={msg ? "ok" : "neutral"}>{msg ?? labels.rejected}</Notice>;

  return (
    <div className="space-y-3" data-testid="buyer-actions">
      {msg && <Notice tone="ok">{msg}</Notice>}
      <div className="flex flex-wrap gap-2">
        <Button variant={current === "GEMERKT" ? "primary" : "secondary"} disabled={pending || current === "GEMERKT"} onClick={() => run(() => buyerRememberAction(token, propertyId), labels.thanksRemember)}>
          {current === "GEMERKT" ? labels.remembered : labels.remember}
        </Button>
        <Button variant="secondary" disabled={pending || current === "BESICHTIGUNG"} onClick={() => setMode(mode === "viewing" ? "none" : "viewing")}>
          {current === "BESICHTIGUNG" ? labels.viewingRequested : labels.viewing}
        </Button>
        <Button variant="danger" disabled={pending} onClick={() => setMode(mode === "reject" ? "none" : "reject")}>
          {labels.reject}
        </Button>
      </div>
      {mode === "reject" && (
        <form
          className="space-y-3 rounded-xl border border-line bg-canvas p-4"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            run(() => buyerRejectAction(token, propertyId, fd), labels.thanksReject);
          }}
        >
          <Field label={labels.rejectReason} required>
            <Select name="category" required defaultValue="">
              <option value="" disabled>
                –
              </option>
              {labels.reasons.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={labels.rejectText}>
            <Textarea name="text" rows={2} />
          </Field>
          <Button type="submit" variant="danger" disabled={pending}>
            {labels.rejectSubmit}
          </Button>
        </form>
      )}
      {mode === "viewing" && (
        <form
          className="space-y-3 rounded-xl border border-line bg-canvas p-4"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            run(() => buyerViewingAction(token, propertyId, fd), labels.thanksViewing);
          }}
        >
          <Field label={labels.viewingNote}>
            <Textarea name="note" rows={2} />
          </Field>
          <Button type="submit" disabled={pending}>
            {labels.viewingSubmit}
          </Button>
        </form>
      )}
    </div>
  );
}

export function RequestLinkButton({ token, label, done }: { token: string; label: string; done: string }) {
  const [sent, setSent] = useState(false);
  const [pending, start] = useTransition();
  if (sent) return <Notice tone="ok">{done}</Notice>;
  return (
    <Button
      disabled={pending}
      onClick={() =>
        start(async () => {
          await requestNewLinkAction(token);
          setSent(true);
        })
      }
    >
      {label}
    </Button>
  );
}
