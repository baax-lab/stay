/**
 * Einfaches Textformat für pflegbare Rechtstexte (kein HTML, damit nichts eingeschleust werden kann):
 * Absätze durch Leerzeilen, „## “ = Zwischenüberschrift, **fett** innerhalb eines Absatzes.
 */
export type LegalBlock = { type: "h"; text: string } | { type: "p"; parts: { text: string; bold: boolean }[] };

export function parseLegalText(input: string): LegalBlock[] {
  const blocks: LegalBlock[] = [];
  for (const chunk of input.replace(/\r\n/g, "\n").split(/\n\s*\n/)) {
    const lines = chunk.split("\n").map((l) => l.trimEnd());
    let para: string[] = [];
    const flush = () => {
      const text = para.join("\n").trim();
      if (text) blocks.push({ type: "p", parts: inline(text) });
      para = [];
    };
    for (const line of lines) {
      if (/^##\s+/.test(line)) {
        flush();
        blocks.push({ type: "h", text: line.replace(/^##\s+/, "").trim() });
      } else para.push(line);
    }
    flush();
  }
  return blocks;
}

function inline(text: string): { text: string; bold: boolean }[] {
  return text
    .split(/(\*\*[^*]+\*\*)/)
    .filter(Boolean)
    .map((s) => (s.startsWith("**") && s.endsWith("**") && s.length > 4 ? { text: s.slice(2, -2), bold: true } : { text: s, bold: false }));
}
