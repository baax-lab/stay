import { test, expect, type Page } from "@playwright/test";

/** Phase 3 (Konzept §10): Länder- und Regionswissen, Auswertung, gespeicherte Portal-Suchen als Kandidaten. */

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
  for (const path of ["/auth/login", "/auth/dev"]) await request.get(path);
});

test("Wissen, Portal-Suchwunsch mit Kandidat, Auswertung", async ({ page, browser }) => {
  test.setTimeout(300_000);
  const uniq = Date.now().toString().slice(-6);
  await devLogin(page, "LEITUNG", "Lena Leitung");

  // Länderwissen Spanien pflegen und prüfen
  await page.goto("/wissen");
  await page.getByTestId("country-ES").click();
  await page.waitForURL(/\/wissen\/ES/);
  await page.getByLabel("Typische Dauer bis zum Eigentum").fill(`8–12 Wochen (${uniq})`);
  await page.getByRole("checkbox", { name: /Inhalte geprüft/ }).check();
  await page.getByRole("button", { name: "Speichern" }).click();
  await expect(page.getByText("Gespeichert und als geprüft markiert.")).toBeVisible();
  await page.reload();
  await expect(page.getByText(/geprüft \d{2}\.\d{2}\.\d{4} \(Lena Leitung\)/)).toBeVisible();
  await expect(page.getByText("NIE (Steuernummer) beantragt")).toBeVisible();

  // Regionswissen Mallorca
  await page.goto("/wissen/region/es-mallorca");
  await expect(page.getByTestId("region-stats")).toBeVisible();
  await page.getByLabel("€/m² von").fill("5000");
  await page.getByLabel("€/m² bis").fill("9000");
  await page.getByLabel("Auslastung von (%)").fill("55");
  await page.getByLabel("Auslastung bis (%)").fill("70");
  await page.getByLabel("Risiken").fill(`Lizenzvergabe eingeschränkt ${uniq}`);
  await page.getByLabel("Zweitwohnsitz und Erwerb").fill("Für EU-Bürger keine Beschränkungen.");
  await page.getByRole("checkbox", { name: /Inhalte geprüft/ }).check();
  await page.getByRole("button", { name: "Speichern" }).click();
  await expect(page.getByText("Gespeichert und als geprüft markiert.")).toBeVisible();

  // Suchauftrag Mallorca, beauftragt
  await page.goto("/auftraege/neu");
  await page.getByRole("textbox", { name: "Käufer (Name)" }).fill(`Wissen Käufer ${uniq}`);
  await page.getByRole("textbox", { name: "Titel des Suchauftrags" }).fill(`P3 Mallorca ${uniq}`);
  await page.getByRole("button", { name: "Anlegen und Erstgespräch starten" }).click();
  await page.waitForURL(/\/auftraege\/c[^/?]+/);
  const mandateUrl = page.url().split("?")[0];
  await page.goto(`${mandateUrl}?tab=profil`);
  await page.getByRole("checkbox", { name: "Ferienwohnung" }).click();
  await page.getByRole("checkbox", { name: "Spanien" }).click();
  await page.getByRole("checkbox", { name: "Mallorca" }).click();
  await page.getByRole("textbox", { name: "Preis bis (€)" }).fill("900000");
  await page.getByRole("checkbox", { name: "Vermietungslizenz erforderlich" }).uncheck();
  await page.getByRole("checkbox", { name: "Suchprofil aktiv" }).check();
  await page.getByRole("button", { name: /Suchprofil speichern/ }).click();
  await expect(page.getByText(/Suchprofil gespeichert/)).toBeVisible();
  await page.goto(mandateUrl);
  await page.locator("form").filter({ hasText: "Art" }).filter({ hasText: "Datum" }).getByRole("button", { name: "Speichern" }).click();
  await expect(page.getByText(/Identifiziert am/)).toBeVisible();
  await page.getByRole("button", { name: "→ Beauftragt" }).click();
  await page.getByRole("button", { name: /Status auf „Beauftragt“ setzen/ }).click();
  await expect(page.getByText("Status geändert.")).toBeVisible();

  // Marktbericht aus Regionswissen vorbefüllt
  await page.goto(`${mandateUrl}?tab=berichte`);
  await page.locator("section", { hasText: "Marktbericht" }).filter({ hasText: "Entwurf erstellen" }).first().getByRole("button", { name: "Entwurf erstellen" }).click();
  await page.waitForURL(/\/berichte\/c[^/?]+/);
  await expect(page.getByTestId("report")).toContainText("Richtwert 5.000–9.000 €/m²");
  await expect(page.getByTestId("report")).toContainText("Auslastung 55–70 %");
  await expect(page.getByTestId("report")).toContainText(`Lizenzvergabe eingeschränkt ${uniq}`);
  await expect(page.getByTestId("report")).toContainText("Für EU-Bürger keine Beschränkungen.");

  // Portal-Link, Käufer speichert Suchwunsch Ibiza
  await page.goto(`${mandateUrl}?tab=portal`);
  await page.getByRole("button", { name: "Neuen Link erzeugen" }).click();
  const portalPath = new URL((await page.getByTestId("portal-link").innerText()).trim()).pathname;
  const bctx = await browser.newContext();
  const buyer = await bctx.newPage();
  await buyer.goto(portalPath);
  const searches = buyer.getByTestId("portal-searches");
  await searches.getByRole("textbox", { name: "Bezeichnung" }).fill(`Auch Ibiza ${uniq}`);
  await searches.getByRole("checkbox", { name: "Ferienwohnung" }).check();
  await searches.getByLabel("Regionen").selectOption(["es-ibiza"]);
  await searches.getByRole("textbox", { name: "Preis bis (€)" }).fill("1200000");
  await searches.getByRole("checkbox", { name: "Pool", exact: true }).check();
  await searches.getByRole("button", { name: "Suchwunsch speichern" }).click();
  await expect(buyer.getByText(/Suchwunsch gespeichert/)).toBeVisible();
  await expect(searches.getByText(`Auch Ibiza ${uniq}`)).toBeVisible();

  // Neues Objekt auf Ibiza → Kandidat (kein Treffer, Profil ist Mallorca)
  await page.goto("/objekte/neu");
  await page.getByRole("textbox", { name: "Titel" }).fill(`Villa Ibiza ${uniq}`);
  await page.getByLabel("Land").selectOption("ES");
  await page.getByLabel("Region").selectOption("es-ibiza");
  await page.getByRole("textbox", { name: "Angebotspreis" }).fill("1100000");
  await page.getByRole("checkbox", { name: "Pool", exact: true }).click();
  await page.getByRole("button", { name: "Objekt anlegen" }).click();
  await page.waitForURL(/\/objekte\/c[^/?]+\?neu=1/);

  await page.goto(`${mandateUrl}?tab=treffer`);
  await page.getByRole("button", { name: "Alle" }).click();
  await expect(page.locator("div.rounded-2xl", { hasText: `Villa Ibiza ${uniq}` })).toHaveCount(0);
  await page.goto(`${mandateUrl}?tab=kandidaten`);
  await expect(page.getByTestId("candidates")).toContainText(`Villa Ibiza ${uniq}`);
  await expect(page.getByTestId("portal-search-internal").first()).toContainText("Geht über das Suchprofil hinaus");
  await page.getByTestId("candidates").locator("li", { hasText: `Villa Ibiza ${uniq}` }).getByRole("button", { name: "Als Treffer übernehmen" }).click();
  await expect(page.locator("section", { hasText: "Entschieden" })).toContainText(`Villa Ibiza ${uniq}`);
  await expect(page.locator("section", { hasText: "Entschieden" })).toContainText("übernommen");
  await page.goto(`${mandateUrl}?tab=treffer`);
  await expect(page.locator("div.rounded-2xl", { hasText: `Villa Ibiza ${uniq}` }).first()).toBeVisible();
  await bctx.close();

  // Auswertung
  await page.goto("/auswertung?preset=alle");
  await expect(page.getByTestId("funnel-table")).toContainText("Gesamt");
  await expect(page.getByTestId("status-table")).toContainText("Beauftragt");
  await expect(page.getByTestId("fee-table")).toBeVisible();
  await expect(page.getByTestId("partner-table")).toBeVisible();
  const csv = await page.request.get("/auswertung/export?section=status&preset=alle");
  expect(csv.status()).toBe(200);
  expect(await csv.text()).toContain("Status;Abgeschlossene Phasen");

  // Mitarbeiter: Auswertung ohne Honorar, kein Export; Praktikant: keine Auswertung
  await devLogin(page, "MITARBEITER", "Max Mitarbeiter");
  await page.goto("/auswertung?preset=alle");
  await expect(page.getByTestId("funnel-table")).toBeVisible();
  await expect(page.getByTestId("fee-table")).toHaveCount(0);
  expect((await page.request.get("/auswertung/export?section=honorar")).status()).toBe(403);
  await devLogin(page, "PRAKTIKANT", "Paula Praktikantin");
  await page.goto("/auswertung");
  await expect(page).toHaveURL(/\/$/);
});
