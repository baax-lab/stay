import type { LeadRole, LeadSource, LeadStatus, Segment, HubSync, Role } from "@prisma/client";

export const LEAD_ROLE_LABEL: Record<LeadRole, string> = {
  KAEUFER: "Käufer",
  VERKAEUFER: "Verkäufer",
  PARTNER: "Partner",
  MULTIPLIKATOR: "Multiplikator",
};

export const LEAD_SOURCE_LABEL: Record<LeadSource, string> = {
  MESSE: "Messe",
  AGENTUR: "Agentur",
  MULTIPLIKATOR: "Multiplikator",
  WEBSITE: "Website",
  EMPFEHLUNG: "Empfehlung",
  LINKEDIN: "LinkedIn",
  BESTAND: "Bestand",
  SONSTIGES: "Sonstiges",
};

export const LEAD_STATUS_LABEL: Record<LeadStatus, string> = {
  NEU: "Neu",
  KONTAKTIERT: "Kontaktiert",
  ERSTGESPRAECH: "Erstgespräch",
  UMGEWANDELT: "Umgewandelt",
  VERWORFEN: "Verworfen",
};

export const SEGMENT_LABEL: Record<Segment, string> = {
  FEWO: "Ferienwohnung",
  APARTMENTHAUS: "Apartmenthaus",
  PENSION_HOTEL: "Pension / kleines Hotel",
};

export const HUB_SYNC_LABEL: Record<HubSync, string> = {
  PENDING: "Übergabe ausstehend",
  SYNCED: "Im Hub",
  FAILED: "Übergabe fehlgeschlagen",
};

export const ROLE_LABEL: Record<Role, string> = {
  ADMIN: "Admin",
  LEITUNG: "Leitung",
  MITARBEITER: "Mitarbeiter",
  PRAKTIKANT: "Praktikant",
};

export function entries<K extends string>(labels: Record<K, string>): Array<[K, string]> {
  return Object.entries(labels) as Array<[K, string]>;
}
