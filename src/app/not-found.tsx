import { ButtonLink } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-6 text-center">
      <h1 className="text-2xl font-semibold text-petrol">Seite nicht gefunden</h1>
      <p className="mt-2 text-sm text-muted">Der Link ist ungültig oder die Seite wurde verschoben.</p>
      <ButtonLink href="/" className="mt-6">
        Zur Startseite
      </ButtonLink>
    </main>
  );
}
