import { expect, test, type Page } from "@playwright/test";

// 1×1 PNG
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);

async function firstSet(page: Page, exercise: string) {
  const card = page.locator("article", { has: page.getByRole("heading", { name: exercise, exact: true }) });
  return { card, weight: card.getByLabel(/Gewicht \(kg\)|Scheibengewicht gesamt \(kg\)/).first(), reps: card.getByLabel("Wdh.").first() };
}

test("Training starten, Satz erfassen, nach Neuladen wiederherstellen und abschliessen", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: /Training A/ })).toBeVisible();
  await page.getByRole("button", { name: /Training A/ }).click();
  await expect(page).toHaveURL(/\/training\/$/);

  const { card, weight, reps } = await firstSet(page, "Brustpressen");
  await expect(card.getByText("Cybex Brustpresse")).toBeVisible();
  await expect(card.getByRole("img", { name: /Illustration: Cybex Brustpresse/ })).toBeVisible();
  await weight.fill("42,5");
  await reps.fill("10");
  await card.getByRole("button", { name: "Satz 1 abschliessen" }).click();
  await expect(card.getByRole("button", { name: "Satz 1 wieder öffnen" })).toBeVisible();

  // Zweiter Satz: nur Werte, nicht abgeschlossen → nach Reload weiterhin vorhanden
  await card.getByLabel("Wdh.").nth(1).fill("8");
  await page.waitForTimeout(800);
  await page.reload();
  const again = await firstSet(page, "Brustpressen");
  await expect(again.weight).toHaveValue("42.5");
  await expect(again.reps).toHaveValue("10");
  await expect(again.card.getByLabel("Wdh.").nth(1)).toHaveValue("8");
  await expect(again.card.getByRole("button", { name: "Satz 1 wieder öffnen" })).toBeVisible();

  // Startseite zeigt Fortsetzen
  await page.goto("/");
  await page.getByRole("link", { name: /Training fortsetzen/ }).click();
  await page.getByRole("button", { name: /Training abschliessen/ }).click();
  await page.getByRole("button", { name: "Abschliessen", exact: true }).click();
  await expect(page).toHaveURL(/\/verlauf\/detail\/\?id=/);
  await expect(page.getByText("Abgeschlossen").first()).toBeVisible();
  await expect(page.getByText("42.5 kg").first()).toBeVisible();

  // Fortschritt
  await page.goto("/fortschritt/");
  await expect(page.getByText("Höchstes Arbeitsgewicht", { exact: true })).toBeVisible();
  await expect(page.getByText("42.5 kg").first()).toBeVisible();

  // Vorschlag nächste Einheit = B
  await page.goto("/");
  await expect(page.getByRole("button", { name: /Training B.*Vorschlag|Vorschlag.*Training B/ })).toBeVisible();
});

test("Gerätebild hochladen und nach Neuladen anzeigen", async ({ page }) => {
  await page.goto("/geraete/bearbeiten/?id=dev-row");
  await expect(page.getByRole("heading", { name: "Cybex Rudermaschine" })).toBeVisible();
  await page.getByTestId("device-image-input").setInputFiles({ name: "ruder.png", mimeType: "image/png", buffer: PNG });
  await expect(page.getByRole("img", { name: "Foto: Cybex Rudermaschine" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("img", { name: "Foto: Cybex Rudermaschine" })).toBeVisible();
  await page.goto("/geraete/");
  await expect(page.getByRole("img", { name: "Foto: Cybex Rudermaschine" })).toBeVisible();
});

test("Beinpresse: Variante wechseln und Scheibenrechner nutzen", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Training B/ }).click();
  const card = page.locator("article").first();
  await expect(card.getByRole("heading", { name: "Beinpresse – Gewichtsblock" })).toBeVisible();
  await card.getByRole("radio", { name: "Gewichtsscheiben" }).click();
  await expect(card.getByRole("heading", { name: "Beinpresse – Gewichtsscheiben" })).toBeVisible();
  await expect(card.getByLabel("Scheibengewicht gesamt (kg)").first()).toBeVisible();
  await card.getByRole("radio", { name: "Scheibenrechner" }).click();
  await card.getByRole("button", { name: /Scheibenrechner öffnen/ }).first().click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "20 kg hinzufügen (Pro Seite)" }).click();
  await dialog.getByRole("button", { name: "20 kg hinzufügen (Pro Seite)" }).click();
  await expect(dialog.getByText("80 kg").first()).toBeVisible();
  await dialog.getByRole("button", { name: /Übernehmen/ }).click();
  await expect(card.getByRole("button", { name: /Scheibenrechner öffnen, aktuell 80 kg/ })).toBeVisible();

  // Mit erfasstem Satz zurück wechseln → Rückfrage, keine stille Umbuchung
  await card.getByLabel("Wdh.").first().fill("10");
  await card.getByRole("button", { name: "Satz 1 abschliessen" }).click();
  await card.getByRole("radio", { name: "Gewichtsblock" }).click();
  await expect(page.getByRole("dialog", { name: "Bereits erfasste Sätze" })).toBeVisible();
  await page.getByRole("button", { name: /zusätzliche Übung anlegen/ }).click();
  await expect(page.getByRole("heading", { name: "Beinpresse – Gewichtsblock" })).toBeVisible();
  await expect(card.getByRole("heading", { name: "Beinpresse – Gewichtsscheiben" })).toBeVisible();
});

