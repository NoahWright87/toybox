import { test, expect } from "@playwright/test";

test.describe("Homepage", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("matches screenshot", async ({ page }) => {
    await expect(page).toHaveScreenshot("homepage.png", { fullPage: true });
  });

  test("shows the Toy Box heading", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /welcome to the toy box/i })).toBeVisible();
  });

  test("shows the Starfield card", async ({ page }) => {
    await expect(page.getByText("Starfield", { exact: true })).toBeVisible();
    await expect(page.getByText("SCREENSAVER")).toBeVisible();
  });

  test("navigates to Starfield on card click", async ({ page }) => {
    await page.getByText("Starfield", { exact: true }).click();
    await expect(page).toHaveURL("/starfield");
  });
});
