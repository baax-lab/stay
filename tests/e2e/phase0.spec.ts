import { test, expect, type Page } from "@playwright/test";

async function devLogin(page: Page, role: "ADMIN" | "LEITUNG" | "MITARBEITER" | "PRAKTIKANT", name = "Test Person") {
  await page.goto("/auth/dev?next=/");
  await page.getByRole("textbox", { name: "Name" }).fill(name);
  await page.getByLabel("Rolle").selectOption(role);
  await page.getByRole("button", { name: "Anmelden" }).click();
  await page.waitForURL((url) => url.pathname === "/", { timeout: 60_000 });
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 60_000 });
}

// Dev-Server: Routen vorab kompilieren, damit Zeitlimits nicht am ersten Aufruf scheitern
test.beforeAll(async ({ request }) => {
  for (const path of ["/auth/login", "/auth/dev", "/interesse", "/datenschutz"]) {
    await request.get(path);
  }
});

test("Ohne Login wird zur Anmeldung umgeleitet", async ({ page }) => {
  await page.goto("/leads");
  await expect(page).toHaveURL(/\/auth\/login\?next=%2Fleads/);
  await expect(page.getByRole("heading", { name: "Anmelden" })).toBeVisible();
});

test("Kontakt auf dem Handy erfassen, Dublette erkennen, in Liste sehen", async ({ page }) => {
  await devLogin(page, "MITARBEITER", "Maria Messe");
  const uniq = Date.now().toString().slice(-7);
  await page.goto("/leads/neu");
  await expect(page.getByText("Aktives Event: SuperStay LIVE 2026")).toBeVisible();

  await page.getByRole("textbox", { name: "Name", exact: true }).fill(`E2E Käufer ${uniq}`);
  await page.getByRole("radio", { name: "Käufer", exact: true }).click();
  await page.getByRole("textbox", { name: "Telefon" }).fill(`0171 ${uniq}`);
  await page.getByRole("textbox", { name: "Interesse" }).fill("FeWo Mallorca Nord, Rendite");
  await page.getByRole("radio", { name: "300 T€ – 1 Mio. €" }).click();
  await page.getByLabel(/Einwilligung E-Mail-Kontakt/).check();
  await page.getByRole("button", { name: "Speichern und nächsten Kontakt" }).click();

  await expect(page.getByText(`E2E Käufer ${uniq} gespeichert.`)).toBeVisible();
  // Formular ist wieder leer
  await expect(page.getByRole("textbox", { name: "Name", exact: true })).toHaveValue("");

  // Gleiche Telefonnummer, andere Schreibweise → Dubletten-Hinweis
  await page.getByRole("textbox", { name: "Name", exact: true }).fill(`E2E Dublette ${uniq}`);
  await page.getByRole("textbox", { name: "Telefon" }).fill(`+49 171 ${uniq}`);
  await page.getByRole("button", { name: "Speichern und nächsten Kontakt" }).click();
  await expect(page.getByText("Möglicherweise bereits bekannt:")).toBeVisible();
  await expect(page.getByRole("link", { name: `E2E Käufer ${uniq}` })).toBeVisible();

  await page.goto("/leads?q=E2E");
  await expect(page.getByText(`E2E Käufer ${uniq}`).locator("visible=true").first()).toBeVisible();
  await expect(page.getByText("Übergabe ausstehend").locator("visible=true").first()).toBeVisible();
});

test("Erfassung ohne Netz wird gepuffert und nachgesendet", async ({ page, context }) => {
  await devLogin(page, "MITARBEITER");
  const uniq = Date.now().toString().slice(-7);
  await page.goto("/leads/neu");
  await page.getByRole("textbox", { name: "Name", exact: true }).fill(`Offline ${uniq}`);

  await context.setOffline(true);
  await page.getByRole("textbox", { name: "E-Mail" }).fill(`offline${uniq}@beispiel.de`);
  await page.getByRole("button", { name: "Speichern und nächsten Kontakt" }).click();
  await expect(page.getByText(/zwischengespeichert/)).toBeVisible();
  await expect(page.getByText("1 Kontakt wartet auf Übertragung.")).toBeVisible();

  await context.setOffline(false);
  // Beim Online-Ereignis wird automatisch nachgesendet
  await expect(page.getByText("1 Kontakt wartet auf Übertragung.")).toBeHidden({ timeout: 15_000 });

  await page.goto(`/leads?q=Offline ${uniq}`);
  await expect(page.getByText(`Offline ${uniq}`).locator("visible=true").first()).toBeVisible();
});

