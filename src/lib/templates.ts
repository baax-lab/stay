/**
 * Vorlagen aus Datensatz (Konzept §10): Text mit {{platzhalter}}, Punktnotation für verschachtelte Werte.
 * Fehlende Werte erscheinen als Leerstelle zum Ausfüllen, damit nichts stillschweigend wegfällt.
 */

export const TEMPLATE_KINDS = ["SUCHAUFTRAG", "PARTNERVEREINBARUNG", "TIPPGEBERBESTAETIGUNG"] as const;
export type TemplateKind = (typeof TEMPLATE_KINDS)[number];

export const TEMPLATE_KIND_LABEL: Record<TemplateKind, string> = {
  SUCHAUFTRAG: "Suchauftrag",
  PARTNERVEREINBARUNG: "Partnervereinbarung",
  TIPPGEBERBESTAETIGUNG: "Tippgeberbestätigung",
};

export const BLANK = "________________";

export function lookupPath(data: unknown, path: string): unknown {
  let cur: unknown = data;
  for (const part of path.split(".")) {
    if (cur && typeof cur === "object" && part in (cur as Record<string, unknown>)) cur = (cur as Record<string, unknown>)[part];
    else return undefined;
  }
  return cur;
}

/** {{a.b}} ersetzen; {{#if a.b}}…{{/if}} nur ausgeben, wenn der Wert gesetzt ist. */
export function renderTemplate(body: string, data: Record<string, unknown>): { text: string; missing: string[] } {
  const missing = new Set<string>();
  const withIfs = body.replace(/\{\{#if\s+([\w.]+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (_, path: string, inner: string) => {
    const v = lookupPath(data, path);
    return v !== undefined && v !== null && v !== "" && v !== false ? inner : "";
  });
  const text = withIfs.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, path: string) => {
    const v = lookupPath(data, path);
    if (v === undefined || v === null || v === "") {
      missing.add(path);
      return BLANK;
    }
    return String(v);
  });
  return { text, missing: [...missing] };
}

export function placeholdersOf(body: string): string[] {
  return Array.from(new Set([...body.matchAll(/\{\{\s*(?:#if\s+)?([\w.]+)\s*\}\}/g)].map((m) => m[1]))).filter((p) => p !== "/if");
}

/** Einfaches Markdown-Subset für Vorlagen: # Überschrift, ## Unterüberschrift, Absätze, „- “ Listen, **fett**. */
export function templateToHtml(text: string): string {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const inline = (s: string) => esc(s).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  const blocks = text.replace(/\r\n/g, "\n").split(/\n{2,}/);
  return blocks
    .map((b) => {
      const t = b.trim();
      if (!t) return "";
      if (t.startsWith("## ")) return `<h2>${inline(t.slice(3))}</h2>`;
      if (t.startsWith("# ")) return `<h1>${inline(t.slice(2))}</h1>`;
      const lines = t.split("\n");
      if (lines.every((l) => l.trim().startsWith("- "))) return `<ul>${lines.map((l) => `<li>${inline(l.trim().slice(2))}</li>`).join("")}</ul>`;
      return `<p>${lines.map(inline).join("<br>")}</p>`;
    })
    .join("\n");
}