test("Backup exportieren und wieder importieren", async ({ page }) => {
  await page.goto("/geraete/bearbeiten/?id=dev-biceps");
  await page.getByTestId("device-image-input").setInputFiles({ name: "b.png", mimeType: "image/png", buffer: PNG });
  await expect(page.getByRole("img", { name: "Foto: Cybex Bizepsmaschine" })).toBeVisible();

  await page.goto("/einstellungen/");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: /Vollständiges Backup/ }).click();
  const download = await downloadPromise;
  const path = await download.path();

  // Daten verändern: Gerät umbenennen
  await page.goto("/geraete/bearbeiten/?id=dev-biceps");
  await page.getByLabel("Gerätename").fill("Umbenannt");
  await page.getByRole("button", { name: "Änderungen speichern" }).click();
  await expect(page.getByText("✓ Gespeichert")).toBeVisible();

  await page.goto("/einstellungen/");
  await page.getByTestId("backup-input").setInputFiles(path!);
  await expect(page.getByRole("dialog", { name: "Alle lokalen Daten überschreiben?" })).toBeVisible();
  await page.getByRole("button", { name: "Überschreiben & importieren" }).click();
  await expect(page.getByText("Backup importiert.")).toBeVisible();

  await page.goto("/geraete/bearbeiten/?id=dev-biceps");
  await expect(page.getByLabel("Gerätename")).toHaveValue("Cybex Bizepsmaschine");
  await expect(page.getByRole("img", { name: "Foto: Cybex Bizepsmaschine" })).toBeVisible();

  // Ungültige Datei wird abgelehnt
  await page.goto("/einstellungen/");
  await page.getByTestId("backup-input").setInputFiles({ name: "x.json", mimeType: "application/json", buffer: Buffer.from('{"app":"falsch"}') });
  await expect(page.getByText(/Import abgelehnt/)).toBeVisible();
});

test("Verwechselte Beinpresse-Werte im Verlauf tauschen", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Training B/ }).click();
  const stack = page.locator("article").first();
  await stack.getByLabel("Gewicht (kg)").first().fill("80");
  await stack.getByLabel("Wdh.").first().fill("12");
  await stack.getByRole("button", { name: "Satz 1 abschliessen" }).click();
  await stack.getByRole("radio", { name: "Gewichtsscheiben" }).click();
  await page.getByRole("button", { name: /zusätzliche Übung anlegen/ }).click();
  const plates = page.locator("article", { has: page.getByRole("heading", { name: "Beinpresse – Gewichtsscheiben" }) });
  await plates.getByLabel("Scheibengewicht gesamt (kg)").first().fill("120");
  await plates.getByLabel("Wdh.").first().fill("10");
  await plates.getByRole("button", { name: "Satz 1 abschliessen" }).click();
  await page.getByRole("button", { name: /Training abschliessen/ }).click();
  await page.getByRole("button", { name: "Abschliessen", exact: true }).click();
  await expect(page).toHaveURL(/\/verlauf\/detail\//);

  await page.getByRole("button", { name: "Korrigieren" }).click();
  await page.getByRole("button", { name: "Optionen für Beinpresse – Gewichtsblock" }).click();
  await page.getByRole("button", { name: /Sätze mit anderer Übung tauschen/ }).click();
  await page.getByRole("dialog").getByRole("button", { name: /Beinpresse – Gewichtsscheiben/ }).click();
  await page.getByRole("button", { name: "Sätze tauschen" }).click();
  await page.getByRole("button", { name: "Korrektur beenden" }).click();

  const stackCard = page.locator("div.rounded-2xl", { has: page.getByRole("heading", { name: "Beinpresse – Gewichtsblock" }) });
  await expect(stackCard.getByRole("cell", { name: "120 kg" })).toBeVisible();
  const platesCard = page.locator("div.rounded-2xl", { has: page.getByRole("heading", { name: "Beinpresse – Gewichtsscheiben" }) });
  await expect(platesCard.getByRole("cell", { name: /^80 kg/ })).toBeVisible();
  await expect(page.getByText(/Nachträglich korrigiert/)).toBeVisible();
});
