import { redirect } from "next/navigation";
import Link from "next/link";
import { env } from "@/lib/env";
import { getSessionUser, hubLoginUrl } from "@/lib/auth";
import { Logo } from "@/components/layout/logo";
import { ButtonLink } from "@/components/ui/button";
import { Notice } from "@/components/ui/card";

export const metadata = { title: "Anmelden" };

function safeNext(next?: string): string {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  const target = safeNext(next);

  if (await getSessionUser()) redirect(target);

  // Mit konfiguriertem Hub direkt weiterleiten, außer es gab gerade einen Fehler.
  if (env.hub.ssoConfigured && !error) redirect(hubLoginUrl(target));

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-12">
      <Logo className="mb-8" size={40} />
      <h1 className="text-2xl font-semibold text-petrol">Anmelden</h1>
      <p className="mt-2 text-sm text-muted">Baax Stay nutzt den Login des Baax Hub. Kontakte und Aufgaben leben dort.</p>

      {error && (
        <div className="mt-6">
          <Notice tone="danger">{decodeURIComponent(error)}</Notice>
        </div>
      )}

      <div className="mt-8 space-y-3">
        {env.hub.ssoConfigured ? (
          <ButtonLink href={hubLoginUrl(target)} size="lg">
            Mit Baax Hub anmelden
          </ButtonLink>
        ) : (
          <Notice tone="warn">
            Hub-Login ist noch nicht konfiguriert (HUB_URL und HUB_JWT_SECRET oder HUB_JWKS_URL fehlen).
          </Notice>
        )}
        {env.devLoginEnabled && (
          <ButtonLink href={`/auth/dev?next=${encodeURIComponent(target)}`} variant="secondary" size="lg">
            Entwickler-Login (nur lokal)
          </ButtonLink>
        )}
      </div>

      <p className="mt-10 text-xs text-muted">
        Interessent? Zum <Link href="/interesse" className="underline">Interessenformular</Link>.
      </p>
    </main>
  );
}
