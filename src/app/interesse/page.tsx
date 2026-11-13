import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { getLegalTexts, getPublicSources } from "@/lib/settings";
import { asLang, t } from "@/lib/i18n";
import { Logo } from "@/components/layout/logo";
import { InterestForm, type RegionChoice } from "@/components/public/interest-form";
import { PublicFooter } from "@/components/public/legal-text";

type SP = Promise<{ q?: string; lang?: string }>;

export async function generateMetadata({ searchParams }: { searchParams: SP }): Promise<Metadata> {
  const { lang } = await searchParams;
  return { title: t(asLang(lang), "interest.page_title"), robots: { index: false } };
}

export default async function InterestPage({ searchParams }: { searchParams: SP }) {
  const { q, lang: langParam } = await searchParams;
  const lang = asLang(langParam);
  const [sources, legal, regionRows, countryRows] = await Promise.all([
    getPublicSources(),
    getLegalTexts(),
    prisma.region.findMany({ select: { name: true, country: true, focus: true }, orderBy: [{ country: "asc" }, { name: "asc" }] }),
    prisma.country.findMany({ select: { code: true, name: true, nameEn: true } }),
  ]);
  const known = q && sources[q] ? q : null;
  const sourceLabel = known ? sources[known].sourceDetail : null;

  // Schwerpunktregionen zum Anklicken; ohne gesetzten Schwerpunkt alle Regionen
  const focus = regionRows.filter((r) => r.focus);
  const countryLabel = (code: string) => {
    const c = countryRows.find((x) => x.code === code);
    return (lang === "en" ? c?.nameEn : null) ?? c?.name ?? code;
  };
  const regions: RegionChoice[] = (focus.length ? focus : regionRows).map((r) => ({ name: r.name, country: r.country, countryLabel: countryLabel(r.country) }));

  const href = (l: "de" | "en") => `/interesse?${new URLSearchParams({ ...(known ? { q: known } : {}), ...(l === "en" ? { lang: "en" } : {}) }).toString()}`;

  return (
    <main className="mx-auto min-h-dvh max-w-lg px-5 py-10" lang={lang}>
      <div className="mb-8 flex items-center justify-between">
        <Logo size={36} />
        <nav aria-label={t(lang, "common.language")} className="flex gap-1 text-sm">
          {(["de", "en"] as const).map((l) => (
            <Link key={l} href={href(l)} hrefLang={l} className={`rounded-md px-2.5 py-1 font-medium ${lang === l ? "bg-brand text-on-brand" : "text-muted hover:text-ink"}`}>
              {l.toUpperCase()}
            </Link>
          ))}
        </nav>
      </div>
      <h1 className="text-2xl font-semibold tracking-tight text-petrol">{t(lang, "interest.headline")}</h1>
      <p className="mt-2 text-sm text-muted">{t(lang, "interest.intro")}</p>
      {sourceLabel && <p className="mt-2 text-xs text-muted">{t(lang, "interest.via", { source: sourceLabel })}</p>}

      <div className="mt-8">
        <InterestForm q={known} lang={lang} regions={regions} />
      </div>

      <PublicFooter imprintUrl={legal.imprintUrl}>
        <Link href="/datenschutz" className="underline">
          {t(lang, "interest.privacy")}
        </Link>
      </PublicFooter>
    </main>
  );
}
