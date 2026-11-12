import Link from "next/link";
import { prisma } from "@/lib/db";
import { clientIp } from "@/lib/auth";
import { asPartnerLang, PARTNER_DICTS, PARTNER_LANGS, partnerLocale, tp } from "@/lib/i18n/partner";
import { profileToText } from "@/lib/profile-text";
import { criteriaLabels, getCriteria } from "@/lib/services/criteria";
import { mandateRef, openPartnerAccess, profilesForPartner } from "@/lib/services/partner-access";
import { Logo } from "@/components/layout/logo";
import { Notice } from "@/components/ui/card";
import { PartnerSubmitForm } from "@/components/partner-portal/submit-form";

export const metadata = { title: "Partnerzugang", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function PartnerAccessPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ lang?: string }> }) {
  const { token } = await params;
  const sp = await searchParams;
  const r = await openPartnerAccess(token, await clientIp());
  const lang = asPartnerLang(sp.lang ?? (r.state === "valid" ? r.partner.language : "en"));
  const t = (k: string, v?: Record<string, string | number>) => tp(lang, k, v);

  const header = (
    <header className="border-b border-line bg-surface">
      <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
        <Logo size={30} />
        <nav className="flex gap-1 text-sm">
          {PARTNER_LANGS.map((l) => (
            <Link key={l} href={`/partner-zugang/${token}?lang=${l}`} className={`rounded-full px-2.5 py-1 font-medium ${lang === l ? "bg-brand text-petrol" : "text-muted hover:text-petrol"}`} hrefLang={l}>
              {l.toUpperCase()}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );

  if (r.state !== "valid") {
    return (
      <div className="min-h-dvh bg-canvas">
        {header}
        <main className="mx-auto max-w-lg px-4 py-10 text-center" data-testid="partner-unavailable">
          <h1 className="text-xl font-semibold text-petrol">{t("expired_title")}</h1>
          <p className="mt-3 text-sm text-muted">{t("expired_text")}</p>
          <p className="mt-4 text-sm">
            <a href="mailto:mail@baax.de" className="underline">
              mail@baax.de
            </a>
          </p>
        </main>
      </div>
    );
  }

  const partner = r.partner;
  const textLang = lang === "de" ? "de" : "en";
  const [profiles, regions, criteria, labels, submissions] = await Promise.all([
    profilesForPartner(partner, r.access.mandateId),
    prisma.region.findMany({ where: { country: partner.country }, orderBy: { name: "asc" } }),
    getCriteria(),
    criteriaLabels(),
    prisma.property.findMany({ where: { partnerId: partner.id }, orderBy: { createdAt: "desc" }, take: 30, include: { _count: { select: { presentations: true } } } }),
  ]);
  const regionNames = Object.fromEntries((await prisma.region.findMany({ select: { key: true, name: true } })).map((x) => [x.key, x.name]));
  const visibleRegions = partner.regions.length ? regions.filter((x) => partner.regions.includes(x.key)) : regions;
  const dict = PARTNER_DICTS[lang];

  return (
    <div className="min-h-dvh bg-canvas">
      {header}
      <main className="mx-auto max-w-4xl px-4 pb-16 pt-6">
        <h1 className="text-2xl font-semibold tracking-tight text-petrol">{t("hello", { name: partner.name })}</h1>
        <p className="mt-2 text-sm text-muted">{t("intro")}</p>

        <section className="mt-6">
          <h2 className="mb-3 text-lg font-semibold text-petrol">{t("profiles")}</h2>
          {profiles.length === 0 && <p className="rounded-2xl border border-dashed border-line p-6 text-center text-sm text-muted">{t("no_profiles")}</p>}
          <div className="grid gap-3 md:grid-cols-2">
            {profiles.map((p) => {
              const text = profileToText(p, regionNames, textLang, mandateRef(p.mandateId), labels);
              return (
                <article key={p.id} className="rounded-2xl border border-line bg-surface p-4 text-sm" data-testid="partner-profile">
                  <div className="mb-2 font-semibold text-petrol">{mandateRef(p.mandateId)}</div>
                  <dl className="space-y-1">
                    {text.lines.map(([k, v]) => (
                      <div key={k} className="grid grid-cols-[130px_1fr] gap-2">
                        <dt className="text-muted">{k}</dt>
                        <dd>{v}</dd>
                      </div>
                    ))}
                  </dl>
                </article>
              );
            })}
          </div>
          <p className="mt-3 text-xs text-muted">{t("confidential")}</p>
        </section>

        <section className="mt-8 rounded-2xl border border-line bg-surface p-5">
          <h2 className="text-lg font-semibold text-petrol">{t("submit_title")}</h2>
          <p className="mb-4 mt-1 text-sm text-muted">{t("submit_intro")}</p>
          {!partner.agreementAt && <Notice tone="warn">{lang === "de" ? "Hinweis: Mit Baax besteht noch keine unterzeichnete Partnervereinbarung." : "Note: no signed partner agreement with Baax is on file yet."}</Notice>}
          <PartnerSubmitForm
            token={token}
            locale={partnerLocale(lang)}
            labels={dict}
            refs={profiles.map((p) => ({ value: mandateRef(p.mandateId), label: mandateRef(p.mandateId) }))}
            regions={visibleRegions.map((x) => ({ value: x.key, label: x.name }))}
            segments={["FEWO", "APARTMENTHAUS", "PENSION_HOTEL"].map((s) => ({ value: s, label: t(`seg_${s}`) }))}
            licenses={["VORHANDEN", "BEANTRAGT", "FEHLT", "UNKLAR", "NICHT_NOETIG"].map((s) => ({ value: s, label: t(`lic_${s}`) }))}
            features={criteria.map((c) => ({ value: c.key, label: lang === "de" ? c.label : (c.labelEn ?? c.label) }))}
          />
        </section>

        <section className="mt-8">
          <h2 className="mb-3 text-lg font-semibold text-petrol">{t("my_submissions")}</h2>
          {submissions.length === 0 ? (
            <p className="text-sm text-muted">{t("no_submissions")}</p>
          ) : (
            <ul className="space-y-2" data-testid="partner-submissions">
              {submissions.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-surface px-4 py-2 text-sm">
                  <span>
                    {s.title} <span className="text-xs text-muted">· {s.createdAt.toLocaleDateString(partnerLocale(lang))}</span>
                  </span>
                  <span className="text-xs">{s.availability === "VERKAUFT" || s.availability === "ZURUECKGEZOGEN" || !s.active ? t("st_unavailable") : s._count.presentations > 0 ? t("st_presented") : t("st_received")}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
