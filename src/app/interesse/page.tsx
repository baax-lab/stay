import Link from "next/link";
import { getLegalTexts, getPublicSources } from "@/lib/settings";
import { Logo } from "@/components/layout/logo";
import { InterestForm } from "@/components/public/interest-form";
import { PublicFooter } from "@/components/public/legal-text";

export const metadata = { title: "Interesse mitteilen", robots: { index: false } };

export default async function InterestPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const [sources, legal] = await Promise.all([getPublicSources(), getLegalTexts()]);
  const known = q && sources[q] ? q : null;
  const sourceLabel = known ? sources[known].sourceDetail : null;

  return (
    <main className="mx-auto min-h-dvh max-w-lg px-5 py-10">
      <Logo className="mb-8" size={36} />
      <h1 className="text-2xl font-semibold tracking-tight text-petrol">Suchen Sie eine Ferienimmobilie?</h1>
      <p className="mt-2 text-sm text-muted">
        Baax sucht ausschließlich im Auftrag von Käufern: Ferienwohnungen, Apartmenthäuser, Pensionen und kleine Hotels in Europa. Sagen Sie uns kurz, was Sie suchen oder anbieten. Wir melden uns persönlich.
      </p>
      {sourceLabel && <p className="mt-2 text-xs text-muted">Kontakt über: {sourceLabel}</p>}

      <div className="mt-8">
        <InterestForm q={known} />
      </div>

      <PublicFooter imprintUrl={legal.imprintUrl}>
        <Link href="/datenschutz" className="underline">
          Datenschutzhinweise
        </Link>
      </PublicFooter>
    </main>
  );
}
