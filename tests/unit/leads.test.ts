import { describe, expect, it } from "vitest";
import { BUDGET_BANDS, bandFromBudget, budgetFromBand, csvCell, formatBudget, leadInputFromFormData, leadInputSchema, normalizeEmail, normalizePhone } from "@/lib/leads";

describe("Budget-Bänder", () => {
  it("bildet Auswahl auf min/max ab und zurück", () => {
    for (const b of BUDGET_BANDS) {
      const { budgetMin, budgetMax } = budgetFromBand(b.key);
      expect(budgetMin).toBe(b.min);
      expect(budgetMax).toBe(b.max);
      expect(bandFromBudget(budgetMin, budgetMax)).toBe(b.key);
    }
    expect(budgetFromBand(null)).toEqual({ budgetMin: null, budgetMax: null });
  });

  it("formatiert Budgets lesbar", () => {
    expect(formatBudget(null, 300_000)).toBe("bis 300 T€");
    expect(formatBudget(1_000_000, 3_000_000)).toBe("1 – 3 Mio. €");
    expect(formatBudget(null, null)).toBe("–");
    expect(formatBudget(500_000, null)).toBe("ab 500 T€");
  });
});

describe("Normalisierung für Dubletten", () => {
  it("E-Mail klein und getrimmt", () => {
    expect(normalizeEmail("  Max@Firma.DE ")).toBe("max@firma.de");
    expect(normalizeEmail("")).toBeNull();
  });

  it("Telefon in verschiedenen Schreibweisen gleich", () => {
    const a = normalizePhone("+49 171 1234567");
    expect(normalizePhone("0171 / 123 45 67")).toBe(a);
    expect(normalizePhone("0049-171-1234567")).toBe(a);
    expect(normalizePhone("(0171) 1234567")).toBe(a);
    expect(a).toBe("491711234567");
    expect(normalizePhone("+34 971 123456")).toBe("34971123456");
    expect(normalizePhone("")).toBeNull();
  });
});

describe("Lead-Validierung", () => {
  const base = { name: "Anna Muster", role: "KAEUFER", source: "MESSE" } as const;

  it("verlangt Telefon oder E-Mail", () => {
    const r = leadInputSchema.safeParse({ ...base });
    expect(r.success).toBe(false);
    expect(leadInputSchema.safeParse({ ...base, phone: "0171 1234567" }).success).toBe(true);
    expect(leadInputSchema.safeParse({ ...base, email: "anna@beispiel.de" }).success).toBe(true);
  });

  it("lehnt ungültige E-Mail ab und leert leere Strings", () => {
    expect(leadInputSchema.safeParse({ ...base, email: "keine-mail" }).success).toBe(false);
    const r = leadInputSchema.parse({ ...base, phone: "0171", company: "", note: "   " });
    expect(r.company).toBeNull();
    expect(r.note).toBeNull();
    expect(r.regions).toEqual([]);
    expect(r.consentEmail).toBe(false);
  });

  it("liest FormData ein", () => {
    const fd = new FormData();
    fd.set("name", "Jon Doe");
    fd.set("role", "VERKAEUFER");
    fd.set("source", "MESSE");
    fd.set("phone", "0171 1");
    fd.set("regions", "Mallorca, Südtirol");
    fd.set("consentEmail", "on");
    fd.set("budgetBand", "300-1000");
    const input = leadInputFromFormData(fd);
    expect(input.regions).toEqual(["Mallorca", "Südtirol"]);
    expect(input.consentEmail).toBe(true);
    const parsed = leadInputSchema.parse(input);
    expect(parsed.budgetBand).toBe("300-1000");
  });
});

describe("CSV", () => {
  it("escaped Trennzeichen, Anführungszeichen und Formeln", () => {
    expect(csvCell("Müller; Max")).toBe('"Müller; Max"');
    expect(csvCell('Sagt "Hallo"')).toBe('"Sagt ""Hallo"""');
    expect(csvCell("=SUMME(A1)")).toBe("'=SUMME(A1)");
    expect(csvCell(["Mallorca", "Ibiza"])).toBe("Mallorca, Ibiza");
    expect(csvCell(null)).toBe("");
    expect(csvCell(42)).toBe("42");
  });
});
