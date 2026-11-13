"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { deleteSavedViewAction, listSavedViewsAction, saveViewAction } from "@/app/(app)/views-actions";

type View = { id: string; name: string; query: string };

/** Gespeicherte Filter je Nutzer (Konzept §8.23). */
export function SavedViews({ scope, current }: { scope: string; current: string }) {
  const pathname = usePathname();
  const [views, setViews] = useState<View[]>([]);
  const [name, setName] = useState("");
  const [pending, start] = useTransition();

  useEffect(() => {
    listSavedViewsAction(scope).then(setViews).catch(() => setViews([]));
  }, [scope]);

  function save() {
    if (!name.trim() || !current) return;
    start(async () => {
      await saveViewAction(scope, name.trim(), current);
      setName("");
      setViews(await listSavedViewsAction(scope));
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {views.map((v) => (
        <span key={v.id} className="inline-flex items-center overflow-hidden rounded-md border border-line bg-surface text-xs">
          <Link href={`${pathname}?${v.query}`} className="px-3 py-1.5 font-medium text-petrol hover:bg-brand-soft">
            {v.name}
          </Link>
          <button
            type="button"
            aria-label={`${v.name} löschen`}
            className="px-2 py-1.5 text-muted hover:text-danger"
            onClick={() =>
              start(async () => {
                await deleteSavedViewAction(v.id);
                setViews(await listSavedViewsAction(scope));
              })
            }
          >
            ×
          </button>
        </span>
      ))}
      {current && (
        <span className="inline-flex items-center gap-1">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ansicht speichern als…" className="h-8 rounded-md border border-line bg-surface px-3 text-xs" onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), save())} />
          <button type="button" disabled={pending || !name.trim()} onClick={save} className="h-8 rounded-md bg-brand-soft px-3 text-xs font-medium text-petrol disabled:opacity-50">
            Speichern
          </button>
        </span>
      )}
    </div>
  );
}
