import { describe, expect, it } from "vitest";
import de from "@/lib/i18n/de.json";
import en from "@/lib/i18n/en.json";
import { fmtMoney, t } from "@/lib/i18n";

function keys(o: object, prefix = ""): string[] {
  return Object.entries(o).flatMap(([k, v]) => (v && typeof v === "object" ? keys(v, `${prefix}${k}.`) : [`${prefix}${k}`]));
}

describe("i18n", () => {
  it("Deutsch und Englisch haben dieselben Schlüssel", () => {
    expect(keys(en).sort()).toEqual(keys(de).sort());
  });

  it("ersetzt Platzhalter und fällt auf den Schlüssel zurück", () => {
    expect(t("de", "portal.hello", { name: "Anna" })).toBe("Willkommen, Anna");
    expect(t("en", "portal.hello", { name: "Anna" })).toBe("Welcome, Anna");
    expect(t("en", "gibt.es.nicht")).toBe("gibt.es.nicht");
  });

  it("formatiert Beträge je Sprache", () => {
    expect(fmtMoney("de", 850000)).toMatch(/850\.000\s?€/);
    expect(fmtMoney("en", 850000)).toBe("€850,000");
  });
});
