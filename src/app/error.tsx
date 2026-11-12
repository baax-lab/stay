"use client";

import Link from "next/link";

/** Freundliche Fehlerseite; Details landen im Server-Log, nicht beim Nutzer. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-6 text-center">
      <h1 className="text-2xl font-semibold text-petrol">Da ist etwas schiefgelaufen</h1>
      <p className="mt-2 text-sm text-muted">Bitte versuchen Sie es erneut. Bleibt der Fehler, melden Sie bitte die Kennung an den Admin.</p>
      {error.digest && <code className="mt-3 rounded bg-canvas px-2 py-1 text-xs text-muted">{error.digest}</code>}
      <div className="mt-6 flex gap-2">
        <button onClick={reset} className="h-11 rounded-full bg-brand px-5 text-sm font-medium text-petrol">
          Erneut versuchen
        </button>
        <Link href="/" className="inline-flex h-11 items-center rounded-full border border-line px-5 text-sm font-medium text-petrol">
          Zur Startseite
        </Link>
      </div>
    </main>
  );
}
