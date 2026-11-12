import { test, expect, type Page } from "@playwright/test";

/** Abnahme Phase 1: Ein Suchauftrag läuft von Lead bis GEKAUFT durch (Konzept §8). */

async function devLogin(page: Page, role: "ADMIN" | "LEITUNG" | "MITARBEITER" | "PRAKTIKANT", name = "Test Person") {
  await page.goto("/auth/dev?next=/");
  await page.getByRole("textbox", { name: "Name" }).fill(name);
  await page.getByLabel("Rolle").selectOption(role);
  await page.getByRole("button", { name: "Anmelden" }).click();
  await page.waitForURL((url) => url.pathname === "/", { timeout: 60_000 });
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 60_000 });
}

test.describe.configure({ mode: "serial" });

test.beforeAll(async ({ request }) => {
  for (const path of ["/auth/login", "/auth/dev", "/auftraege", "/objekte"]) await request.get(path);
});

test("Lead bis Kauf: Umwandeln, GwG, Suchprofil, Objekt, Treffer, Vorstellung, Angebot, Kauf, Honorar", async ({ page }) => {
  test.setTimeout(240_000);
  const uniq = Date.now().toString().slice(-6);
  await devLogin(page, "LEITUNG", "Lena Leitung");

  // 1. Käufer-Lead anlegen und in Suchauftrag umwandeln
  const created = await page.request.post("/api/leads", {
    data: { name: `Kurt Käufer ${uniq}`, role: "KAEUFER", source: "MESSE", sourceDetail: "SuperStay LIVE 2026", email: `kurt${uniq}@beispiel.de`, segment: "FEWO", regions: ["Mallorca"], budgetBand: "300-1000" },
  });
  const { id: leadId } = (await created.json()) as { id: string };
  await page.goto(`/leads/${leadId}`);
  await page.getByRole("button", { name: "In Suchauftrag umwandeln" }).click();
  await page.waitForURL(/\/auftraege\/[^/?]+\?tab=erstgespraech/);
  const mandateUrl = page.url().split("?")[0];

  // Lead ist UMGEWANDELT
  await page.goto(`/leads/${leadId}`);
  await expect(page.getByText("Umgewandelt").first()).toBeVisible();

  // 2. BEAUFTRAGT ohne GwG nicht möglich
  await page.goto(mandateUrl);
  await page.getByRole("button", { name: "→ Beauftragt" }).click();
  await expect(page.getByText("GwG-Identifizierung fehlt")).toBeVisible();
  await page.getByRole("button", { name: /Status auf „Beauftragt“ setzen/ }).click();
  await expect(page.getByText("GwG-Identifizierung fehlt (Pflicht vor Beauftragung)")).toBeVisible();

  // GwG eintragen, dann BEAUFTRAGT
  await page.getByLabel("Art").selectOption("Video-Ident");
  await page.locator("form").filter({ hasText: "Art" }).filter({ hasText: "Datum" }).getByRole("button", { name: "Speichern" }).click();
  await expect(page.getByText(/Identifiziert am/)).toBeVisible();
  await page.getByRole("button", { name: "→ Beauftragt" }).click();
  await page.getByRole("button", { name: /Status auf „Beauftragt“ setzen/ }).click();
  await expect(page.getByText("Status geändert.")).toBeVisible();

  // 3. Suchprofil pflegen: FeWo, ES, Mallorca, bis 900.000, Lizenz Pflicht, Wunsch Pool
  await page.goto(`${mandateUrl}?tab=profil`);
  await page.getByRole("checkbox", { name: "Ferienwohnung" }).click();
  await page.getByRole("checkbox", { name: "Spanien" }).click();
  await page.getByRole("checkbox", { name: "Mallorca" }).click();
  await page.getByRole("textbox", { name: "Preis bis (€)" }).fill("900000");
  await page.locator("tr", { hasText: "Pool" }).getByRole("radio").nth(2).check();
  await page.getByRole("checkbox", { name: "Suchprofil aktiv" }).check();
  await page.getByRole("button", { name: /Suchprofil speichern/ }).click();
  await expect(page.getByText(/Suchprofil gespeichert/)).toBeVisible();

  // 4. Objekt erfassen → Treffer mit Begründung
  await page.goto("/objekte/neu");
  await page.getByRole("textbox", { name: "Titel" }).fill(`E2E FeWo Pollença ${uniq}`);
  await page.getByLabel("Land").selectOption("ES");
  await page.getByLabel("Region").selectOption("es-mallorca");
  await page.getByRole("textbox", { name: "Ort" }).fill("Port de Pollença");
  await page.getByRole("textbox", { name: "Angebotspreis" }).fill("850000");
  await page.getByRole("radio", { name: "vorhanden", exact: true }).click();
  await page.getByRole("checkbox", { name: "Pool", exact: true }).click();
  await page.getByRole("checkbox", { name: "Meerblick" }).click();
  await page.getByRole("textbox", { name: "Woher bekannt" }).fill("Partner Mallorca Homes");
  await page.getByRole("button", { name: "Objekt anlegen" }).click();
  await page.waitForURL(/\/objekte\/[^/?]+\?neu=1/);
  const propertyUrl = page.url().split("?")[0];

  // Treffer am Objekt und am Auftrag
  await page.goto(`${propertyUrl}?tab=treffer`);
  await expect(page.getByText(`FeWo Mallorca Kurt Käufer ${uniq}`).first()).toBeVisible();
  await page.goto(`${mandateUrl}?tab=treffer`);
  const card = page.locator("div.rounded-2xl", { hasText: `E2E FeWo Pollença ${uniq}` }).first();
  await expect(card).toBeVisible();
  await card.getByRole("button", { name: "Begründung" }).click();
  await expect(card.getByText("Region passt")).toBeVisible();
  await expect(card.getByText("Pool (Wunsch 3)")).toBeVisible();

  // 5. An Käufer vorstellen → Presentation mit eingefrorenem Preis
  // Leitung darf auch als nachrangiger Käufer vorstellen (Freigabe), falls Restdaten früherer Läufe Vorrang haben
  await card.getByRole("button", { name: /An Käufer/ }).click();
  await card.getByRole("button", { name: /vorstellen$/ }).click();
  await expect(card.getByText(/Angebotspreis eingefroren: 850.000 €/)).toBeVisible();

  // 6. Angebot mit Gegenangebot
  await page.goto(`${mandateUrl}?tab=angebote`);
  await page.getByRole("textbox", { name: "Betrag (€)" }).fill("780000");
  await page.getByRole("button", { name: "Angebot erfassen" }).click();
  await expect(page.getByText("Angebot erfasst.")).toBeVisible();
  await page.getByLabel("Antwort des Verkäufers").selectOption("GEGENANGEBOT");
  await page.getByRole("textbox", { name: "Gegenangebot (€)" }).fill("800000");
  await page.locator("form").filter({ hasText: "Antwort des Verkäufers" }).getByRole("button", { name: "Speichern" }).click();
  await expect(page.getByText(/Ersparnis 50.000 €/)).toBeVisible();

  // 7. Status bis GEKAUFT mit Kaufpreis 800.000
  for (const s of ["Analyse", "Suche", "Prüfung", "Verhandlung"]) {
    await page.goto(mandateUrl);
    await page.getByRole("button", { name: `→ ${s}` }).click();
    await page.getByRole("button", { name: new RegExp(`Status auf „${s}“ setzen`) }).click();
    await expect(page.getByText("Status geändert.")).toBeVisible();
  }
  await page.goto(mandateUrl);
  await page.getByRole("button", { name: "→ Gekauft" }).click();
  await page.getByRole("textbox", { name: "Kaufpreis (€)" }).fill("800000");
  await page.getByRole("button", { name: /Status auf „Gekauft“ setzen/ }).click();
  await expect(page.getByText("Status geändert.")).toBeVisible();

  // 8. Honorar: Bonus 10 % von 50.000 = 5.000 (Deckel 25 % vom Erfolgshonorar 18.500 = 4.625 → 4.625)
  await page.goto(`${mandateUrl}?tab=honorar`);
  await expect(page.getByText("Ersparnis", { exact: true })).toBeVisible();
  await expect(page.getByText("50.000 €").first()).toBeVisible();
  await expect(page.getByText("4.625 €").first()).toBeVisible();

  // Kaufabwicklung mit spanischer Checkliste wurde angelegt
  await page.goto(`${mandateUrl}?tab=kauf`);
  await expect(page.getByText("NIE (Steuernummer) beantragt")).toBeVisible();

  // Verlauf enthält Statuswechsel und Vorstellung
  await page.goto(`${mandateUrl}?tab=verlauf`);
  await expect(page.getByText("Objekt vorgestellt").first()).toBeVisible();
  await expect(page.getByText("Verhandlung → Gekauft")).toBeVisible();

  // Objekt ist verkauft
  await page.goto(propertyUrl);
  await expect(page.getByText("verkauft", { exact: true }).first()).toBeVisible();
});

