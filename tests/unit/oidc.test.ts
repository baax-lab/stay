import { describe, expect, it } from "vitest";
import { dueInDays, hubErrorMessage, issuerMatches, leadToHubContactInput, pkceChallenge, roleFromHubClaims, safeEqual, safeTarget, splitName } from "@/lib/oidc";

describe("Anmelde-Einstieg", () => {
  it("prüft den Aussteller, Schrägstrich am Ende egal", () => {
    expect(issuerMatches("https://hub.baax.de/", "https://hub.baax.de")).toBe(true);
    expect(issuerMatches("https://hub.baax.de", "https://hub.baax.de/")).toBe(true);
    expect(issuerMatches("https://evil.example", "https://hub.baax.de")).toBe(false);
    expect(issuerMatches(null, "https://hub.baax.de")).toBe(false);
    expect(issuerMatches("", "")).toBe(false);
  });

  it("übernimmt nur Ziele der eigenen App", () => {
    const app = "https://stay.baax.de";
    expect(safeTarget("https://stay.baax.de/auftraege/abc?tab=profil", app)).toBe("/auftraege/abc?tab=profil");
    expect(safeTarget("https://evil.example/auftraege", app)).toBe("/");
    expect(safeTarget("//evil.example/x", app)).toBe("/");
    expect(safeTarget("/leads", app)).toBe("/leads");
    expect(safeTarget("https://stay.baax.de/auth/hub?iss=x", app)).toBe("/");
    expect(safeTarget("javascript:alert(1)", app)).toBe("/");
    expect(safeTarget(null, app)).toBe("/");
  });
});

describe("PKCE und Tokens", () => {
  it("berechnet S256 nach RFC 7636 (Anhang B)", async () => {
    expect(await pkceChallenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk")).toBe("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
  });

  it("vergleicht Tokens unabhängig von der Länge sicher", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
    expect(safeEqual("abc", "abcd")).toBe(false);
    expect(safeEqual("", "")).toBe(true);
  });
});

describe("Rollen aus dem Hub", () => {
  it("übersetzt die Hub-Rollen", () => {
    expect(roleFromHubClaims({ role: "ADMIN" })).toBe("ADMIN");
    expect(roleFromHubClaims({ role: "MANAGEMENT" })).toBe("LEITUNG");
    expect(roleFromHubClaims({ role: "TEAMLEAD" })).toBe("MITARBEITER");
    expect(roleFromHubClaims({ role: "EMPLOYEE" })).toBe("MITARBEITER");
    expect(roleFromHubClaims({ role: "GAST" })).toBeNull();
  });

  it("Praktikanten-Kennzeichen geht vor, außer bei Admin", () => {
    expect(roleFromHubClaims({ role: "EMPLOYEE", intern: true })).toBe("PRAKTIKANT");
    expect(roleFromHubClaims({ role: "MANAGEMENT", intern: true })).toBe("PRAKTIKANT");
    expect(roleFromHubClaims({ role: "ADMIN", intern: true })).toBe("ADMIN");
  });

  it("zeigt verständliche Fehler", () => {
    expect(hubErrorMessage("access_denied")).toContain("Kein Zugang");
    expect(hubErrorMessage("irgendwas")).toContain("erneut über den Hub");
  });
});

describe("Kontakt für die Hub-API", () => {
  it("teilt Namen, Nachname ist Pflicht", () => {
    expect(splitName("Anna Maria Huber")).toEqual({ firstName: "Anna Maria", lastName: "Huber" });
    expect(splitName("Huber")).toEqual({ firstName: null, lastName: "Huber" });
    expect(splitName("  ")).toEqual({ firstName: null, lastName: "Unbekannt" });
  });

  it("baut den Kontakt mit Rolle, Herkunft und ohne Newsletter-Einwilligung", () => {
    const c = leadToHubContactInput({
      name: "Anna Huber",
      company: "Bergblick GmbH",
      email: "anna@example.com",
      phone: null,
      role: "VERKAEUFER",
      sourceLabel: "Messe",
      sourceDetail: "SuperStay LIVE 2026",
      segmentLabel: null,
      interest: "Pension am See",
      note: null,
    });
    expect(c).toMatchObject({ firstName: "Anna", lastName: "Huber", companyName: "Bergblick GmbH", roles: ["OWNER"], dataSource: "Baax Stay: Messe – SuperStay LIVE 2026", notes: "Interesse: Pension am See" });
    expect(c).not.toHaveProperty("consentNewsletter");
    expect(c.tags).toEqual(["Baax Stay", "Messe"]);
  });

  it("rechnet Fälligkeiten in Tage um", () => {
    const now = new Date("2026-11-13T10:00:00Z");
    expect(dueInDays("2026-11-15T09:00:00Z", now)).toBe(2);
    expect(dueInDays("2026-11-01T09:00:00Z", now)).toBe(0);
    expect(dueInDays("kaputt", now)).toBe(0);
  });
});
