import type { MandateEvent } from "@prisma/client";
import { MANDATE_EVENT_LABEL, type MandateEventType } from "@/lib/services/events";
import { MANDATE_STATUS_LABEL } from "@/lib/mandates";
import type { MandateStatus } from "@prisma/client";

function describe(e: MandateEvent): string {
  const p = (e.payload ?? {}) as Record<string, unknown>;
  const s = (k: string) => (typeof p[k] === "string" ? (p[k] as string) : "");
  const n = (k: string) => (typeof p[k] === "number" ? (p[k] as number).toLocaleString("de-DE") + " €" : "");
  switch (e.type as MandateEventType) {
    case "STATUS_CHANGE":
      return `${MANDATE_STATUS_LABEL[s("from") as MandateStatus] ?? s("from")} → ${MANDATE_STATUS_LABEL[s("to") as MandateStatus] ?? s("to")}${s("endReason") ? ` (${s("endReason")})` : ""}${n("purchasePrice") ? `, Kaufpreis ${n("purchasePrice")}` : ""}`;
    case "MATCH_SENT":
      return `${s("propertyTitle")} vorgestellt (${s("channel") || "–"}), Angebotspreis ${n("askingPrice")}`;
    case "MATCH_STATUS":
      return `${s("propertyTitle")}: ${s("status")}${s("rejectReason") ? ` – ${s("rejectReason")}` : ""}`;
    case "MATCH_APPROVED":
      return `Freigabe: ${s("propertyTitle")} an nachrangigen Käufer`;
    case "OFFER":
      return `${s("propertyTitle")}: ${n("amount")}${s("response") ? ` – ${s("response")}` : ""}${n("counterAmount") ? ` (Gegenangebot ${n("counterAmount")})` : ""}`;
    case "VIEWING_SET":
      return `${s("propertyTitle")}${s("at") ? ` am ${new Date(s("at")).toLocaleString("de-DE", { dateStyle: "medium", timeStyle: "short" })}` : ""}${s("note") ? ` – ${s("note")}` : ""}`;
    case "FEE_SAVED":
      return [n("total") && `Gesamt ${n("total")}`, n("bonus") && `Bonus ${n("bonus")}`].filter(Boolean).join(", ");
    case "REWARD":
      return `${s("referrerName")}: ${n("amount")} (${s("basis")})`;
    case "PARTNER_SEND":
      return `an ${s("partnerName")} (${s("language")})`;
    case "PROPERTY_UNAVAILABLE":
      return `${s("propertyTitle")}: ${s("reason")}`;
    case "GWG_SET":
      return `${s("type")}, ${s("at") ? new Date(s("at")).toLocaleDateString("de-DE") : ""}`;
    case "DOCUMENT":
      return `${s("kind")}: ${s("fileName")}`;
    case "CLOSING_UPDATE":
      return `${p.done ?? 0} von ${p.total ?? 0} Punkten erledigt${s("handoverDate") ? `, Übergabe ${new Date(s("handoverDate")).toLocaleDateString("de-DE")}` : ""}`;
    case "NOTE":
      return s("note").slice(0, 160);
    case "INTERVIEW_SAVED":
      return s("assessment") ? `Einschätzung: ${s("assessment")}` : "";
    case "CREATED":
      return s("buyerName");
    default:
      return "";
  }
}

export function Timeline({ events }: { events: MandateEvent[] }) {
  if (events.length === 0) return <p className="text-sm text-muted">Noch keine Einträge.</p>;
  return (
    <ol className="relative space-y-4 border-l border-line pl-5">
      {events.map((e) => (
        <li key={e.id} className="relative">
          <span className="absolute -left-[26px] top-1.5 h-2.5 w-2.5 rounded-full bg-brand" />
          <div className="text-xs text-muted">
            {e.createdAt.toLocaleString("de-DE", { dateStyle: "medium", timeStyle: "short" })} · {e.userName || e.userId}
          </div>
          <div className="text-sm font-medium text-petrol">{MANDATE_EVENT_LABEL[e.type as MandateEventType] ?? e.type}</div>
          {describe(e) && <div className="text-sm text-ink">{describe(e)}</div>}
        </li>
      ))}
    </ol>
  );
}
