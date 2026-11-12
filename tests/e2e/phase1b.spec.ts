import { test, expect, type Page } from "@playwright/test";

/** Abnahme Phase 1b (Konzept §9): Portal, konsistente Zahlen, Dossier-PDF DE/EN, Suchbericht mit Aussortiertem, Protokoll, abgelaufene Links. */

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
  for (const path of ["/auth/login", "/auth/dev", "/interesse"]) await request.get(path);
});

test("Käuferportal, Dossier, Suchbericht: Abnahme Phase 1b", async ({ page, browser }) => {
  test.setTimeout(300_000);
  const uniq = Date.now().toString().slice(-6);
  page.on("dialog", (d) => void d.accept());
  await devLogin(page, "LEITUNG", "Lena Leitung");

  // Suchauftrag mit Profil Mallorca, beauftragt
  await page.goto("/auftraege/neu");
  await page.getByRole("textbox", { name: "Käufer (Name)" }).fill(`Portal Käuferin ${uniq}`);
  await page.getByRole("textbox", { name: "Titel des Suchauftrags" }).fill(`Portal Mallorca ${uniq}`);
  await page.getByRole("button", { name: "Anlegen und Erstgespräch starten" }).click();
  await page.waitForURL(/\/auftraege\/c[^/?]+/);
  const mandateUrl = page.url().split("?")[0];
  const mandateId = mandateUrl.split("/").pop()!;

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

  // Zwei Objekte mit Auslastung und Tagespreis
  const propertyIds: string[] = [];
  for (const [name, price] of [
    ["Finca Alcúdia", "780000"],
    ["Apartment Palma", "650000"],
  ] as const) {
    await page.goto("/objekte/neu");
    await page.getByRole("textbox", { name: "Titel" }).fill(`${name} ${uniq}`);
    await page.getByLabel("Land").selectOption("ES");
    await page.getByLabel("Region").selectOption("es-mallorca");
    await page.getByRole("textbox", { name: "Ort" }).fill(name.split(" ")[1]);
    await page.getByRole("textbox", { name: "Angebotspreis" }).fill(price);
    await page.getByRole("textbox", { name: "Auslastung (%)" }).fill("62");
    await page.getByRole("textbox", { name: "Ø Tagespreis (€)" }).fill("240");
    await page.getByRole("radio", { name: "vorhanden", exact: true }).click();
    await page.getByRole("button", { name: "Objekt anlegen" }).click();
    await page.waitForURL(/\/objekte\/c[^/?]+\?neu=1/);
    propertyIds.push(page.url().split("/").pop()!.split("?")[0]);
  }

  // Beide an die Käuferin vorstellen (Freigabe)
  await page.goto(`${mandateUrl}?tab=treffer`);
  for (const name of ["Finca Alcúdia", "Apartment Palma"]) {
    const card = page.locator("div.rounded-2xl", { hasText: `${name} ${uniq}` }).first();
    await card.getByRole("button", { name: /An Käufer/ }).click();
    await card.getByRole("button", { name: /vorstellen$/ }).click();
    await expect(card.getByText(/Angebotspreis eingefroren/).first()).toBeVisible();
  }

  // Benachrichtigung entsteht als Entwurf, nicht automatisch gesendet
  await page.goto(`${mandateUrl}?tab=portal`);
  await expect(page.getByTestId("notification-draft").filter({ hasText: "Neue Objekte" })).toBeVisible();

  // Portal-Link erzeugen (Klartext nur einmal sichtbar)
  await page.getByRole("button", { name: "Neuen Link erzeugen" }).click();
  const portalUrl = (await page.getByTestId("portal-link").innerText()).trim();
  expect(portalUrl).toMatch(/\/portal\/[A-Za-z0-9_-]{43}$/);
  const portalPath = new URL(portalUrl).pathname;

  // Interne Zahlen
  await page.goto(`/objekte/${propertyIds[0]}?tab=kosten&m=${mandateId}`);
  const internalTotal = (await page.getByTestId("costs-total").innerText()).trim();
  const internalYield = (await page.getByTestId("yield-mittel").innerText()).trim();
  const internalReason = (await page.getByTestId("license-reason").innerText()).trim();
  expect(internalTotal).toMatch(/€/);
  expect(internalYield).toMatch(/%/);

  // Dossier (Weblink) zeigt dieselben Zahlen
  await page.goto(`/dossier/${propertyIds[0]}?m=${mandateId}&lang=de`);
  await expect(page.getByTestId("costs-total")).toHaveText(internalTotal);
  await expect(page.getByTestId("yield-mittel")).toHaveText(internalYield);
  await expect(page.getByTestId("license-reason")).toHaveText(internalReason);

  // Dossier-PDF DE und EN
  for (const lang of ["de", "en"]) {
    const res = await page.request.get(`/api/pdf/dossier/${propertyIds[0]}?m=${mandateId}&lang=${lang}`, { timeout: 120_000 });
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toBe("application/pdf");
    expect((await res.body()).subarray(0, 4).toString()).toBe("%PDF");
  }

  // Käuferin öffnet das Portal ohne Login
  const buyerCtx = await browser.newContext({ locale: "de-DE" });
  const buyer = await buyerCtx.newPage();
  await buyer.goto(portalPath);
  await expect(buyer.getByRole("heading", { name: `Willkommen, Portal Käuferin ${uniq}` })).toBeVisible();
  await expect(buyer.getByTestId("portal-timeline")).toContainText("Beauftragt");
  await expect(buyer.getByTestId("portal-next-steps")).toContainText("Marktanalyse");
  await expect(buyer.getByTestId("portal-object")).toHaveCount(2);

  // Gleiche Zahlen im Portal
  await buyer.getByTestId("portal-object").filter({ hasText: `Finca Alcúdia ${uniq}` }).click();
  await expect(buyer.getByTestId("costs-total")).toHaveText(internalTotal);
  await expect(buyer.getByTestId("yield-mittel")).toHaveText(internalYield);
  await expect(buyer.getByTestId("license-reason")).toHaveText(internalReason);

  // Englisch umschaltbar
  await buyer.getByRole("link", { name: "EN", exact: true }).click();
  await expect(buyer.getByRole("button", { name: "Shortlist" })).toBeVisible();
  await buyer.getByRole("link", { name: "DE", exact: true }).click();

  // Ablehnen mit Pflichtgrund
  await buyer.getByRole("button", { name: "Ablehnen" }).click();
  await buyer.getByLabel("Grund").selectOption({ label: "Lage zu touristisch" });
  await buyer.getByLabel("Ergänzung (optional)").fill("Zu nah an der Partymeile");
  await buyer.getByRole("button", { name: "Ablehnung senden" }).click();
  await expect(buyer.getByText(/Danke für Ihre Rückmeldung/)).toBeVisible();

  // Zweites Objekt merken, PDF aus dem Portal
  await buyer.goto(portalPath);
  await expect(buyer.getByTestId("portal-object")).toHaveCount(1);
  await expect(buyer.getByText("Abgelehnte Objekte (1)")).toBeVisible();
  await buyer.getByTestId("portal-object").first().click();
  await buyer.getByRole("button", { name: "Merken" }).click();
  await expect(buyer.getByText("Objekt gemerkt.")).toBeVisible();
  const portalPdf = await buyer.request.get(`${portalPath}/pdf/dossier/${propertyIds[1]}?lang=en`, { timeout: 120_000 });
  expect(portalPdf.headers()["content-type"]).toBe("application/pdf");

  // Fremdes Objekt ist im Portal nicht erreichbar
  const foreign = await buyer.request.get(`${portalPath}/objekt/gibtesnicht`);
  expect(foreign.status()).toBe(404);

  // Intern: Rückmeldung am Treffer, Portal-Zugriffe protokolliert
  await page.goto(`${mandateUrl}?tab=treffer&x=1`);
  await page.getByRole("button", { name: "Alle" }).click();
  await expect(page.getByText(/Käufer im Portal: abgelehnt \(Lage zu touristisch\) – Zu nah an der Partymeile/)).toBeVisible();
  await page.goto(`${mandateUrl}?tab=portal`);
  await expect(page.getByTestId("portal-log")).toContainText("Aufruf");
  await expect(page.getByTestId("portal-log")).toContainText("Aktion ABGELEHNT");

  // Suchbericht zeigt das Aussortierte mit Grund
  await page.goto(`${mandateUrl}?tab=berichte`);
  const searchCard = page.locator("section", { hasText: "Suchbericht" }).filter({ hasText: "Entwurf erstellen" }).first();
  await searchCard.getByRole("combobox").selectOption("current");
  await searchCard.getByRole("button", { name: "Entwurf erstellen" }).click();
  await page.waitForURL(/\/berichte\/c[^/?]+/);
  await expect(page.getByTestId("rejected-Lage")).toContainText(`Finca Alcúdia ${uniq}`);
  await expect(page.getByTestId("rejected-Lage")).toContainText("Lage zu touristisch");
  await expect(page.getByTestId("report")).toContainText(`Apartment Palma ${uniq}`);
  await page.getByLabel("Marktbeobachtung").fill("Angebot im Norden knapp, Preise stabil.");
  await page.getByRole("button", { name: "Entwurf speichern" }).click();
  await expect(page.getByText("Entwurf gespeichert.")).toBeVisible();
  await page.getByRole("button", { name: "Bericht freigeben" }).click();
  await expect(page.getByText(/Freigegeben und im Portal sichtbar/)).toBeVisible();
  const reportPdf = await page.request.get(page.url().replace(/\/auftraege\/[^/]+\/berichte\//, "/api/pdf/bericht/") + "?lang=en", { timeout: 120_000 });
  expect(reportPdf.headers()["content-type"]).toBe("application/pdf");

  // Marktbericht-Entwurf mit Region und Nebenkosten
  await page.goto(`${mandateUrl}?tab=berichte`);
  await page.locator("section", { hasText: "Marktbericht" }).filter({ hasText: "Entwurf erstellen" }).first().getByRole("button", { name: "Entwurf erstellen" }).click();
  await page.waitForURL(/\/berichte\/c[^/?]+/);
  await expect(page.getByTestId("report")).toContainText("Mallorca");
  await expect(page.getByTestId("report")).toContainText("Grunderwerbsteuer (ITP)");

  // Bericht im Portal
  await buyer.goto(portalPath);
  await buyer.getByRole("link", { name: /Suchbericht/ }).click();
  await expect(buyer.getByTestId("report")).toContainText("Angebot im Norden knapp");
  await expect(buyer.getByTestId("rejected-Lage")).toContainText("von Ihnen abgelehnt");

  // Widerrufener Link: freundliche Seite mit Kontakt
  await page.goto(`${mandateUrl}?tab=portal`);
  await page.getByRole("button", { name: "Widerrufen" }).first().click();
  await expect(page.getByText("widerrufen", { exact: true }).first()).toBeVisible();
  await buyer.goto(portalPath);
  await expect(buyer.getByTestId("portal-unavailable")).toContainText("Dieser Link ist nicht mehr gültig");
  await expect(buyer.getByTestId("portal-unavailable")).toContainText("deaktiviert");
  await expect(buyer.getByTestId("portal-unavailable")).toContainText("Lena Leitung");

  // Unbekannter Token
  await buyer.goto("/portal/" + "x".repeat(43));
  await expect(buyer.getByTestId("portal-unavailable")).toBeVisible();
  await buyerCtx.close();
});
