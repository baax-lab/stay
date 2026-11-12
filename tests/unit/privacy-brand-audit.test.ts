import { describe, expect, it } from "vitest";
import { decideLead, decideMandate, decidePartner, decideReferrer, matchesQuery, parsePrivacyQuery, retentionEnd, type MandateFacts } from "@/lib/privacy";
import { brandCss, brandPalette, mix, parseHex } from "@/lib/brand";
import { auditQuery, auditWhere, parseAuditFilter } from "@/lib/audit-filter";

const base: MandateFacts = {
  status: "ABGESCHLOSSEN",
  contractSignedAt: new Date("2026-01-10"),
  gwgIdentifiedAt: null,
  hasClosing: false,
  endDate: new Date("2026-06-30"),
  handoverDate: null,
  updatedAt: new Date("2026-07-01"),
};

describe("DSGVO-Regeln", () => {
  it("Frist endet am Schluss des Kalenderjahres", () => {
    expect(retentionEnd(new Date("2026-03-15"), 5).toISOString()).toBe("2031-12-31T23:59:59.000Z");
  });

  it("laufender Auftrag ist gesperrt", () => {
    expect(decideMandate({ ...base, status: "SUCHE" }).action).toBe("BLOCKED");
    expect(decideMandate({ ...base, status: "PAUSIERT" }).action).toBe("BLOCKED");
  });

  it("Erstgespräch ohne Vertrag darf anonymisiert werden", () => {
    expect(decideMandate({ ...base, status: "ERSTGESPRAECH", contractSignedAt: null }).action).toBe("ANONYMIZE");
    expect(decideMandate({ ...base, status: "ERSTGESPRAECH" }).action).toBe("BLOCKED");
  });

  it("GwG-Fall wird 5 Jahre aufbewahrt, danach anonymisiert", () => {
    const m = { ...base, gwgIdentifiedAt: new Date("2026-02-01") };
    const d = decideMandate(m, new Date("2027-01-01"));
    expect(d.action).toBe("RETAIN");
    expect(d.retainUntil?.toISOString().slice(0, 10)).toBe("2031-12-31");
    expect(decideMandate(m, new Date("2032-01-01")).action).toBe("ANONYMIZE");
  });

  it("Kauf ohne Enddatum nutzt die Übergabe", () => {
    const d = decideMandate({ ...base, hasClosing: true, endDate: null, handoverDate: new Date("2027-05-01") }, new Date("2030-01-01"));
    expect(d.retainUntil?.getUTCFullYear()).toBe(2032);
  });

  it("beendeter Auftrag ohne GwG wird anonymisiert", () => {
    expect(decideMandate({ ...base, status: "BEENDET_OHNE_KAUF" }).action).toBe("ANONYMIZE");
  });

  it("Lead folgt dem Auftrag oder wird gelöscht", () => {
    expect(decideLead(null).action).toBe("DELETE");
    expect(decideLead({ action: "RETAIN", reason: "x" }).action).toBe("RETAIN");
  });

  it("Tippgeber mit Auszahlung 10 Jahre", () => {
    expect(decideReferrer([null, new Date("2026-05-01")], new Date("2030-01-01")).action).toBe("RETAIN");
    expect(decideReferrer([new Date("2010-05-01")], new Date("2030-01-01")).action).toBe("ANONYMIZE");
    expect(decideReferrer([]).action).toBe("ANONYMIZE");
    expect(decidePartner().action).toBe("ANONYMIZE");
  });

  it("Suchbegriff wird gedeutet", () => {
    expect(parsePrivacyQuery("  Max@Example.com ")?.email).toBe("max@example.com");
    expect(parsePrivacyQuery("+49 171 555-0000")?.phoneNorm).toBe("491715550000");
    expect(parsePrivacyQuery("0171 5550000")?.phoneNorm).toBe("491715550000");
    expect(parsePrivacyQuery("Müller")?.text).toBe("Müller");
    expect(parsePrivacyQuery("ab")).toBeNull();
  });

  it("Treffer über E-Mail, Telefon, Name oder Hub-ID", () => {
    expect(matchesQuery(parsePrivacyQuery("max@example.com")!, { email: "MAX@example.com" })).toBe(true);
    expect(matchesQuery(parsePrivacyQuery("+491715550000")!, { phone: "0171 / 555 0000" })).toBe(true);
    expect(matchesQuery(parsePrivacyQuery("hub-123")!, { hubContactId: "hub-123", name: "X" })).toBe(true);
    expect(matchesQuery(parsePrivacyQuery("müll")!, { name: "Familie Müller" })).toBe(true);
    expect(matchesQuery(parsePrivacyQuery("meier")!, { name: "Müller" })).toBe(false);
  });
});

