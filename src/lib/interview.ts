/** Erstgespräch-Leitfaden (Konzept §8.14): feste Fragen mit strukturierten Antworten. */
export const INTERVIEW_QUESTIONS = [
  { key: "goal", label: "Ziel", hint: "Rendite, Eigennutzung, Kombination oder eigener Betrieb?", type: "usageGoal" },
  { key: "segment", label: "Objektart", hint: "Ferienwohnung, Apartmenthaus, Pension / kleines Hotel", type: "segments" },
  { key: "budget", label: "Budget", hint: "Gesamtbudget inkl. Nebenkosten", type: "priceRange" },
  { key: "equity", label: "Eigenkapital und Finanzierung", hint: "Eigenkapitalquote, Bank, Finanzierungsbestätigung vorhanden?", type: "text" },
  { key: "regions", label: "Regionen", hint: "Wunschregionen, Ausschlussregionen", type: "regions" },
  { key: "horizon", label: "Zeithorizont", hint: "Wann soll gekauft werden? Haltedauer?", type: "text" },
  { key: "experience", label: "Erfahrung", hint: "Bereits Ferienimmobilien besessen oder vermietet?", type: "text" },
  { key: "units", label: "Einheiten / Zimmer", hint: "Von – bis", type: "unitsRange" },
  { key: "license", label: "Vermietungslizenz", hint: "Muss vorhanden sein?", type: "boolean" },
  { key: "must", label: "Muss-Kriterien", hint: "Ohne die geht es nicht", type: "criteria" },
  { key: "wish", label: "Wunschkriterien", hint: "Schön, aber verzichtbar", type: "criteriaWeighted" },
  { key: "exclusions", label: "Ausschlüsse", hint: "Was kommt keinesfalls in Frage?", type: "text" },
  { key: "management", label: "Betrieb und Verwaltung", hint: "Selbst, Agentur, vor Ort?", type: "text" },
] as const;

export type InterviewKey = (typeof INTERVIEW_QUESTIONS)[number]["key"];

export const ASSESSMENT_OPTIONS = [
  { value: "JA", label: "realistisch" },
  { value: "MIT_ANPASSUNG", label: "realistisch mit Anpassung" },
  { value: "NEIN", label: "nicht realistisch" },
] as const;
