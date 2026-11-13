"use client";

import Link from "next/link";
import { usePending } from "./use-pending";

/** Hinweis „3 Kontakte warten auf Übertragung“ in der Kopfzeile. */
export function PendingBadge() {
  const { count, online } = usePending();
  if (count === 0 && online) return null;
  return (
    <Link
      href="/leads/neu"
      className={
        "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium " +
        (online ? "bg-warn-soft text-warn" : "bg-danger-soft text-danger")
      }
    >
      <span className="h-2 w-2 rounded-full bg-current" />
      {count > 0 ? `${count} warten` : "Offline"}
    </Link>
  );
}
