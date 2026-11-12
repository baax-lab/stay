import Link from "next/link";
import { Logo } from "@/components/layout/logo";
import { LegalText, PublicFooter } from "@/components/public/legal-text";
import { getLegalTexts } from "@/lib/settings";

export const metadata = { title: "Datenschutzhinweise" };
// Text kommt aus den Einstellungen, daher nicht beim Build vorab erzeugen
export const dynamic = "force-dynamic";

/**
 * Datenschutzhinweise für das Interessenformular. Der Text ist unter Einstellungen → Rechtstexte pflegbar;
 * solange dort nichts hinterlegt ist, gilt der Standardtext unten (vor Messestart durch die Leitung prüfen).
 */
export default async function PrivacyPage() {
  const legal = await getLegalTexts();
  const contact = legal.contactEmail || "mail@baax.de";

  return (
    <main className="mx-auto max-w-2xl px-5 py-10 text-sm leading-relaxed text-ink">
      <Logo className="mb-8" size={36} />
      <h1 className="text-2xl font-semibold text-petrol">Datenschutzhinweise zum Interessenformular</h1>
      {legal.privacyText.trim() ? (
        <LegalText text={legal.privacyText} />
      ) : (
        <>
          <p className="mt-4">
            <strong>Verantwortlich:</strong> Baax Immobilien GmbH (Anschrift und Kontakt gemäß{" "}
            {legal.imprintUrl ? (
              <a href={legal.imprintUrl} className="underline" target="_blank" rel="noopener noreferrer">
                Impressum
              </a>
            ) : (
              "Impressum"
            )}
            ), E-Mail {contact}.
          </p>
          <p className="mt-3">
            <strong>Zweck und Rechtsgrundlage:</strong> Wir verarbeiten Ihre Angaben (Name, E-Mail, Telefon, Ihr Anliegen, Region, Budgetrahmen), um Ihre Anfrage zu beantworten und Sie zu passenden Immobilien oder einer Zusammenarbeit zu kontaktieren. Rechtsgrundlage ist Ihre Einwilligung (Art. 6 Abs. 1 lit. a DSGVO) sowie die Anbahnung eines Vertragsverhältnisses (Art. 6 Abs. 1 lit. b DSGVO).
          </p>
          <p className="mt-3">
            <strong>Speicherdauer:</strong> Anfragen, die nicht zu einem Auftrag führen, löschen wir spätestens 12 Monate nach dem letzten Kontakt. Bei einem Auftrag gelten die gesetzlichen Aufbewahrungsfristen (u. a. 5 Jahre für Unterlagen nach dem Geldwäschegesetz).
          </p>
          <p className="mt-3">
            <strong>Empfänger:</strong> Ihre Daten werden in unserem internen System und unserem Kontaktverzeichnis gespeichert, das auf Servern in Deutschland betrieben wird. Eine Weitergabe an Partnermakler erfolgt nur anonymisiert oder mit Ihrer gesonderten Zustimmung.
          </p>
          <p className="mt-3">
            <strong>Ihre Rechte:</strong> Sie haben das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung, Datenübertragbarkeit und Widerspruch. Ihre Einwilligung können Sie jederzeit mit Wirkung für die Zukunft widerrufen, formlos per E-Mail an {contact}. Beschwerden richten Sie an die zuständige Datenschutzaufsichtsbehörde.
          </p>
        </>
      )}
      <p className="mt-8">
        <Link href="/interesse" className="underline">
          Zurück zum Formular
        </Link>
      </p>
      <PublicFooter imprintUrl={legal.imprintUrl} />
    </main>
  );
}
