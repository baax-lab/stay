import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

/** Betrieb und Datenschutz (Konzept §11): Protokoll, DSGVO-Auskunft und -Löschung, Rechtstexte, Verbindungstests, Abmelden. */

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
  for (const path of ["/auth/login", "/auth/dev", "/einstellungen/datenschutz", "/einstellungen/protokoll", "/datenschutz"]) await request.get(path);
});

test("DSGVO: Auskunft, Löschung mit Protokoll", async ({ page }, testInfo) => {
  test.setTimeout(240_000);
  const uniq = `${testInfo.project.name}${Date.now().toString().slice(-6)}`;
  const email = `dsgvo-${uniq}@example.com`;
  await devLogin(page, "ADMIN", "Ada Admin");

  // Lead und Suchauftrag (Erstgespräch, ohne Vertrag) mit derselben E-Mail
  await page.goto("/leads/neu");
  await page.getByRole("textbox", { name: "Name", exact: true }).fill(`DSGVO Person ${uniq}`);
  await page.getByRole("textbox", { name: "E-Mail" }).fill(email);
  await page.getByRole("button", { name: "Speichern und nächsten Kontakt" }).click();
  await expect(page.getByText(`DSGVO Person ${uniq} gespeichert.`)).toBeVisible({ timeout: 20_000 });

  await page.goto("/auftraege/neu");
  await page.getByRole("textbox", { name: "Käufer (Name)" }).fill(`DSGVO Käufer ${uniq}`);
  await page.getByRole("textbox", { name: "E-Mail" }).fill(email);
  await page.getByRole("textbox", { name: "Titel des Suchauftrags" }).fill(`DSGVO Auftrag ${uniq}`);
  await page.getByRole("button", { name: "Anlegen und Erstgespräch starten" }).click();
  await page.waitForURL(/\/auftraege\/c[^/?]+/);

  // Suche per POST: der Suchbegriff erscheint nicht in der URL
  await page.goto("/einstellungen/datenschutz");
  await page.getByRole("textbox", { name: /E-Mail, Telefon, Name/ }).fill(email.toUpperCase());
  await page.getByRole("button", { name: "Suchen" }).click();
  await expect(page.getByText("Gefunden: 2 Datensätze")).toBeVisible({ timeout: 20_000 });
  expect(page.url()).not.toContain("dsgvo");
  await expect(page.getByText("wird gelöscht").first()).toBeVisible();
  await expect(page.getByText("wird anonymisiert").first()).toBeVisible();

  // Auskunft als JSON
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Auskunft herunterladen" }).click();
  const download = await downloadPromise;
  const json = JSON.parse(await readFile((await download.path())!, "utf8"));
  expect(json.leads).toHaveLength(1);
  expect(json.leads[0].email).toBe(email);
  expect(json.suchauftraege[0].buyerEmail).toBe(email);

  // Löschung nur mit Bestätigung
  await page.getByRole("button", { name: "Endgültig löschen" }).click();
  await expect(page.getByText("Zur Bestätigung „LÖSCHEN“ eingeben.")).toBeVisible();
  await page.getByRole("textbox", { name: "Zur Bestätigung LÖSCHEN eingeben" }).fill("LÖSCHEN");
  await page.getByRole("button", { name: "Endgültig löschen" }).click();
  await expect(page.getByText("Erledigt und protokolliert")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("Gelöscht: 1")).toBeVisible();
  await expect(page.getByText("Anonymisiert: 1")).toBeVisible();

  // Danach ist nichts mehr zu finden
  await page.getByRole("textbox", { name: /E-Mail, Telefon, Name/ }).fill(email);
  await page.getByRole("button", { name: "Suchen" }).click();
  await expect(page.getByText("Gefunden: 0 Datensätze")).toBeVisible({ timeout: 20_000 });

  // Protokoll zeigt die Löschung mit Namen aus der Anmeldung
  await page.goto("/einstellungen/protokoll?action=PRIVACY_ERASURE");
  await expect(page.getByRole("cell", { name: "PRIVACY_ERASURE" }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Ada Admin" }).first()).toBeVisible();
  const csv = await page.request.get("/einstellungen/protokoll/export?action=PRIVACY_EXPORT");
  expect(csv.status()).toBe(200);
  expect(await csv.text()).toContain("PRIVACY_EXPORT");
});

test("Rechte: Protokoll und DSGVO nur für Admin", async ({ page }) => {
  await devLogin(page, "LEITUNG", "Lena Leitung");
  await page.goto("/einstellungen/protokoll");
  await expect(page).toHaveURL(/\/einstellungen$/);
  await page.goto("/einstellungen/datenschutz");
  await expect(page).toHaveURL(/\/einstellungen$/);
  expect((await page.request.get("/einstellungen/protokoll/export")).status()).toBe(403);
  expect((await page.request.post("/einstellungen/datenschutz/auskunft", { form: { q: "test@example.com" } })).status()).toBe(403);
});

test("Rechtstexte, Hausfarbe, Verbindungstests, Abmelden", async ({ page }, testInfo) => {
  const uniq = `${testInfo.project.name}${Date.now().toString().slice(-6)}`;
  await devLogin(page, "LEITUNG", "Lena Leitung");

  await page.goto("/einstellungen/texte");
  await page.getByRole("textbox", { name: "Text" }).fill(`## Hinweise ${uniq}\nVerantwortlich ist die **Baax Immobilien GmbH**.`);
  await page.getByRole("button", { name: "Speichern" }).click();
  await expect(page.getByText("Gespeichert.")).toBeVisible();
  await page.goto("/datenschutz");
  await expect(page.getByRole("heading", { name: `Hinweise ${uniq}` })).toBeVisible();
  await expect(page.getByRole("link", { name: "Impressum" })).toHaveAttribute("href", "https://www.baax.de/impressum");
  // Zurück auf den Standardtext
  await page.goto("/einstellungen/texte");
  await page.getByRole("textbox", { name: "Text" }).fill("");
  await page.getByRole("button", { name: "Speichern" }).click();
  await expect(page.getByText("Gespeichert.")).toBeVisible();
  await page.goto("/datenschutz");
  await expect(page.getByText("Zweck und Rechtsgrundlage:")).toBeVisible();

  const css = await page.request.get("/brand.css");
  expect(css.status()).toBe(200);
  expect(css.headers()["content-type"]).toContain("text/css");

  // Ohne Konfiguration melden die Tests klar, was fehlt
  await page.goto("/einstellungen");
  await page.getByRole("button", { name: "Hub-Verbindung testen" }).click();
  await expect(page.getByText("HUB_URL fehlt.")).toBeVisible();
  await page.getByRole("button", { name: "SMTP-Anmeldung testen" }).click();
  await expect(page.getByText("SMTP_HOST fehlt.")).toBeVisible();

  // GET auf /auth/logout meldet nicht ab (Links werden vorab geladen), POST schon
  await page.request.get("/auth/logout");
  await page.goto("/leads");
  await expect(page).toHaveURL(/\/leads$/);
  await page.locator("button:visible", { hasText: "Abmelden" }).click();
  await page.waitForURL(/\/auth\/login/);
  await page.goto("/leads");
  await expect(page).toHaveURL(/\/auth\/login/);
});
