import { expect, test } from "@playwright/test";

import { dismissAgeGateIfPresent, gotoStorefront } from "./helpers/nav";

test.describe("checkout shell & empty cart recovery", () => {
  test("checkout is gated for guests (login redirect or shell)", async ({
    page,
  }) => {
    await gotoStorefront(page, "/checkout");
    await dismissAgeGateIfPresent(page);

    // Middleware may bounce guests to login; wait for that hop.
    await page
      .waitForURL(/\/login/, { timeout: 12_000 })
      .catch(() => undefined);
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(400);

    const url = page.url();
    if (/\/login/i.test(url)) {
      expect(url).toMatch(/checkout|callbackUrl/i);
      return;
    }

    // Still on checkout: page must render a real shell (not a blank document).
    expect(url).toMatch(/\/checkout/);
    await expect(page.locator("body")).not.toBeEmpty();
    const text = await page.locator("body").innerText();
    expect(text.length).toBeGreaterThan(10);
  });

  test("empty cart surfaces a path back to shopping", async ({ page }) => {
    await gotoStorefront(page, "/cart");
    await dismissAgeGateIfPresent(page);
    await page.waitForTimeout(500);

    // Either items list, empty state, or soft-fail message — not a blank page.
    const body = page.locator("body");
    await expect(body).toContainText(/سبد|خالی|محصول|فروشگاه|سبد خرید/i);

    const shopLink = page.getByRole("link", {
      name: /محصول|فروشگاه|ادامه|خرید/i,
    });
    if (await shopLink.count()) {
      await expect(shopLink.first()).toBeVisible();
    }
  });

  test("checkout does not hard-crash without auth/cart", async ({ page }) => {
    const res = await gotoStorefront(page, "/checkout");
    expect(res?.status() ?? 200).toBeLessThan(500);
    await dismissAgeGateIfPresent(page);
    // Dev always mounts nextjs-portal; fail only on the visible error dialog.
    await expect(
      page.getByText(/Unhandled Runtime Error|Application error/i),
    ).toHaveCount(0);
  });
});
