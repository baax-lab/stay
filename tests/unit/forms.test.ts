import { describe, expect, it } from "vitest";
import { formatNumberDe, parseNumberDe } from "@/lib/numbers";
import { formatDistance, mapsLink, oneOf, TIME_HORIZONS } from "@/lib/form-options";
import { profileFromLead } from "@/lib/profile-prefill";

describe("Zahlen in Formularen", () => {
  it("formatiert mit Tausenderpunkten", () => {
    expect(formatNumberDe(1250000)).toBe("1.250.000");
    expect(formatNumberDe(null)).toBe("");
    expect(formatNumberDe(72.5, 1)).toBe("72,5");
  });

  it("liest gängige Schreibweisen", () => {
    expect(parseNumberDe("1.250.000")).toBe(1250000);
    expect(parseNumberDe("1250000")).toBe(1250000);
    expect(parseNumberDe("1.250.000,50")).toBe(1250000.5);
    expect(parseNumberDe("€ 700.000")).toBe(700000);
    expect(parseNumberDe("700 000")).toBe(700000);
    expect(parseNumberDe("72,5")).toBe(72.5);
    expect(parseNumberDe("72.5")).toBe(72.5);
    expect(parseNumberDe("65 %")).toBe(65);
  });

  it("weist Unsinn zurück", () => {
    expect(parseNumberDe("")).toBeNull();
    expect(parseNumberDe("abc")).toBeNull();
    expect(parseNumberDe("1.2.3")).toBeNull();
    expect(parseNumberDe("1,2,3")).toBeNull();
  });
});

describe("Auswahlwerte und Karte", () => {
  it("übernimmt nur bekannte Werte", () => {
    expect(oneOf(TIME_HORIZONS, "MONATE_6")).toBe("MONATE_6");
    expect(oneOf(TIME_HORIZONS, "BALD")).toBeNull();
    expect(oneOf(TIME_HORIZONS, { not: "" })).toBeNull();
  });

  it("baut den Kartenlink", () => {
    expect(mapsLink({ mapUrl: "https://maps.app.goo.gl/abc" })).toBe("https://maps.app.goo.gl/abc");
    expect(mapsLink({ mapUrl: "javascript:alert(1)", locality: "Palma", country: "ES" })).toContain("query=Palma%2C%20ES");
    expect(mapsLink({ address: "Carrer 1", locality: "Sóller", country: "ES" })).toContain(encodeURIComponent("Carrer 1, Sóller, ES"));
    expect(mapsLink({ country: "ES" })).toBeNull();
  });

  it("zeigt Entfernungen lesbar", () => {
    expect(formatDistance(350)).toBe("350 m");
    expect(formatDistance(1500)).toBe("1,5 km");
    expect(formatDistance(1500, "en")).toBe("1.5 km");
    expect(formatDistance(25000)).toBe("25 km");
    expect(formatDistance(null)).toBeNull();
  });
});

describe("Suchprofil aus Lead", () => {
  const regions = [
    { key: "es-mallorca", name: "Mallorca", country: "ES" },
    { key: "it-suedtirol", name: "Südtirol", country: "IT" },
  ];
  const countries = [
    { code: "ES", name: "Spanien" },
    { code: "AT", name: "Österreich" },
  ];

  it("ordnet Regionen und Länder zu", () => {
    const p = profileFromLead({ segment: "FEWO", regions: ["mallorca", "Suedtirol", "Österreich", "Toskana"], budgetMin: 300000, budgetMax: 1000000 }, regions, countries);
    expect(p.regions).toEqual(["es-mallorca", "it-suedtirol"]);
    expect(p.countries.sort()).toEqual(["AT", "ES", "IT"]);
    expect(p.unmatched).toEqual(["Toskana"]);
    expect(p.segments).toEqual(["FEWO"]);
    expect(p.priceMax).toBe(1000000);
  });

  it("übernimmt Zeithorizont und Finanzierung als Text", () => {
    const p = profileFromLead({ segment: null, regions: [], budgetMin: null, budgetMax: null, timeHorizon: "MONATE_6", financing: "FINANZIERUNG" }, regions, countries);
    expect(p.horizon).toBe("innerhalb von 6 Monaten");
    expect(p.financing).toBe("Finanzierung geplant");
    expect(p.priceMax).toBe(1000000);
  });

  it("ignoriert unbekannte Werte", () => {
    const p = profileFromLead({ segment: null, regions: [], budgetMin: null, budgetMax: null, timeHorizon: "<b>", financing: "x" }, regions, countries);
    expect(p.horizon).toBeNull();
    expect(p.financing).toBeNull();
  });
});

import { parseImageDataUrl } from "@/lib/data-url";
import { leadToHubContactInput } from "@/lib/oidc";

describe("Visitenkartenfoto", () => {
  const jpeg = "data:image/jpeg;base64," + Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]).toString("base64");
  it("nimmt echte Bilder an", () => {
    const r = parseImageDataUrl(jpeg);
    expect(r?.mime).toBe("image/jpeg");
    expect(r?.bytes.length).toBe(7);
  });
  it("weist falsche Typen, falsche Köpfe und zu große Bilder ab", () => {
    expect(parseImageDataUrl("data:text/html;base64,PGI+")).toBeNull();
    expect(parseImageDataUrl("data:image/png;base64," + Buffer.from("not a png").toString("base64"))).toBeNull();
    expect(parseImageDataUrl("data:image/svg+xml;base64,PHN2Zz4=")).toBeNull();
    expect(parseImageDataUrl(jpeg, 3)).toBeNull();
    expect(parseImageDataUrl({})).toBeNull();
  });
});

describe("Kontakt für den Hub mit Zusatzangaben", () => {
  it("schreibt Sprache und Rückruf in die Notiz", () => {
    const c = leadToHubContactInput({ name: "Ana López", company: null, email: null, phone: "+34 600", role: "KAEUFER", sourceLabel: "Messe", sourceDetail: null, segmentLabel: null, interest: null, note: null, extras: ["Sprache: Spanisch", "Rückrufwunsch: 20.11.2026, 10:00"] });
    expect(c.notes).toBe("Sprache: Spanisch\nRückrufwunsch: 20.11.2026, 10:00");
  });
});

import { leadExtras } from "@/lib/form-options";

describe("Zusatzangaben am Lead", () => {
  it("fasst sie lesbar zusammen und ignoriert Unbekanntes", () => {
    expect(leadExtras({ language: "es", callbackAt: "2026-11-20T09:00:00Z", contactChannel: "WHATSAPP", timeHorizon: "SOFORT", financing: "OFFEN" })).toEqual([
      "Sprache: Spanisch",
      "Rückrufwunsch: 20.11.26, 10:00",
      "Bevorzugter Kontaktweg: WhatsApp",
      "Zeithorizont: so bald wie möglich",
      "Finanzierung: noch offen",
    ]);
    expect(leadExtras({ language: "xx", contactChannel: "FAX" })).toEqual([]);
  });
});
