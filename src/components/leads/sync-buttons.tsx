"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { syncAllPendingAction, syncLeadAction } from "@/app/(app)/leads/actions";

export function SyncAllButton() {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <span className="inline-flex items-center gap-2">
      <Button variant="secondary" disabled={pending} onClick={() => start(async () => setMsg((await syncAllPendingAction()).message))}>
        {pending ? "Übergebe…" : "Hub-Übergabe nachholen"}
      </Button>
      {msg && <span className="text-xs text-muted">{msg}</span>}
    </span>
  );
}

export function SyncOneButton({ leadId }: { leadId: string }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="secondary" size="sm" disabled={pending} onClick={() => start(async () => setMsg((await syncLeadAction(leadId)).message))}>
        {pending ? "Übergebe…" : "Übergabe nachholen"}
      </Button>
      {msg && <span className="text-xs text-muted">{msg}</span>}
    </div>
  );
}
