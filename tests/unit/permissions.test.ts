import { describe, expect, it } from "vitest";
import { assertCan, can, ForbiddenError, mapHubRole, roleAtLeast } from "@/lib/permissions";

describe("Rollen und Rechte (Konzept §4)", () => {
  it("Rangfolge", () => {
    expect(roleAtLeast("ADMIN", "LEITUNG")).toBe(true);
    expect(roleAtLeast("MITARBEITER", "LEITUNG")).toBe(false);
    expect(roleAtLeast("PRAKTIKANT", "PRAKTIKANT")).toBe(true);
  });

  it("Export nur Leitung und Admin", () => {
    expect(can.exportLeads("ADMIN")).toBe(true);
    expect(can.exportLeads("LEITUNG")).toBe(true);
    expect(can.exportLeads("MITARBEITER")).toBe(false);
    expect(can.exportLeads("PRAKTIKANT")).toBe(false);
  });

  it("Praktikant sieht keine Kontaktdetails, darf aber erfassen", () => {
    expect(can.createLead("PRAKTIKANT")).toBe(true);
    expect(can.viewLeadContactDetails("PRAKTIKANT")).toBe(false);
    expect(can.viewLeadContactDetails("MITARBEITER")).toBe(true);
    expect(can.editLead("PRAKTIKANT")).toBe(false);
  });

  it("Honorare und Systemeinstellungen", () => {
    expect(can.viewFees("MITARBEITER")).toBe(false);
    expect(can.viewFees("LEITUNG")).toBe(true);
    expect(can.systemSettings("LEITUNG")).toBe(false);
    expect(can.systemSettings("ADMIN")).toBe(true);
  });

  it("assertCan wirft ForbiddenError", () => {
    expect(() => assertCan("MITARBEITER", "exportLeads")).toThrow(ForbiddenError);
    expect(() => assertCan("ADMIN", "exportLeads")).not.toThrow();
  });
});

describe("Hub-Rollen-Mapping", () => {
  it("erkennt Bezeichnungen unabhängig von Groß-/Kleinschreibung", () => {
    expect(mapHubRole("admin")).toBe("ADMIN");
    expect(mapHubRole("Leitung")).toBe("LEITUNG");
    expect(mapHubRole("mitarbeiter")).toBe("MITARBEITER");
    expect(mapHubRole("praktikant")).toBe("PRAKTIKANT");
  });

  it("nimmt bei mehreren Rollen die höchste", () => {
    expect(mapHubRole(["mitarbeiter", "leitung"])).toBe("LEITUNG");
    expect(mapHubRole(["praktikant"])).toBe("PRAKTIKANT");
  });

  it("unbekannte Rolle → null (kein Zugang)", () => {
    expect(mapHubRole("gast")).toBeNull();
    expect(mapHubRole(undefined)).toBeNull();
    expect(mapHubRole(42)).toBeNull();
  });
});