test("Öffentliches Interessenformular legt Lead mit Quelle an; Honeypot blockt", async ({ page, request }) => {
  const uniq = Date.now().toString().slice(-7);
  await page.goto("/interesse?q=superstay26");
  await expect(page.getByText("Kontakt über: SuperStay LIVE 2026")).toBeVisible();
  await page.getByRole("textbox", { name: "Name", exact: true }).fill(`QR Interessent ${uniq}`);
  await page.getByRole("textbox", { name: "E-Mail" }).fill(`qr${uniq}@beispiel.de`);
  await page.getByRole("textbox", { name: "Was suchen Sie?" }).fill("Ferienwohnung Südtirol");
  await page.getByRole("textbox", { name: "Region" }).fill("Südtirol, Gardasee");
  await page.getByLabel(/Ich bin einverstanden/).check();
  await page.waitForTimeout(1600); // Mindestdauer gegen Bots
  await page.getByRole("button", { name: "Absenden" }).click();
  await expect(page.getByText("Vielen Dank!")).toBeVisible();

  // Honeypot: Server antwortet ok, speichert aber nichts
  const bot = await request.post("/api/public/interesse", {
    data: { name: "Bot Bot", email: "bot@spam.io", role: "KAEUFER", consent: true, website: "http://spam", elapsedMs: 5000 },
  });
  expect(bot.ok()).toBeTruthy();

  // Ohne Einwilligung: 422
  const noConsent = await request.post("/api/public/interesse", {
    data: { name: "Ohne Consent", email: "x@y.de", role: "KAEUFER", consent: false, elapsedMs: 5000 },
  });
  expect(noConsent.status()).toBe(422);

  await devLogin(page, "LEITUNG");
  await page.goto("/leads?source=MESSE&q=QR");
  await expect(page.getByText(`QR Interessent ${uniq}`).locator("visible=true").first()).toBeVisible();
  await page.getByText(`QR Interessent ${uniq}`).locator("visible=true").first().click();
  await expect(page.getByText("Messe – SuperStay LIVE 2026")).toBeVisible();
  await expect(page.getByText("Südtirol, Gardasee")).toBeVisible();
  await expect(page.getByText("Bot Bot")).toHaveCount(0);
});

test("CSV-Export nur für Leitung/Admin; Praktikant sieht keine Kontaktdaten", async ({ page, request }) => {
  await devLogin(page, "MITARBEITER");
  // Sicherstellen, dass mindestens ein Lead existiert
  const created = await page.request.post("/api/leads", {
    data: { name: "Praktikanten Test", role: "KAEUFER", source: "MESSE", email: `prakt${Date.now()}@beispiel.de` },
  });
  expect(created.ok()).toBeTruthy();
  const forbidden = await page.request.get("/leads/export");
  expect(forbidden.status()).toBe(403);
  await page.goto("/leads");
  await expect(page.getByRole("link", { name: "CSV-Export" })).toHaveCount(0);

  await devLogin(page, "LEITUNG");
  const res = await page.request.get("/leads/export");
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toContain("text/csv");
  const body = await res.text();
  expect(body).toContain("Name;Firma;E-Mail;Telefon");

  await devLogin(page, "PRAKTIKANT");
  await page.goto("/leads");
  await expect(page.getByText("Kontakt", { exact: true })).toHaveCount(0);
  const first = page.locator("a[href^='/leads/c']").locator("visible=true").first();
  await first.click();
  await expect(page.getByText("Für Ihre Rolle nicht sichtbar")).toBeVisible();

  const anon = await request.get("/api/leads");
  expect([401, 405]).toContain(anon.status());
});

test("Einstellungen: Leitung darf aktives Event ändern, Mitarbeiter nicht", async ({ page }) => {
  await devLogin(page, "MITARBEITER");
  await page.goto("/einstellungen");
  await expect(page).toHaveURL(/\/$/);

  await devLogin(page, "LEITUNG");
  await page.goto("/einstellungen");
  await expect(page.getByRole("heading", { name: "Einstellungen" })).toBeVisible();
  await expect(page.getByText("QR-Kennungen für das Interessenformular")).toBeVisible();
});
