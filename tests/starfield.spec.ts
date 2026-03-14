import { test, expect } from "@playwright/test";

test.describe("Starfield", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/starfield");
  });

  test("matches screenshot", async ({ page }) => {
    // Inject before navigation so RAF is stubbed before React mounts.
    // The stub fires the callback exactly once (one rendered frame), then stops —
    // giving the canvas a deterministic, frozen first frame to snapshot.
    await page.addInitScript(() => {
      let fired = false;
      const real = window.requestAnimationFrame.bind(window);
      window.requestAnimationFrame = (cb: FrameRequestCallback) => {
        if (fired) return 0;
        fired = true;
        return real(cb);
      };
    });
    await page.reload();
    await page.waitForTimeout(200); // let the single frame paint

    await expect(page).toHaveScreenshot("starfield.png", {
      fullPage: true,
      // Mask the canvas content — star positions are random per load.
      // We still get a full-page snapshot that catches regressions in the
      // surrounding chrome (back button, background, layout).
      mask: [page.locator("canvas")],
    });
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