test("Mitarbeiter sieht keine Honorare; Praktikant keine Käuferdetails", async ({ page }) => {
  await devLogin(page, "MITARBEITER", "Max Mitarbeiter");
  const mandate = await page.request.get("/auftraege");
  expect(mandate.ok()).toBeTruthy();
  await page.goto("/auftraege");
  const first = page.locator("a[href^='/auftraege/c']").first();
  await first.click();
  await page.waitForURL(/\/auftraege\/c[^/?]+/);
  await expect(page.getByRole("link", { name: "Honorar" })).toHaveCount(0);
  const url = page.url().split("?")[0];
  const forbidden = await page.request.get(`${url}?tab=honorar`);
  const html = await forbidden.text();
  expect(html).toContain("nur für Leitung und Admin");

  await devLogin(page, "PRAKTIKANT", "Paula Praktikantin");
  await page.goto(url);
  await expect(page.getByText("Kontaktdaten sind für Ihre Rolle nicht sichtbar")).toBeVisible();
});

test("Vorrang: Objekt passt zu zwei Käufern, zweiter nur nach Freigabe", async ({ page }) => {
  test.setTimeout(180_000);
  const uniq = Date.now().toString().slice(-6);
  await devLogin(page, "MITARBEITER", "Max Mitarbeiter");

  // Zwei Suchaufträge mit gleichem Profil per UI anlegen
  const mandateIds: string[] = [];
  for (const n of ["Erster", "Zweiter"]) {
    await page.goto("/auftraege/neu");
    await page.getByRole("textbox", { name: "Käufer (Name)" }).fill(`${n} Käufer ${uniq}`);
    await page.getByRole("textbox", { name: "Titel des Suchauftrags" }).fill(`${n} Südtirol ${uniq}`);
    await page.getByRole("button", { name: "Anlegen und Erstgespräch starten" }).click();
    await page.waitForURL(/\/auftraege\/c[^/?]+/);
    const id = page.url().split("/").pop()!.split("?")[0];
    mandateIds.push(id);
    await page.goto(`/auftraege/${id}?tab=profil`);
    await page.getByRole("checkbox", { name: "Pension / kleines Hotel" }).click();
    await page.getByRole("checkbox", { name: "Italien" }).click();
    await page.getByRole("textbox", { name: "Preis bis (€)" }).fill("3000000");
    await page.getByRole("checkbox", { name: "Vermietungslizenz erforderlich" }).uncheck();
    await page.getByRole("checkbox", { name: "Suchprofil aktiv" }).check();
    await page.getByRole("button", { name: /Suchprofil speichern/ }).click();
    await expect(page.getByText(/Suchprofil gespeichert/)).toBeVisible();
    // GwG + Beauftragt (Vorrang nach Beauftragungsdatum)
    await page.goto(`/auftraege/${id}`);
    await page.locator("form").filter({ hasText: "Art" }).filter({ hasText: "Datum" }).getByRole("button", { name: "Speichern" }).click();
    await expect(page.getByText(/Identifiziert am/)).toBeVisible();
    await page.getByRole("button", { name: "→ Beauftragt" }).click();
    await page.getByRole("button", { name: /Status auf „Beauftragt“ setzen/ }).click();
    await expect(page.getByText("Status geändert.")).toBeVisible();
  }

  // Objekt
  await page.goto("/objekte/neu");
  await page.getByRole("textbox", { name: "Titel" }).fill(`E2E Pension Südtirol ${uniq}`);
  await page.getByRole("radio", { name: "Pension / kleines Hotel" }).click();
  await page.getByLabel("Land").selectOption("IT");
  await page.getByLabel("Region").selectOption("it-suedtirol");
  await page.getByRole("textbox", { name: "Angebotspreis" }).fill("2500000");
  await page.getByRole("button", { name: "Objekt anlegen" }).click();
  await page.waitForURL(/\/objekte\/[^/?]+\?neu=1/);

  // Zweiter Käufer: Mitarbeiter darf nicht vorstellen
  await page.goto(`/auftraege/${mandateIds[1]}?tab=treffer`);
  const card2 = page.locator("div.rounded-2xl", { hasText: `E2E Pension Südtirol ${uniq}` }).first();
  await expect(card2.getByText(/Rang \d+ von \d+/)).toBeVisible();
  await expect(card2.getByRole("button", { name: "An Käufer (mit Freigabe)" })).toBeDisabled();

  // Leitung gibt frei
  await devLogin(page, "LEITUNG", "Lena Leitung");
  await page.goto(`/auftraege/${mandateIds[1]}?tab=treffer`);
  const card3 = page.locator("div.rounded-2xl", { hasText: `E2E Pension Südtirol ${uniq}` }).first();
  await card3.getByRole("button", { name: "An Käufer (mit Freigabe)" }).click();
  await card3.getByRole("button", { name: "Freigeben und vorstellen" }).click();
  await expect(card3.getByText(/Angebotspreis eingefroren/).first()).toBeVisible();
  await page.goto(`/auftraege/${mandateIds[1]}?tab=verlauf`);
  await expect(page.getByText("Freigabe zweiter Käufer").first()).toBeVisible();
});
