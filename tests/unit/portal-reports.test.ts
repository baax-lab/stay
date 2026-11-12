import { describe, expect, it } from "vitest";
import { accessState, extendExpiry, generatePortalToken, hashPortalToken, looksLikeToken, suggestProfileAdjustments } from "@/lib/portal";
import { groupRejected, previousMonth, rejectGroup } from "@/lib/reports";

describe("Portal-Token", () => {
  it("mindestens 32 Byte zufällig, nur Hash gespeichert", () => {
    const a = generatePortalToken();
    const b = generatePortalToken();
    expect(a.token).not.toBe(b.token);
    expect(Buffer.from(a.token, "base64url").length).toBe(32);
    expect(a.hash).toBe(hashPortalToken(a.token));
    expect(a.hash).not.toContain(a.token);
    expect(looksLikeToken(a.token)).toBe(true);
    expect(looksLikeToken("../../etc")).toBe(false);
  });

  it("Gültigkeit, Ablauf, Widerruf", () => {
    const now = new Date("2026-11-12T10:00:00Z");
    expect(accessState({ expiresAt: extendExpiry(now), revokedAt: null }, now)).toBe("valid");
    expect(extendExpiry(now).toISOString().slice(0, 10)).toBe("2026-12-12");
    expect(accessState({ expiresAt: new Date("2026-11-12T09:59:59Z"), revokedAt: null }, now)).toBe("expired");
    expect(accessState({ expiresAt: extendExpiry(now), revokedAt: now }, now)).toBe("revoked");
  });

  it("Ablehnungsgründe fließen als Vorschlag ins Suchprofil", () => {
    const s = suggestProfileAdjustments([{ category: "lage_touristisch" }, { category: "lage_touristisch" }, { category: "lage_touristisch" }, { category: "preis" }, { category: null }]);
    expect(s).toHaveLength(1);
    expect(s[0]).toMatchObject({ category: "lage_touristisch", count: 3 });
  });
});

describe("Suchbericht", () => {
  it("gruppiert Ablehnungsgründe", () => {
    expect(rejectGroup("Preis zu hoch")).toBe("Preis");
    expect(rejectGroup("Lizenz unklar oder fehlt")).toBe("Lizenz");
    expect(rejectGroup("Lage passt nicht: zu laut")).toBe("Lage");
    expect(rejectGroup("Zustand")).toBe("Zustand");
    expect(rejectGroup("Zahlen nicht plausibel")).toBe("Zahlen");
    expect(rejectGroup("Objekt verkauft")).toBe("Sonstiges");
    expect(rejectGroup("egal", "lage_touristisch")).toBe("Lage");
    const g = groupRejected([
      { propertyId: "a", title: "A", locality: null, price: 1, reason: "Preis zu hoch", by: "baax", group: "Preis" },
      { propertyId: "b", title: "B", locality: null, price: 1, reason: "zu touristisch", by: "kaeufer", group: "Lage" },
    ]);
    expect(Object.keys(g)).toEqual(["Preis", "Lage"]);
  });

  it("Vormonat", () => {
    const { start, end } = previousMonth(new Date(2026, 11, 1, 7, 30));
    expect(start).toEqual(new Date(2026, 10, 1));
    expect(end.getDate()).toBe(30);
    expect(end.getMonth()).toBe(10);
  });
});

import { parseEcbXml } from "@/lib/services/fx-parse";

describe("EZB-Kurse", () => {
  it("liest die Referenzkurse aus dem XML", () => {
    const xml = `<Cube time='2026-11-11'><Cube currency='USD' rate='1.0812'/><Cube currency='CHF' rate='0.9412'/></Cube>`;
    expect(parseEcbXml(xml)).toEqual({ USD: 1.0812, CHF: 0.9412 });
  });
});
