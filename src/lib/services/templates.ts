import "server-only";
import { prisma } from "@/lib/db";
import { fmtDate, fmtMoney, t, type Lang } from "@/lib/i18n";
import { renderTemplate, templateToHtml, TEMPLATE_KIND_LABEL, type TemplateKind } from "@/lib/templates";
import { USAGE_GOAL_LABEL } from "@/lib/mandates";
import { criteriaLabels } from "./criteria";
import { mandateRef } from "./partner-access";

/** Daten für Vorlagen aus den Datensätzen (Konzept §10). Schlüssel sind die Platzhalter. */

const USAGE_EN: Record<string, string> = { RENDITE: "Yield", EIGENNUTZUNG: "Own use", KOMBINIERT: "Combined", EIGENBETRIEB: "Owner-operated" };

export async function templateData(kind: TemplateKind, entityId: string, lang: Lang): Promise<Record<string, unknown> | null> {
  const datum = fmtDate(lang, new Date());
  const pct = (n: number) => `${Math.round(n * 1000) / 10} %`;
  if (kind === "SUCHAUFTRAG") {
    const m = await prisma.mandate.findUnique({ where: { id: entityId }, include: { profile: true, fee: true } });
    if (!m) return null;
    const regions = m.profile?.regions.length ? await prisma.region.findMany({ where: { key: { in: m.profile.regions } } }) : [];
    const labels = await criteriaLabels();
    const L = (k: string) => (lang === "en" ? (labels.en[k] ?? labels.de[k] ?? k) : (labels.de[k] ?? k));
    const p = m.profile;
    return {
      datum,
      kaeufer: { name: m.buyerName, email: m.buyerEmail, telefon: m.buyerPhone },
      auftrag: { titel: m.title, ref: mandateRef(m.id), beginn: m.startDate ? fmtDate(lang, m.startDate) : null, ende: m.endDate ? fmtDate(lang, m.endDate) : null },
      profil: p
        ? {
            objektart: p.segments.map((s) => t(lang, `segment.${s}`)).join(", ") || null,
            laender: p.countries.join(", ") || null,
            regionen: regions.map((r) => r.name).join(", ") || (lang === "en" ? "whole country" : "ganzes Land"),
            budget: `${p.priceMin ? `${fmtMoney(lang, p.priceMin)} – ` : lang === "en" ? "up to " : "bis "}${fmtMoney(lang, p.priceMax)}`,
            nutzung: lang === "en" ? USAGE_EN[p.usageGoal] : USAGE_GOAL_LABEL[p.usageGoal],
            einheiten: p.minUnits || p.maxUnits ? `${p.minUnits ?? ""} – ${p.maxUnits ?? ""}` : null,
            lizenz: p.licenseRequired ? (lang === "en" ? "yes" : "ja") : lang === "en" ? "no" : "nein",
            muss: (p.mustCriteria as string[]).map(L).join(", ") || "–",
            wunsch: (p.wishCriteria as Array<{ key: string; weight: number }>).map((w) => `${L(w.key)} (${w.weight})`).join(", ") || "–",
          }
        : {},
      honorar: m.fee
        ? {
            erfolg: m.fee.successFee ? fmtMoney(lang, m.fee.successFee) : null,
            grund: m.fee.baseFeeActive && m.fee.baseFee ? fmtMoney(lang, m.fee.baseFee) : null,
            bonus: pct(m.fee.bonusPct),
            bonusDeckel: pct(m.fee.bonusCapPct),
            reisepauschale: m.fee.travelFlat ? fmtMoney(lang, m.fee.travelFlat) : null,
          }
        : {},
      gwg: { datum: m.gwgIdentifiedAt ? fmtDate(lang, m.gwgIdentifiedAt) : null, art: m.gwgIdentType },
      verantwortlich: { name: m.ownerName, email: m.ownerEmail, telefon: m.ownerPhone },
    };
  }
  if (kind === "PARTNERVEREINBARUNG") {
    const p = await prisma.partner.findUnique({ where: { id: entityId } });
    if (!p) return null;
    const regions = p.regions.length ? await prisma.region.findMany({ where: { key: { in: p.regions } } }) : [];
    return {
      datum,
      partner: { name: p.name, firma: p.company, email: p.email, telefon: p.phone, land: p.country, regionen: regions.map((r) => r.name).join(", ") || (lang === "en" ? "whole country" : "ganzes Land"), provision: p.commissionSplit, lizenz: p.licenseNote },
    };
  }
  const r = await prisma.referrer.findUnique({ where: { id: entityId }, include: { rewards: { include: { mandate: { select: { title: true } } } } } });
  if (!r) return null;
  const regel = r.rewardRule ?? (r.rewardFlat ? `pauschal ${fmtMoney(lang, r.rewardFlat)}` : r.rewardPct ? `${Math.round(r.rewardPct * 1000) / 10} % des Netto-Erfolgshonorars` : null);
  return {
    datum,
    tippgeber: {
      name: r.name,
      firma: r.company,
      email: r.email,
      regel,
      praemien: r.rewards.map((w) => `- ${w.mandate.title}: ${fmtMoney(lang, w.amount)}${w.paidAt ? ` (bezahlt ${fmtDate(lang, w.paidAt)})` : ""}`).join("\n") || null,
    },
  };
}

export async function renderDocument(kind: TemplateKind, entityId: string, lang: Lang): Promise<{ title: string; html: string; missing: string[]; lang: Lang } | null> {
  const tpl = (await prisma.documentTemplate.findUnique({ where: { kind_lang: { kind, lang } } })) ?? (await prisma.documentTemplate.findUnique({ where: { kind_lang: { kind, lang: "de" } } }));
  if (!tpl || !tpl.active) return null;
  const data = await templateData(kind, entityId, tpl.lang === "en" ? "en" : "de");
  if (!data) return null;
  const { text, missing } = renderTemplate(tpl.body, data);
  return { title: tpl.name || TEMPLATE_KIND_LABEL[kind], html: templateToHtml(text), missing, lang: tpl.lang === "en" ? "en" : "de" };
}
