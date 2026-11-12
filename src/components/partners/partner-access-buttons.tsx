"use client";

import { useState, useTransition } from "react";
import { createPartnerAccessAction, sendPartnerAccessAction } from "@/app/(app)/partner/actions";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/card";
import { Select } from "@/components/ui/field";

export function PartnerAccessButtons({ partnerId, hasEmail, mandates }: { partnerId: string; hasEmail: boolean; mandates: Array<{ id: string; label: string }> }) {
  const [pending, start] = useTransition();
  const [scope, setScope] = useState("");
  const [res, setRes] = useState<{ ok: boolean; message: string; url?: string } | null>(null);
  return (
    <div className="space-y-3">
      <Select value={scope} onChange={(e) => setScope(e.target.value)}>
        <option value="">Alle passenden Suchprofile</option>
        {mandates.map((m) => (
          <option key={m.id} value={m.id}>
            Nur {m.label}
          </option>
        ))}
      </Select>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" disabled={pending} onClick={() => start(async () => setRes(await createPartnerAccessAction(partnerId, scope || null)))}>
          Neuen Link erzeugen
        </Button>
        <Button disabled={pending || !hasEmail} onClick={() => start(async () => setRes(await sendPartnerAccessAction(partnerId)))}>
          Link per Mail senden
        </Button>
      </div>
      {res && (
        <Notice tone={res.ok ? "ok" : "warn"}>
          <div>{res.message}</div>
          {res.url && (
            <code className="mt-2 block break-all rounded bg-white/70 px-2 py-1 text-xs text-ink" data-testid="partner-access-link">
              {res.url}
            </code>
          )}
        </Notice>
      )}
    </div>
  );
}
