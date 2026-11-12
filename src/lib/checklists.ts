/** Kaufabwicklung: Checklisten je Land (Konzept §8.16). Startvorlagen DE, AT, IT, ES; sonst allgemein. */

export type ChecklistItem = {
  key: string;
  label: string;
  done: boolean;
  doneAt?: string | null;
  dueAt?: string | null;
  hubTaskAt?: string | null;
  note?: string | null;
};

const COMMON: Array<[string, string]> = [
  ["finanzierung", "Finanzierung bestätigt"],
  ["anwalt_notar", "Anwalt bzw. Notar beauftragt"],
  ["vorvertrag", "Vorvertrag / Reservierung"],
  ["anzahlung", "Anzahlung geleistet"],
  ["beurkundung", "Beurkundung"],
  ["uebergabe", "Übergabe"],
];

const BY_COUNTRY: Record<string, Array<[string, string]>> = {
  DE: [
    ["finanzierung", "Finanzierungsbestätigung der Bank"],
    ["notar", "Notar beauftragt, Kaufvertragsentwurf (14 Tage Frist)"],
    ["grundbuch", "Grundbuchauszug und Lasten geprüft"],
    ["beurkundung", "Beurkundung beim Notar"],
    ["auflassungsvormerkung", "Auflassungsvormerkung eingetragen"],
    ["kaufpreis", "Kaufpreisfälligkeit und Zahlung"],
    ["grunderwerbsteuer", "Grunderwerbsteuer bezahlt, Unbedenklichkeitsbescheinigung"],
    ["uebergabe", "Übergabe und Protokoll"],
  ],
  AT: [
    ["finanzierung", "Finanzierungszusage"],
    ["treuhaender", "Treuhänder (Notar/Anwalt) beauftragt"],
    ["grundverkehr", "Grundverkehrsgenehmigung / Zweitwohnsitz-Regelung geprüft"],
    ["kaufvertrag", "Kaufvertrag unterzeichnet"],
    ["treuhanderlag", "Kaufpreis beim Treuhänder erlegt"],
    ["grunderwerbsteuer", "Grunderwerbsteuer und Eintragungsgebühr"],
    ["grundbuch", "Grundbucheintragung"],
    ["uebergabe", "Übergabe"],
  ],
  IT: [
    ["codice_fiscale", "Codice fiscale beantragt"],
    ["finanzierung", "Finanzierung geklärt"],
    ["notaio", "Notaio beauftragt, Urkunden geprüft (visura, conformità)"],
    ["proposta", "Proposta d'acquisto / Compromesso unterschrieben"],
    ["caparra", "Caparra (Anzahlung) geleistet"],
    ["rogito", "Rogito (Beurkundung)"],
    ["imposte", "Imposta di registro / IVA bezahlt"],
    ["uebergabe", "Übergabe"],
  ],
  ES: [
    ["nie", "NIE (Steuernummer) beantragt"],
    ["bankkonto", "Spanisches Bankkonto eröffnet"],
    ["finanzierung", "Finanzierung geklärt"],
    ["abogado", "Abogado beauftragt, Nota simple und Lizenz geprüft"],
    ["arras", "Contrato de arras unterschrieben, Anzahlung (10 %)"],
    ["escritura", "Escritura beim Notario"],
    ["itp", "ITP / IVA und AJD bezahlt"],
    ["registro", "Eintragung im Registro de la Propiedad"],
    ["uebergabe", "Übergabe und Ummeldungen (Strom, Wasser, Gemeinde)"],
  ],
};

export function closingTemplate(country: string): ChecklistItem[] {
  const items = BY_COUNTRY[country.toUpperCase()] ?? COMMON;
  return items.map(([key, label]) => ({ key, label, done: false }));
}

export function closingProgress(items: ChecklistItem[]): { done: number; total: number } {
  return { done: items.filter((i) => i.done).length, total: items.length };
}
