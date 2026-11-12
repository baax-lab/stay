import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { t } from "@/lib/i18n";
import { BUYER_REJECT_REASONS } from "@/lib/portal";
import { loadDossier } from "@/lib/services/dossier";
import { enterPortal } from "@/lib/services/portal-page";
import { PortalShell, PortalUnavailable } from "@/components/portal/portal-shell";
import { DossierView } from "@/components/dossier/dossier-view";
import { BuyerActions } from "@/components/portal/portal-actions";
import { Notice } from "@/components/ui/card";

export const metadata = { title: "Objekt", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function PortalObjectPage({ params, searchParams }: { params: Promise<{ token: string; propertyId: string }>; searchParams: Promise<{ lang?: string }> }) {
  const { token, propertyId } = await params;
  const { lang: langParam } = await searchParams;
  const { r, lang } = await enterPortal(token, langParam, `object:${propertyId}`);
  if (r.state !== "valid") return <PortalUnavailable token={token} lang={lang} state={r.state} contact={r.state !== "unknown" ? { name: r.mandate.ownerName, phone: r.mandate.ownerPhone, email: r.mandate.ownerEmail } : undefined} />;

  // Nur freigegebene Objekte des eigenen Suchauftrags
  const presentation = await prisma.presentation.findUnique({ where: { mandateId_propertyId: { mandateId: r.mandate.id, propertyId } } });
  if (!presentation) notFound();
  if (!presentation.viewedAt) await prisma.presentation.update({ where: { id: presentation.id }, data: { viewedAt: new Date() } });

  const [d, match] = await Promise.all([loadDossier(propertyId, r.mandate.id, lang), prisma.match.findUnique({ where: { mandateId_propertyId: { mandateId: r.mandate.id, propertyId } } })]);
  if (!d) notFound();
  const unavailable = !d.available || match?.status === "GESCHLOSSEN";

  return (
    <PortalShell token={token} lang={lang} path={`/objekt/${propertyId}`}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <Link href={`/portal/${token}?lang=${lang}`} className="text-sm text-muted hover:text-petrol">
          ← {t(lang, "common.back")}
        </Link>
        <a href={`/portal/${token}/pdf/dossier/${propertyId}?lang=${lang}`} className="rounded-full bg-petrol px-4 py-2 text-sm font-medium text-white">
          {t(lang, "common.download_pdf")}
        </a>
      </div>
      <div className="mb-4">
        {unavailable ? (
          <Notice tone="warn">{t(lang, "portal.unavailable")}</Notice>
        ) : (
          <BuyerActions
            token={token}
            propertyId={propertyId}
            current={match?.buyerAction ?? null}
            labels={{
              remember: t(lang, "portal.remember"),
              remembered: t(lang, "portal.remembered"),
              reject: t(lang, "portal.reject"),
              rejected: t(lang, "portal.rejected"),
              viewing: t(lang, "portal.viewing"),
              viewingRequested: t(lang, "portal.viewing_requested"),
              rejectReason: t(lang, "portal.reject_reason"),
              rejectText: t(lang, "portal.reject_text"),
              rejectSubmit: t(lang, "portal.reject_submit"),
              viewingNote: t(lang, "portal.viewing_note"),
              viewingSubmit: t(lang, "portal.viewing_submit"),
              thanksReject: t(lang, "portal.thanks_reject"),
              thanksViewing: t(lang, "portal.thanks_viewing"),
              thanksRemember: t(lang, "portal.thanks_remember"),
              reasons: BUYER_REJECT_REASONS.map((k) => ({ value: k, label: t(lang, `reject_reasons.${k}`) })),
            }}
          />
        )}
      </div>
      <div className="rounded-2xl border border-line bg-surface p-5">
        <DossierView d={d} lang={lang} photoUrl={(id) => `/portal/${token}/foto/${id}`} />
      </div>
    </PortalShell>
  );
}
