import { redirect } from "next/navigation";
import Link from "next/link";
import { env } from "@/lib/env";
import { getSessionUser, hubEntryUrl } from "@/lib/auth";
import { hubErrorMessage, safeTarget } from "@/lib/oidc";
import { Logo } from "@/components/layout/logo";
import { ButtonLink } from "@/components/ui/button";
import { Notice } from "@/components/ui/card";

export const metadata = { title: "Anmelden" };

/**
 * Baax Stay ist nur für das Team. Ohne Sitzung geht es daher still über den eigenen Anmelde-Einstieg zum Hub
 * (laut Hub erlaubt für Seiten nur für das Team). Die Seite selbst erscheint nur bei Fehlern oder ohne Hub.
 */
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  const target = safeTarget(next, env.appUrl);

  if (await getSessionUser()) redirect(target);
  if (env.hub.ssoConfigured && !error) redirect(hubEntryUrl(target));

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-12">
      <Logo className="mb-8" size={40} />
      <h1 className="text-2xl font-semibold text-petrol">Anmelden</h1>
      <p className="mt-2 text-sm text-muted">Baax Stay öffnest du über den Baax Hub: unter Apps an der Kachel „Baax Stay“ auf „Anmelden“.</p>

      {error && (
        <div className="mt-6">
          <Notice tone="danger">{hubErrorMessage(error)}</Notice>
        </div>
      )}

      <div className="mt-8 space-y-3">
        {env.hub.ssoConfigured ? (
          <>
            <ButtonLink href={hubEntryUrl(target)} size="lg">
              Erneut anmelden
            </ButtonLink>
            <ButtonLink href={env.hub.url} variant="secondary" size="lg">
              Zum Baax Hub
            </ButtonLink>
          </>
        ) : (
          <Notice tone="warn">Anmeldung über den Hub ist noch nicht eingerichtet (HUB_URL, HUB_CLIENT_ID, HUB_CLIENT_SECRET).</Notice>
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
