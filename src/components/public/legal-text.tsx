import { parseLegalText } from "@/lib/legal";

/** Gibt einen gepflegten Rechtstext aus (nur Text, kein HTML). */
export function LegalText({ text }: { text: string }) {
  return (
    <>
      {parseLegalText(text).map((b, i) =>
        b.type === "h" ? (
          <h2 key={i} className="mt-6 text-base font-semibold text-petrol">
            {b.text}
          </h2>
        ) : (
          <p key={i} className="mt-3 whitespace-pre-line">
            {b.parts.map((p, j) => (p.bold ? <strong key={j}>{p.text}</strong> : <span key={j}>{p.text}</span>))}
          </p>
        ),
      )}
    </>
  );
}

/** Fußzeile öffentlicher Seiten mit Impressum und Datenschutz. */
export function PublicFooter({ imprintUrl, children }: { imprintUrl: string; children?: React.ReactNode }) {
  return (
    <footer className="mt-10 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
      <span>Baax Immobilien GmbH</span>
      {imprintUrl && (
        <a href={imprintUrl} className="underline" target="_blank" rel="noopener noreferrer">
          Impressum
        </a>
      )}
      {children}
    </footer>
  );
}
