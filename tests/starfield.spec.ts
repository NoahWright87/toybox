import { test, expect } from "@playwright/test";

test.describe("Starfield", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/starfield");
  });

  test("back button matches screenshot", async ({ page }) => {
    // Snapshot just the back button — it's pure CSS/text so it's deterministic.
    // The canvas fills the whole viewport, so a full-page mask would be 100% magenta.
    const backBtn = page.getByRole("button", { name: /toy box/i });
    await expect(backBtn).toHaveScreenshot("starfield-back-button.png");
  });

  test("shows the back button", async ({ page }) => {
    await expect(page.getByRole("button", { name: /toy box/i })).toBeVisible();
  });

  test("back button returns to homepage", async ({ page }) => {
    await page.getByRole("button", { name: /toy box/i }).click();
    await expect(page).toHaveURL("/");
  });

  test("canvas is rendered", async ({ page }) => {
    await expect(page.locator("canvas")).toBeVisible();
  });
});
