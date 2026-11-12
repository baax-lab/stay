import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/session";

export type MandateEventType =
  | "CREATED"
  | "STATUS_CHANGE"
  | "NOTE"
  | "PROFILE_SAVED"
  | "INTERVIEW_SAVED"
  | "GWG_SET"
  | "FEE_SAVED"
  | "MATCH_STATUS"
  | "MATCH_SENT"
  | "MATCH_APPROVED"
  | "VIEWING_SET"
  | "OFFER"
  | "CLOSING_UPDATE"
  | "FOLLOWUP"
  | "DOCUMENT"
  | "PARTNER_SEND"
  | "REWARD"
  | "PROPERTY_UNAVAILABLE"
  | "EMAIL_SENT";

export const MANDATE_EVENT_LABEL: Record<MandateEventType, string> = {
  CREATED: "Suchauftrag angelegt",
  STATUS_CHANGE: "Statuswechsel",
  NOTE: "Notiz",
  PROFILE_SAVED: "Suchprofil gespeichert",
  INTERVIEW_SAVED: "Erstgespräch erfasst",
  GWG_SET: "GwG-Identifizierung",
  FEE_SAVED: "Honorar gespeichert",
  MATCH_STATUS: "Treffer bewertet",
  MATCH_SENT: "Objekt vorgestellt",
  MATCH_APPROVED: "Freigabe zweiter Käufer",
  VIEWING_SET: "Besichtigung",
  OFFER: "Angebot",
  CLOSING_UPDATE: "Kaufabwicklung",
  FOLLOWUP: "Nachbetreuung",
  DOCUMENT: "Dokument",
  PARTNER_SEND: "Suchprofil an Partner",
  REWARD: "Prämie",
  PROPERTY_UNAVAILABLE: "Objekt nicht mehr verfügbar",
  EMAIL_SENT: "E-Mail versendet",
};

export async function logEvent(mandateId: string, type: MandateEventType, payload: Prisma.InputJsonValue, user: Pick<SessionUser, "id" | "name"> | { id: string; name?: string }) {
  await prisma.mandateEvent.create({
    data: { mandateId, type, payload, userId: user.id, userName: user.name ?? null },
  });
}
