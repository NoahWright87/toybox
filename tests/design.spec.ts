import { test, expect } from "@playwright/test";

test.describe("Design app", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/design");
  });

  test("shows the window title and nav groups", async ({ page }) => {
    await expect(page.getByText("Design", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Tokens", { exact: true })).toBeVisible();
    await expect(page.getByText("Window chrome", { exact: true })).toBeVisible();
  });

  test("defaults to the Colors panel with swatches", async ({ page }) => {
    await expect(page.getByText("--orange-primary", { exact: true })).toBeVisible();
  });

  test("navigates to a chrome component preview", async ({ page }) => {
    await page.getByRole("button", { name: "Title Bar" }).click();
    await expect(page.getByText("Sample Window", { exact: true })).toBeVisible();
  });

  test("editing a color persists to the live theme var", async ({ page }) => {
    // Type a new hex into the first swatch's text input and confirm it lands on :root.
    const hex = page.locator(".design-swatch__hex").first();
    await hex.fill("#123456");
    await hex.blur();
    const value = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue("--orange-primary").trim()
    );
    expect(value).toBe("#123456");
  });
});
