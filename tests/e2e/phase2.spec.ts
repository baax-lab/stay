import { test, expect, type Page } from "@playwright/test";

/** Phase 2 (Konzept §10): Partnerzugang mit Einreichung, Bewertung, Vorprüfung, mobile Besichtigung, Reisen, Vorlagen, Kriterienkatalog. */

const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");

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

test("Partnerzugang, Vorprüfung, Besichtigung, Reisen, Vorlagen", async ({ page, browser }) => {
  test.setTimeout(300_000);
  const uniq = Date.now().toString().slice(-6);
  page.on("dialog", (d) => void d.accept());
  await devLogin(page, "LEITUNG", "Lena Leitung");

  // Kriterienkatalog: neues Kriterium
  await page.goto("/einstellungen/kriterien");
  const newCard = page.locator("section", { hasText: "Neues Kriterium" });
  await newCard.getByRole("textbox", { name: "Bezeichnung" }).fill(`Sauna ${uniq}`);
  await newCard.getByRole("textbox", { name: "Englisch" }).fill(`Sauna ${uniq}`);
  await newCard.getByLabel("Gruppe").fill("Ausstattung");
  await newCard.getByRole("button", { name: "Anlegen" }).click();
  await expect(page.getByText("Kriterium angelegt.")).toBeVisible();

  // Partner mit Vereinbarung, Sprache Spanisch
  await page.goto("/partner/neu");
  await page.getByRole("textbox", { name: "Name" }).fill(`Partner Palma ${uniq}`);
  await page.getByRole("textbox", { name: "Firma" }).fill("Inmobiliaria Sol");
  await page.getByRole("combobox", { name: "Land", exact: true }).selectOption("ES");
  await page.getByLabel("Partnervereinbarung geschlossen am").fill("2026-10-01");
  await page.getByRole("checkbox", { name: /Mallorca/ }).check();
  await page.getByRole("textbox", { name: "Vereinbarte Provisionsteilung" }).fill("50/50 der Verkäuferprovision");
  await page.getByLabel("Sprache für Versand").selectOption("es");
  await page.getByRole("button", { name: "Anlegen" }).click();
  await page.waitForURL(/\/partner\/c[^/?]+/);
  const partnerUrl = page.url();

  // Suchauftrag Mallorca, beauftragt
  await page.goto("/auftraege/neu");
  await page.getByRole("textbox", { name: "Käufer (Name)" }).fill(`Reise Käufer ${uniq}`);
  await page.getByRole("textbox", { name: "Titel des Suchauftrags" }).fill(`P2 Mallorca ${uniq}`);
  await page.getByRole("button", { name: "Anlegen und Erstgespräch starten" }).click();
  await page.waitForURL(/\/auftraege\/c[^/?]+/);
  const mandateUrl = page.url().split("?")[0];
  const ref = `BS-${mandateUrl.split("/").pop()!.slice(-6).toUpperCase()}`;
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

  // Partnerzugang erzeugen
  await page.goto(partnerUrl);
  await page.getByRole("button", { name: "Neuen Link erzeugen" }).click();
  const accessPath = new URL((await page.getByTestId("partner-access-link").innerText()).trim()).pathname;

  // Partner reicht ohne Login ein (spanische Oberfläche)
  const pctx = await browser.newContext();
  const partner = await pctx.newPage();
  await partner.goto(accessPath);
  await expect(partner.getByRole("heading", { name: `Bienvenido/a, Partner Palma ${uniq}` })).toBeVisible();
  await expect(partner.getByTestId("partner-profile").filter({ hasText: ref })).toBeVisible();
  await expect(partner.getByText(`Reise Käufer ${uniq}`)).toHaveCount(0);
  await partner.getByLabel("Corresponde al perfil (opcional)").selectOption(ref);
  await partner.getByRole("textbox", { name: "Título" }).fill(`Ático Portixol ${uniq}`);
  await partner.getByLabel("Región").selectOption("es-mallorca");
  await partner.getByRole("textbox", { name: "Localidad" }).fill("Palma");
  await partner.getByRole("textbox", { name: "Precio de oferta" }).fill("720000");
  await partner.getByLabel("Licencia turística").selectOption("VORHANDEN");
  await partner.getByRole("textbox", { name: "Ocupación (%)" }).fill("65");
  await partner.getByRole("textbox", { name: "Precio medio por noche" }).fill("230");
  await partner.getByRole("checkbox", { name: `Sauna ${uniq}` }).check();
  await partner.getByLabel("Fotos").setInputFiles({ name: "foto.png", mimeType: "image/png", buffer: PNG });
  await partner.getByRole("button", { name: "Presentar inmueble" }).click();
  await expect(partner.getByText(/¡Gracias! El inmueble se ha recibido/)).toBeVisible();
  await expect(partner.getByTestId("partner-submissions")).toContainText(`Ático Portixol ${uniq}`);
  await expect(partner.getByTestId("partner-submissions")).toContainText("recibido");

  // Intern: Objekt mit Quelle Partner, Vorkenntnis, Treffer
  await page.goto(`/objekte?q=${encodeURIComponent(`Ático Portixol ${uniq}`)}`);
  await page.getByRole("link", { name: `Ático Portixol ${uniq}` }).click();
  await page.waitForURL(/\/objekte\/c[^/?]+/);
  const propertyUrl = page.url().split("?")[0];
  await expect(page.getByText(/Eingereicht über Partnerzugang von Partner Palma/)).toBeVisible();
  await expect(page.getByText(`Partner Palma ${uniq}`).first()).toBeVisible();
  await page.goto(`${mandateUrl}?tab=treffer`);
  await expect(page.locator("div.rounded-2xl", { hasText: `Ático Portixol ${uniq}` }).first()).toBeVisible();
  await page.goto(`${mandateUrl}?tab=verlauf`);
  await expect(page.getByText("Objekt vom Partner eingereicht")).toBeVisible();

  // Vorprüfung Spanien/FeWo
  await page.goto(`${propertyUrl}?tab=vorpruefung`);
  await page.getByRole("button", { name: "Vorprüfung starten" }).click();
  await expect(page.getByTestId("precheck-land_nota_simple")).toBeVisible();
  await page.getByTestId("precheck-land_nota_simple").getByText("OK", { exact: true }).click();
  await page.getByTestId("precheck-land_etv").getByText("Bedenken", { exact: true }).click();
  await page.getByTestId("precheck-land_etv").getByRole("textbox").fill("Übertragbarkeit noch offen");
  await page.getByLabel("Zusammenfassung (erscheint im Dossier)").fill("Lizenzübertragung durch Abogado klären.");
  await page.getByRole("button", { name: "Vorprüfung speichern" }).click();
  await expect(page.getByText(/Vorprüfung gespeichert \(BEDENKEN\)/)).toBeVisible();
  await page.goto(`${propertyUrl.replace("/objekte/", "/dossier/")}?lang=de`);
  await expect(page.getByTestId("dossier-precheck")).toContainText("Vorprüfung mit Bedenken");
  await expect(page.getByTestId("dossier-precheck")).toContainText("Lizenzübertragung durch Abogado klären.");

  // Mobile Besichtigung mit Foto
  await page.goto(`${propertyUrl}?tab=besichtigungen`);
  await page.getByRole("link", { name: "Besichtigung protokollieren" }).click();
  await page.getByLabel("Suchauftrag").selectOption({ label: `P2 Mallorca ${uniq}` });
  await page.getByRole("button", { name: "Protokoll starten" }).click();
  await page.waitForURL(/\/besichtigungen\/c[^/?]+/);
  await page.getByTestId("inspection-photo-input").setInputFiles({ name: "besichtigung.png", mimeType: "image/png", buffer: PNG });
  await expect(page.getByText("1 Foto(s) gespeichert.")).toBeVisible();
  await expect(page.getByTestId("inspection-photos").locator("img")).toHaveCount(1);
  await page.getByRole("radio", { name: "Lage und Umgebung: 4" }).click();
  await page.getByRole("radio", { name: "Zustand innen: 3" }).click();
  await page.getByRole("radio", { name: "Empfehlen", exact: true }).click();
  await page.getByRole("button", { name: "Protokoll abschließen" }).click();
  await expect(page.getByText("Protokoll abgeschlossen.")).toBeVisible();
  await page.getByRole("button", { name: "Ins Objekt übernehmen" }).click();
  await expect(page.getByText("1 Foto(s) ins Objekt übernommen.")).toBeVisible();

  // Reise mit Kosten
  await page.goto(`${mandateUrl}?tab=reisen`);
  await page.getByRole("textbox", { name: "Titel" }).fill(`Reise Mallorca ${uniq}`);
  await page.getByLabel("Beginn").fill("2026-12-03");
  await page.getByLabel("Ende").fill("2026-12-05");
  await page.getByRole("button", { name: "Reise anlegen" }).click();
  await expect(page.getByText(/Reise angelegt/)).toBeVisible();
  const tripCard = page.locator("section", { hasText: `Reise Mallorca ${uniq}` }).first();
  await tripCard.getByRole("textbox", { name: "Betrag (€)" }).fill("320");
  await tripCard.getByRole("textbox", { name: "Beschreibung" }).fill("Flug MUC–PMI");
  await tripCard.getByRole("button", { name: "Kosten erfassen" }).click();
  await expect(tripCard.getByText("Flug MUC–PMI")).toBeVisible();
  await tripCard.getByLabel("Kategorie").selectOption("HOTEL");
  await tripCard.getByRole("textbox", { name: "Betrag (€)" }).fill("240");
  await tripCard.getByRole("button", { name: "Kosten erfassen" }).click();
  await expect(tripCard.locator("[data-testid^=trip-sum-]")).toHaveText("560 €");
  await expect(page.getByTestId("trip-totals")).toContainText("560 €");

  // Vorlage Suchauftrag: Vorschau, PDF, Ablage
  await page.goto(`${mandateUrl}?tab=dokumente`);
  await expect(page.getByTestId("template-SUCHAUFTRAG")).toBeVisible();
  const mandateId = mandateUrl.split("/").pop()!;
  await page.goto(`/vorlage/SUCHAUFTRAG/${mandateId}?lang=de`);
  await expect(page.getByTestId("template-doc")).toContainText("Suchauftrag (Käufervertretung)");
  await expect(page.getByTestId("template-doc")).toContainText(`Reise Käufer ${uniq}`);
  await expect(page.getByTestId("template-doc")).toContainText(ref);
  const pdf = await page.request.get(`/api/pdf/vorlage/SUCHAUFTRAG/${mandateId}?lang=en`, { timeout: 120_000 });
  expect(pdf.headers()["content-type"]).toBe("application/pdf");
  await page.goto(`${mandateUrl}?tab=dokumente`);
  await page.getByRole("button", { name: "Als Dokument ablegen (DE)" }).click();
  await expect(page.getByText("Als Dokument abgelegt (unsigniert).")).toBeVisible();
  await page.reload();
  await expect(page.getByText(/Aus Vorlage \(DE, unsigniert\)/)).toBeVisible();

  // Partnervereinbarung aus Vorlage
  const partnerId = partnerUrl.split("/").pop()!;
  await page.goto(`/vorlage/PARTNERVEREINBARUNG/${partnerId}?lang=de`);
  await expect(page.getByTestId("template-doc")).toContainText(`Partner Palma ${uniq}`);
  await expect(page.getByTestId("template-doc")).toContainText("50/50 der Verkäuferprovision");

  // Bewertung und Leistungsübersicht
  await page.goto(partnerUrl);
  await page.getByLabel("Zuverlässigkeit").selectOption("5");
  await page.getByLabel("Objektqualität").selectOption("4");
  await page.getByLabel("Reaktionszeit").selectOption("3");
  await page.getByRole("button", { name: "Bewertung speichern" }).click();
  await expect(page.getByText("Bewertung gespeichert.")).toBeVisible();
  await page.reload();
  await expect(page.getByTestId("partner-stats")).toContainText("4 / 5 (1)");
  await expect(page.getByTestId("partner-stats")).toContainText("davon über Zugang");

  // Widerrufen → Partnerseite nicht mehr erreichbar
  await page.getByRole("button", { name: "Widerrufen" }).first().click();
  await expect(page.getByText("widerrufen", { exact: true }).first()).toBeVisible();
  await partner.goto(accessPath);
  await expect(partner.getByTestId("partner-unavailable")).toBeVisible();
  await pctx.close();
});