describe("Hausfarbe", () => {
  it("prüft Hex-Werte", () => {
    expect(parseHex("19B5D4")).toBe("#19b5d4");
    expect(parseHex("#abc")).toBe("#aabbcc");
    expect(parseHex("red")).toBeNull();
    expect(parseHex("#12345g")).toBeNull();
  });

  it("leitet helle und kräftige Variante ab", () => {
    expect(mix("#000000", 1)).toBe("#ffffff");
    expect(mix("#ffffff", -1)).toBe("#000000");
    const p = brandPalette("#19b5d4")!;
    expect(p.soft > p.brand).toBe(true);
    expect(p.strong).toBe("#1491aa");
  });

  it("liefert CSS nur für gültige Werte (kein Einschleusen)", () => {
    expect(brandCss("")).toBe("");
    expect(brandCss("#000;}body{display:none")).toBe("");
    expect(brandCss("#19b5d4")).toContain("--brand:#19b5d4");
  });
});

describe("Protokollfilter", () => {
  it("übernimmt nur gültige Werte", () => {
    const f = parseAuditFilter({ action: "LEAD_EXPORT", entity: "Lead'; drop", from: "2026-11-01", to: "2026-11-12", page: "3" });
    expect(f.action).toBe("LEAD_EXPORT");
    expect(f.entity).toBeUndefined();
    expect(f.page).toBe(3);
    expect(f.to!.getDate()).toBe(13);
    const w = auditWhere(f);
    expect(w.createdAt?.gte).toEqual(f.from);
    expect(w).not.toHaveProperty("entity");
  });

  it("baut Query-Strings für Seitenwechsel", () => {
    expect(auditQuery({ action: "LOGIN", page: "2" }, { page: 3 })).toBe("?action=LOGIN&page=3");
    expect(auditQuery({}, {})).toBe("");
  });
});

import { parseLegalText } from "@/lib/legal";

describe("Rechtstexte", () => {
  it("erkennt Überschriften, Absätze und Fettdruck", () => {
    const b = parseLegalText("## Verantwortlich\nBaax **GmbH**\nZeile 2\n\n<script>x</script>");
    expect(b[0]).toEqual({ type: "h", text: "Verantwortlich" });
    expect(b[1]).toEqual({ type: "p", parts: [{ text: "Baax ", bold: false }, { text: "GmbH", bold: true }, { text: "\nZeile 2", bold: false }] });
    expect(b[2]).toEqual({ type: "p", parts: [{ text: "<script>x</script>", bold: false }] });
  });
  it("leerer Text ergibt keine Blöcke", () => {
    expect(parseLegalText("  \n\n ")).toEqual([]);
  });
});

import { serviceWorkerSource } from "@/lib/sw-script";

describe("Service Worker", () => {
  it("ist gültiges JavaScript mit eingesetzter Version", () => {
    const src = serviceWorkerSource('1.2.3"; alert(1); "');
    expect(() => new Function(src)).not.toThrow();
    expect(src).toContain('const VERSION = "1.2.3\\"; alert(1); \\"";');
  });
  it("cacht keine API, Dateien, Anmeldung oder Portal", () => {
    const src = serviceWorkerSource("x");
    for (const p of ["/api/", "/auth/", "/portal/", "/partner-zugang/"]) expect(src).toContain(`"${p}"`);
  });
});
