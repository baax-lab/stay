"use client";

import { useState, useTransition } from "react";
import { cn } from "@/lib/cn";
import { Notice } from "./card";

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string };

/**
 * Formular, das eine gebundene Server Action aufruft und Ergebnis/Fehler anzeigt.
 * Für Actions mit Rückgabewert (ActionResult), bei denen kein Redirect passiert.
 */
export function ActionForm({
  action,
  children,
  className,
  resetOnSuccess = false,
  onSuccess,
}: {
  action: (formData: FormData) => Promise<ActionResult>;
  children: React.ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
  onSuccess?: (result: { ok: true; message?: string }) => void;
}) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);

  return (
    <form
      className={cn("space-y-4", className)}
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const fd = new FormData(form);
        start(async () => {
          const r = await action(fd);
          setResult(r);
          if (r.ok) {
            if (resetOnSuccess) form.reset();
            onSuccess?.(r);
          }
        });
      }}
      aria-busy={pending}
    >
      {result && !result.ok && <Notice tone="danger">{result.error}</Notice>}
      {result && result.ok && result.message && <Notice tone="ok">{result.message}</Notice>}
      <fieldset disabled={pending} className="contents">
        {children}
      </fieldset>
    </form>
  );
}

/** Einzelner Button, der eine Action ohne Formulardaten auslöst. */
export function ActionButton({
  action,
  children,
  className,
  variant = "secondary",
  confirm,
}: {
  action: () => Promise<ActionResult>;
  children: React.ReactNode;
  className?: string;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  confirm?: string;
}) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const styles = {
    primary: "bg-brand text-petrol hover:bg-brand-strong hover:text-white",
    secondary: "bg-surface text-petrol border border-line hover:border-brand hover:bg-brand-soft",
    ghost: "text-petrol hover:bg-brand-soft",
    danger: "bg-danger-soft text-danger hover:bg-danger hover:text-white",
  };
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (confirm && !window.confirm(confirm)) return;
          start(async () => {
            const r = await action();
            setMsg(r.ok ? (r.message ?? null) : r.error);
          });
        }}
        className={cn("inline-flex h-9 items-center justify-center rounded-full px-3.5 text-sm font-medium transition-colors disabled:opacity-50", styles[variant], className)}
      >
        {pending ? "…" : children}
      </button>
      {msg && <span className="text-xs text-muted">{msg}</span>}
    </span>
  );
}
