import { describe, expect, it } from "vitest";
import { averageRating, inspectionTemplate, mergePrecheck, precheckProgress, precheckStatus, precheckTemplate } from "@/lib/precheck";
import { tripTotals } from "@/lib/trips";
import { BLANK, placeholdersOf, renderTemplate, templateToHtml } from "@/lib/templates";
import { averageRatings, hitRate, ratingScore, validRating } from "@/lib/partner-stats";

describe("Vorprüfung", () => {
  it("Checkliste je Segment und Land", () => {
    const es = precheckTemplate("FEWO", "ES").map((i) => i.key);
    expect(es).toContain("land_nota_simple");
    expect(es).toContain("segment_vermietung_erlaubt");
    expect(es).toContain("allgemein_eigentum");
    const hotelIt = precheckTemplate("PENSION_HOTEL", "IT").map((i) => i.key);
    expect(hotelIt).toContain("segment_konzession");
    expect(hotelIt).toContain("land_cin");
    expect(precheckTemplate("FEWO", "PT").every((i) => i.group !== "Land")).toBe(true);
  });

  it("Gesamtstatus", () => {
    const items = precheckTemplate("FEWO", "DE");
    expect(precheckStatus(items)).toBe("OFFEN");
    items[0].status = "OK";
    expect(precheckStatus(items)).toBe("LAEUFT");
    items[1].status = "BEDENKEN";
    expect(precheckStatus(items)).toBe("BEDENKEN");
    items[2].status = "KO";
    expect(precheckStatus(items)).toBe("KO");
    const all = precheckTemplate("FEWO", "DE").map((i, n) => ({ ...i, status: n % 2 ? ("OK" as const) : ("NA" as const) }));
    expect(precheckStatus(all)).toBe("OK");
    expect(precheckProgress(items)).toMatchObject({ done: 3, concerns: 1, ko: 1 });
  });

  it("Vorlage nachziehen behält erfasste Punkte", () => {
    const old = precheckTemplate("FEWO", "ES").map((i) => (i.key === "land_etv" ? { ...i, status: "OK" as const, note: "geprüft" } : i));
    const merged = mergePrecheck(old, precheckTemplate("APARTMENTHAUS", "ES"));
    expect(merged.find((i) => i.key === "land_etv")?.note).toBe("geprüft");
    expect(merged.some((i) => i.key === "segment_teilung")).toBe(true);
    expect(merged.some((i) => i.key === "segment_vermietung_erlaubt")).toBe(false);
  });

  it("Besichtigung: Durchschnitt der Bewertungen", () => {
    const items = inspectionTemplate();
    expect(averageRating(items)).toBeNull();
    items[0].rating = 4;
    items[1].rating = 3;
    items[2].rating = 9;
    expect(averageRating(items)).toBe(3.5);
  });
});

describe("Reisekosten", () => {
  it("Summen, abrechenbare Reisen, Pauschale", () => {
    const r = tripTotals(
      [
        { billable: true, costs: [{ category: "FLUG", amount: 320 }, { category: "HOTEL", amount: 240 }] },
        { billable: false, costs: [{ category: "AUTO", amount: 90 }] },
      ],
      450,
    );
    expect(r).toEqual({ actual: 650, byCategory: { FLUG: 320, HOTEL: 240, AUTO: 90 }, billableTrips: 1, flatTotal: 450, difference: -200 });
  });
});

describe("Vorlagen", () => {
  it("Platzhalter, Bedingungen, Leerstellen", () => {
    const body = "Käufer: {{kaeufer.name}}\nHonorar: {{honorar.erfolg}}\n{{#if honorar.grund}}Grundhonorar: {{honorar.grund}}{{/if}}\nOrt: {{ort}}";
    const r = renderTemplate(body, { kaeufer: { name: "Anna Muster" }, honorar: { erfolg: "18.500 €", grund: "" } });
    expect(r.text).toBe(`Käufer: Anna Muster\nHonorar: 18.500 €\n\nOrt: ${BLANK}`);
    expect(r.missing).toEqual(["ort"]);
    expect(placeholdersOf(body).sort()).toEqual(["honorar.erfolg", "honorar.grund", "kaeufer.name", "ort"]);
  });

  it("Markdown-Subset, HTML wird escaped", () => {
    const html = templateToHtml("# Titel\n\n## Teil\n\nText **fett** <script>\n\n- a\n- b");
    expect(html).toContain("<h1>Titel</h1>");
    expect(html).toContain("<h2>Teil</h2>");
    expect(html).toContain("<strong>fett</strong> &lt;script&gt;");
    expect(html).toContain("<ul><li>a</li><li>b</li></ul>");
  });
});

describe("Partnerbewertung", () => {
  it("Score und Durchschnitte", () => {
    expect(ratingScore({ reliability: 5, quality: 4, speed: 3 })).toBe(4);
    expect(averageRatings([{ reliability: 5, quality: 4, speed: 3 }, { reliability: 3, quality: 4, speed: 5 }])).toEqual({ score: 4, reliability: 4, quality: 4, speed: 4, count: 2 });
    expect(averageRatings([]).score).toBeNull();
    expect(validRating(3)).toBe(true);
    expect(validRating(6)).toBe(false);
    expect(hitRate(8, 2)).toBe(25);
    expect(hitRate(0, 0)).toBeNull();
  });
});

import { PARTNER_DICTS, tp } from "@/lib/i18n/partner";

describe("Partnerzugang mehrsprachig", () => {
  it("alle fünf Sprachen haben dieselben Schlüssel", () => {
    const keys = Object.keys(PARTNER_DICTS.de).sort();
    for (const d of Object.values(PARTNER_DICTS)) expect(Object.keys(d).sort()).toEqual(keys);
  });
  it("Platzhalter", () => {
    expect(tp("es", "hello", { name: "Ana" })).toBe("Bienvenido/a, Ana");
    expect(tp("fr", "thanks", { date: "12/11/2026" })).toContain("12/11/2026");
  });
});
