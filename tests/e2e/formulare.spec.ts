import { test, expect, type Page } from "@playwright/test";

/** Formular-Ausbau: Interessenformular (EN) mit Suchprofil-Vorschlag, Messe-Erfassung mit Visitenkarte und Rückruf, Objekt mit Entwurf und Eckdaten. */

async function devLogin(page: Page, role: "ADMIN" | "LEITUNG" | "MITARBEITER" | "PRAKTIKANT", name = "Test Person") {
  await page.goto("/auth/dev?next=/");
  await page.getByRole("textbox", { name: "Name" }).fill(name);
  await page.getByLabel("Rolle").selectOption(role);
  await page.getByRole("button", { name: "Anmelden" }).click();
  await page.waitForURL((url) => url.pathname === "/", { timeout: 60_000 });
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 60_000 });
}

test.describe.configure({ mode: "serial" });
// Geräte auf der Messe laufen in deutscher Zeit (Rückruftermine)
test.use({ timezoneId: "Europe/Berlin" });

test.beforeAll(async ({ request }) => {
  for (const path of ["/auth/login", "/auth/dev", "/interesse", "/leads/neu", "/objekte/neu"]) await request.get(path);
});

test("Interessenformular auf Englisch ergibt Suchprofil-Vorschlag", async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  const uniq = `${testInfo.project.name}${Date.now().toString().slice(-6)}`;
  await page.goto("/interesse?q=superstay26&lang=en");
  await expect(page.getByRole("heading", { name: "Looking for a holiday property?" })).toBeVisible();
  await page.getByRole("textbox", { name: "Name", exact: true }).fill(`Interest EN ${uniq}`);
  await page.getByRole("textbox", { name: "Email" }).fill(`en${uniq}@example.com`);
  await page.getByRole("radio", { name: "Holiday apartment" }).click();
  await page.getByRole("checkbox", { name: "Mallorca" }).click();
  await page.getByRole("radio", { name: "€300k – €1m" }).click();
  await page.getByRole("radio", { name: "within 6 months" }).click();
  await page.getByRole("radio", { name: "financing planned" }).click();
  await page.getByRole("radio", { name: "WhatsApp" }).click();
  await page.getByLabel(/I agree that Baax/).check();
  await page.waitForTimeout(1600);
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByText("Thank you!")).toBeVisible();

  await devLogin(page, "LEITUNG", "Lena Leitung");
  await page.goto(`/leads?q=${encodeURIComponent(`Interest EN ${uniq}`)}`);
  await page.getByText(`Interest EN ${uniq}`).locator("visible=true").first().click();
  await expect(page.getByText("Sprache: Englisch")).toBeVisible();
  await expect(page.getByText("Zeithorizont: innerhalb von 6 Monaten")).toBeVisible();
  await expect(page.getByText("Bevorzugter Kontaktweg: WhatsApp")).toBeVisible();

  // Umwandeln: Suchprofil ist aus den Angaben vorbelegt
  await page.getByRole("button", { name: "In Suchauftrag umwandeln" }).click();
  await page.waitForURL(/\/auftraege\/[^/?]+\?tab=erstgespraech/);
  await page.goto(page.url().split("?")[0] + "?tab=profil");
  await expect(page.getByRole("checkbox", { name: "Ferienwohnung" })).toHaveAttribute("aria-checked", "true");
  await expect(page.getByRole("checkbox", { name: "Spanien" })).toHaveAttribute("aria-checked", "true");
  await expect(page.getByRole("checkbox", { name: "Mallorca" })).toHaveAttribute("aria-checked", "true");
  await expect(page.getByRole("textbox", { name: "Zeithorizont" })).toHaveValue("innerhalb von 6 Monaten");
  await expect(page.getByRole("textbox", { name: "Eigenkapital und Finanzierung" })).toHaveValue("Finanzierung geplant");
});

