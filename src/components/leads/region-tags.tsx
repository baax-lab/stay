"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/cn";

type Option = { key: string; name: string; country: string };

/** Tag-Eingabe für Regionen: Vorschläge aus Stammdaten, Freitext erlaubt. */
export function RegionTags({ value, onChange, options }: { value: string[]; onChange: (v: string[]) => void; options: Option[] }) {
  const [query, setQuery] = useState("");

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    const pool = options.filter((o) => !value.includes(o.name));
    if (!q) return pool.filter((o) => ["es-mallorca", "it-suedtirol", "at-tirol", "de-oberallgaeu"].includes(o.key));
    return pool.filter((o) => o.name.toLowerCase().includes(q) || o.key.includes(q)).slice(0, 8);
  }, [query, options, value]);

  function add(name: string) {
    const n = name.trim();
    if (!n || value.includes(n)) return;
    onChange([...value, n]);
    setQuery("");
  }

  return (
    <div className="rounded-xl border border-line bg-surface p-2">
      <div className="flex flex-wrap gap-1.5">
        {value.map((v) => (
          <button key={v} type="button" onClick={() => onChange(value.filter((x) => x !== v))} className="inline-flex items-center gap-1 rounded-md bg-brand-soft px-3 py-1 text-sm text-petrol" aria-label={`${v} entfernen`}>
            {v} <span aria-hidden>×</span>
          </button>
        ))}
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              add(suggestions[0]?.name && query && suggestions[0].name.toLowerCase().startsWith(query.toLowerCase()) ? suggestions[0].name : query);
            }
          }}
          placeholder={value.length ? "" : "Region eingeben…"}
          className="min-w-32 flex-1 bg-transparent px-2 py-1 text-ink outline-none"
        />
      </div>
      {suggestions.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5 border-t border-line pt-2">
          {suggestions.map((s) => (
            <button key={s.key} type="button" onClick={() => add(s.name)} className={cn("rounded-md border border-line px-3 py-1 text-xs text-ink hover:border-brand hover:bg-brand-soft")}>
              {s.name} <span className="text-muted">{s.country}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
