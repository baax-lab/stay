"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { autoMap, IMPORT_FIELDS, parseCsv, type ImportScope } from "@/lib/csv";
import type { PreviewRow } from "@/lib/services/import";
import { commitImportAction, previewImportAction } from "@/app/(app)/import-actions";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select } from "@/components/ui/field";
import { Notice } from "@/components/ui/card";
import { cn } from "@/lib/cn";

const DETAIL_PATH: Record<ImportScope, string> = { leads: "/leads", objekte: "/objekte", partner: "/partner" };

export function CsvImport({ scope }: { scope: ImportScope }) {
  const fields = IMPORT_FIELDS[scope];
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [map, setMap] = useState<Record<number, string>>({});
  const [hasHeader, setHasHeader] = useState(true);
  const [preview, setPreview] = useState<PreviewRow[] | null>(null);
  const [skipDup, setSkipDup] = useState(true);
  const [result, setResult] = useState<{ created: number; skipped: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const text = await f.text();
    const parsed = parseCsv(text);
    if (parsed.length === 0) return setError("Datei ist leer");
    const h = hasHeader ? parsed[0] : parsed[0].map((_, i) => `Spalte ${i + 1}`);
    setHeaders(h);
    setRows(hasHeader ? parsed.slice(1) : parsed);
    setMap(autoMap(scope, h));
    setPreview(null);
    setResult(null);
    setError(null);
  }

  const mapped = () =>
    rows.map((r) => {
      const o: Record<string, string> = {};
      for (const [i, key] of Object.entries(map)) if (key) o[key] = r[Number(i)] ?? "";
      return o;
    });

  function doPreview() {
    const missing = fields.filter((f) => f.required && !Object.values(map).includes(f.key));
    if (missing.length) return setError(`Pflichtspalten nicht zugeordnet: ${missing.map((m) => m.label).join(", ")}`);
    setError(null);
    start(async () => {
      try {
        setPreview(await previewImportAction(scope, mapped()));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Vorschau fehlgeschlagen");
      }
    });
  }

  function doCommit() {
    if (!preview) return;
    start(async () => {
      try {
        setResult(await commitImportAction(scope, preview, skipDup));
        setPreview(null);
        setRows([]);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Import fehlgeschlagen");
      }
    });
  }

  const okCount = preview?.filter((p) => p.errors.length === 0 && !(skipDup && p.duplicates.length)).length ?? 0;

  return (
    <div className="space-y-6">
      {error && <Notice tone="danger">{error}</Notice>}
      {result && (
        <Notice tone="ok">
          {result.created} Datensätze importiert, {result.skipped} übersprungen. <Link href={DETAIL_PATH[scope]} className="underline">Zur Liste</Link>
        </Notice>
      )}

      <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
        <Field label="CSV-Datei" hint="Trennzeichen ; oder , wird erkannt; UTF-8">
          <Input type="file" accept=".csv,text/csv" onChange={onFile} />
        </Field>
        <Checkbox checked={hasHeader} onChange={(e) => setHasHeader(e.target.checked)} label="Erste Zeile ist Überschrift" />
      </div>

      {headers.length > 0 && !preview && (
        <div className="space-y-4">
          <div>
            <div className="mb-2 text-sm font-semibold text-petrol">Spaltenzuordnung</div>
            <div className="overflow-hidden rounded-2xl border border-line">
              <table className="w-full text-sm">
                <thead className="bg-canvas text-xs uppercase tracking-wide text-muted">
                  <tr>
                    <th className="px-3 py-2 text-left">CSV-Spalte</th>
                    <th className="px-3 py-2 text-left">Beispiel</th>
                    <th className="px-3 py-2 text-left">Feld in Baax Stay</th>
                  </tr>
                </thead>
                <tbody>
                  {headers.map((h, i) => (
                    <tr key={i} className="border-t border-line">
                      <td className="px-3 py-2 font-medium">{h}</td>
                      <td className="max-w-xs truncate px-3 py-2 text-muted">{rows[0]?.[i]}</td>
                      <td className="px-3 py-2">
                        <Select value={map[i] ?? ""} onChange={(e) => setMap({ ...map, [i]: e.target.value })}>
                          <option value="">– ignorieren –</option>
                          {fields.map((f) => (
                            <option key={f.key} value={f.key}>
                              {f.label}
                              {f.required ? " *" : ""}
                            </option>
                          ))}
                        </Select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <Button onClick={doPreview} disabled={pending}>
            {pending ? "Prüfe…" : `${rows.length} Zeilen prüfen (Vorschau)`}
          </Button>
        </div>
      )}

      {preview && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm">
              <span className="font-semibold text-petrol">{okCount}</span> von {preview.length} Zeilen werden importiert · {preview.filter((p) => p.errors.length).length} fehlerhaft · {preview.filter((p) => p.duplicates.length).length} mögliche Dubletten
            </div>
            <Checkbox checked={skipDup} onChange={(e) => setSkipDup(e.target.checked)} label="Mögliche Dubletten überspringen" />
          </div>
          <div className="max-h-[28rem] overflow-auto rounded-2xl border border-line">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-canvas uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-2 py-2 text-left">#</th>
                  <th className="px-2 py-2 text-left">Daten</th>
                  <th className="px-2 py-2 text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((p) => (
                  <tr key={p.index} className={cn("border-t border-line align-top", p.errors.length > 0 && "bg-danger-soft/40", p.errors.length === 0 && p.duplicates.length > 0 && "bg-warn-soft/40")}>
                    <td className="px-2 py-1.5 text-muted">{p.index + 1}</td>
                    <td className="px-2 py-1.5">
                      {Object.entries(p.data)
                        .filter(([, v]) => v !== null && v !== "" && !(Array.isArray(v) && v.length === 0) && v !== false)
                        .slice(0, 8)
                        .map(([k, v]) => (
                          <span key={k} className="mr-2 inline-block">
                            <span className="text-muted">{k}:</span> {Array.isArray(v) ? v.join(", ") : String(v)}
                          </span>
                        ))}
                    </td>
                    <td className="px-2 py-1.5">
                      {p.errors.map((e) => (
                        <div key={e} className="text-danger">{e}</div>
                      ))}
                      {p.duplicates.map((d) => (
                        <div key={d.id} className="text-warn">
                          Dublette? <Link href={`${DETAIL_PATH[scope]}/${d.id}`} className="underline" target="_blank">{d.label}</Link>
                        </div>
                      ))}
                      {!p.errors.length && !p.duplicates.length && <span className="text-ok">ok</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex gap-2">
            <Button onClick={doCommit} disabled={pending || okCount === 0}>
              {pending ? "Importiere…" : `${okCount} Datensätze speichern`}
            </Button>
            <Button variant="ghost" onClick={() => setPreview(null)}>
              Zurück zur Zuordnung
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
