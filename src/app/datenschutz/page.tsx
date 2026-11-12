import Link from "next/link";
import { Logo } from "@/components/layout/logo";

export const metadata = { title: "Datenschutzhinweise" };

/**
 * Platzhalter mit den Pflichtangaben für das Interessenformular.
 * Inhalt vor Messestart durch die Leitung prüfen und mit der Datenschutzerklärung von baax.de abgleichen.
 */
export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl px-5 py-10 text-sm leading-relaxed text-ink">
      <Logo className="mb-8" size={36} />
      <h1 className="text-2xl font-semibold text-petrol">Datenschutzhinweise zum Interessenformular</h1>
      <p className="mt-4">
        <strong>Verantwortlich:</strong> Baax Immobilien GmbH (Anschrift und Kontakt gemäß Impressum auf baax.de).
      </p>
      <p className="mt-3">
        <strong>Zweck und Rechtsgrundlage:</strong> Wir verarbeiten Ihre Angaben (Name, E-Mail, Telefon, Ihr Anliegen, Region, Budgetrahmen), um Ihre Anfrage zu beantworten und Sie zu passenden Immobilien oder einer Zusammenarbeit zu kontaktieren. Rechtsgrundlage ist Ihre Einwilligung (Art. 6 Abs. 1 lit. a DSGVO) sowie die Anbahnung eines Vertragsverhältnisses (Art. 6 Abs. 1 lit. b DSGVO).
      </p>
      <p className="mt-3">
        <strong>Speicherdauer:</strong> Anfragen, die nicht zu einem Auftrag führen, löschen wir spätestens 12 Monate nach dem letzten Kontakt. Bei einem Auftrag gelten die gesetzlichen Aufbewahrungsfristen.
      </p>
      <p className="mt-3">
        <strong>Empfänger:</strong> Ihre Daten werden in unserem internen System und unserem Kontaktverzeichnis gespeichert, das auf Servern in Deutschland betrieben wird. Eine Weitergabe an Partnermakler erfolgt nur anonymisiert oder mit Ihrer gesonderten Zustimmung.
      </p>
      <p className="mt-3">
        <strong>Ihre Rechte:</strong> Sie haben das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung, Datenübertragbarkeit und Widerspruch. Ihre Einwilligung können Sie jederzeit mit Wirkung für die Zukunft widerrufen, formlos per E-Mail an die im Impressum genannte Adresse. Beschwerden richten Sie an die zuständige Datenschutzaufsichtsbehörde.
      </p>
      <p className="mt-8">
        <Link href="/interesse" className="underline">
          Zurück zum Formular
        </Link>
      </p>
    </main>
  );
}
