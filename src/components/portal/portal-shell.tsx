import Link from "next/link";
import { Logo } from "@/components/layout/logo";
import { t, type Lang } from "@/lib/i18n";
import { RequestLinkButton } from "./portal-actions";

export function PortalShell({ token, lang, path = "", children }: { token: string; lang: Lang; path?: string; children: React.ReactNode }) {
  const base = `/portal/${token}${path}`;
  return (
    <div className="min-h-dvh bg-canvas">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link href={`/portal/${token}?lang=${lang}`}>
            <Logo size={30} />
          </Link>
          <nav className="flex items-center gap-1 text-sm" aria-label={t(lang, "common.language")}>
            {(["de", "en"] as const).map((l) => (
              <Link key={l} href={`${base}?lang=${l}`} className={`rounded-full px-3 py-1 font-medium ${lang === l ? "bg-brand text-petrol" : "text-muted hover:text-petrol"}`} hrefLang={l}>
                {l.toUpperCase()}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 pb-16 pt-6">{children}</main>
      <footer className="mx-auto max-w-5xl px-4 pb-8 text-xs text-muted">
        {t(lang, "common.brand")} · {t(lang, "common.tagline")} · {t(lang, "portal.footer")}
      </footer>
    </div>
  );
}

export function PortalUnavailable({ token, lang, state, contact }: { token: string; lang: Lang; state: "expired" | "revoked" | "unknown"; contact?: { name: string | null; phone: string | null; email: string | null } }) {
  return (
    <PortalShell token={token} lang={lang}>
      <div className="mx-auto max-w-lg rounded-2xl border border-line bg-surface p-6 text-center" data-testid="portal-unavailable">
        <h1 className="text-xl font-semibold text-petrol">{t(lang, "portal.expired_title")}</h1>
        <p className="mt-3 text-sm text-muted">{t(lang, state === "revoked" ? "portal.revoked_text" : "portal.expired_text")}</p>
        {state === "expired" && <RequestLinkForm token={token} lang={lang} />}
        <div className="mt-6 rounded-xl bg-canvas p-4 text-sm">
          <div className="font-medium text-petrol">{contact?.name ?? t(lang, "common.brand")}</div>
          {contact?.phone && (
            <div>
              {t(lang, "common.phone")}: <a href={`tel:${contact.phone}`} className="underline">{contact.phone}</a>
            </div>
          )}
          <div>
            {t(lang, "common.email")}: <a href={`mailto:${contact?.email ?? "mail@baax.de"}`} className="underline">{contact?.email ?? "mail@baax.de"}</a>
          </div>
        </div>
      </div>
    </PortalShell>
  );
}

function RequestLinkForm({ token, lang }: { token: string; lang: Lang }) {
  return (
    <div className="mt-5">
      <RequestLinkButton token={token} label={t(lang, "portal.request_link")} done={t(lang, "portal.link_sent")} />
    </div>
  );
}