test("Messe-Erfassung mit Visitenkarte, Sprache und Rückruf", async ({ page, browser }, testInfo) => {
  test.setTimeout(180_000);
  const uniq = `${testInfo.project.name}${Date.now().toString().slice(-6)}`;
  await devLogin(page, "MITARBEITER", "Max Messe");
  await page.goto("/leads/neu");
  // Testbild im Browser erzeugen (echtes JPEG)
  const dataUrl = await page.evaluate(() => {
    const c = document.createElement("canvas");
    c.width = 80;
    c.height = 48;
    const x = c.getContext("2d")!;
    x.fillStyle = "#0cc0df";
    x.fillRect(0, 0, 80, 48);
    return c.toDataURL("image/jpeg");
  });
  await page.getByLabel("Visitenkarte fotografieren").setInputFiles({ name: "karte.jpg", mimeType: "image/jpeg", buffer: Buffer.from(dataUrl.split(",")[1], "base64") });
  await expect(page.getByText("Visitenkarte aufgenommen")).toBeVisible();
  await page.getByRole("textbox", { name: "Name", exact: true }).fill(`Karte ${uniq}`);
  await page.getByRole("textbox", { name: "Telefon" }).fill("+34 600 111 222");
  await page.getByRole("button", { name: /Mehr Felder/ }).click();
  await page.getByRole("radio", { name: "Spanisch" }).click();
  await page.getByRole("button", { name: "Heute 17 Uhr" }).click();
  await page.getByRole("button", { name: "Speichern und nächsten Kontakt" }).click();
  await expect(page.getByText(`Karte ${uniq} gespeichert.`)).toBeVisible({ timeout: 20_000 });

  await page.goto(`/leads?q=${encodeURIComponent(`Karte ${uniq}`)}`);
  await page.getByText(`Karte ${uniq}`).locator("visible=true").first().click();
  await expect(page.getByText("Sprache: Spanisch")).toBeVisible();
  await expect(page.getByText(/Rückrufwunsch: \d{2}\.\d{2}\.\d{2}, 17:00/)).toBeVisible();
  const img = page.getByRole("img", { name: "Visitenkarte" });
  await expect(img).toBeVisible();
  const src = await img.getAttribute("src");
  expect((await page.request.get(src!)).status()).toBe(200);

  // Startseite: Rückruf heute
  await page.goto("/");
  await expect(page.locator("li", { hasText: `Karte ${uniq}` }).getByText("Rückruf")).toBeVisible();

  // Praktikant darf die Visitenkarte nicht abrufen
  const ctx = await browser.newContext();
  const p2 = await ctx.newPage();
  await devLogin(p2, "PRAKTIKANT", "Pia Praktikum");
  expect((await p2.request.get(src!)).status()).toBe(403);
  await ctx.close();
});

test("Objekt: Tausenderpunkte, Entwurf wiederherstellen, weitere Eckdaten", async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  const uniq = `${testInfo.project.name}${Date.now().toString().slice(-6)}`;
  await devLogin(page, "LEITUNG", "Lena Leitung");
  await page.goto("/objekte/neu");
  await page.getByRole("textbox", { name: "Titel" }).fill(`Entwurf ${uniq}`);
  const price = page.getByRole("textbox", { name: "Angebotspreis" });
  await price.fill("1250000");
  await price.blur();
  await expect(price).toHaveValue("1.250.000");

  // Seite neu laden: Warnung bestätigen, Entwurf wird angeboten
  await page.waitForTimeout(900); // Entwurf wird verzögert gespeichert
  page.once("dialog", (d) => void d.accept());
  await page.reload();
  await expect(page.getByText(/Ungespeicherter Entwurf vom/)).toBeVisible();
  await page.getByRole("button", { name: "Wiederherstellen" }).click();
  await expect(page.getByRole("textbox", { name: "Titel" })).toHaveValue(`Entwurf ${uniq}`);
  await expect(page.getByRole("textbox", { name: "Angebotspreis" })).toHaveValue("1.250.000");

  await page.getByLabel("Land").selectOption("ES");
  await page.getByLabel("Region").selectOption("es-mallorca");
  await page.getByText("Weitere Eckdaten").click();
  await page.getByRole("textbox", { name: "Baujahr" }).fill("1998");
  await page.getByRole("textbox", { name: "Schlafzimmer" }).fill("3");
  await page.getByRole("textbox", { name: "Zum Strand (m)" }).fill("350");
  await page.getByLabel("Zustand").selectOption("GEPFLEGT");
  await page.getByRole("button", { name: "Objekt anlegen" }).click();
  await page.waitForURL(/\/objekte\/c[^/?]+\?neu=1/, { timeout: 30_000 });
  await expect(page.getByText("1998")).toBeVisible();
  await expect(page.getByText("350 m")).toBeVisible();
  await expect(page.getByText("gepflegt")).toBeVisible();

  // Nach dem Speichern kein Entwurf mehr
  await page.goto("/objekte/neu");
  await expect(page.getByText(/Ungespeicherter Entwurf vom/)).toHaveCount(0);
});
