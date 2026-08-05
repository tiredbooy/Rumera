import { expect, test } from "@playwright/test";

import { dismissAgeGateIfPresent, gotoStorefront } from "./helpers/nav";

test.describe("route lifecycle", () => {
  test("unknown path shows not-found recovery", async ({ page }) => {
    await gotoStorefront(page, "/this-route-definitely-does-not-exist-062");
    await dismissAgeGateIfPresent(page);

    await expect(page.locator("body")).toContainText(
      /پیدا نشد|یافت نشد|۴۰۴|404|وجود ندارد/i,
      { timeout: 15_000 },
    );
    // Recovery CTA toward catalogue or home.
    const products = page.getByRole("link", { name: /محصول/i });
    const home = page.getByRole("link", { name: /فروشگاه|خانه|رومرا/i });
    await expect(products.or(home).first()).toBeVisible();
  });

  test("offline page is reachable and actionable", async ({ page }) => {
    await gotoStorefront(page, "/offline");
    await dismissAgeGateIfPresent(page);
    await expect(page.locator("body")).toContainText(/آفلاین|اتصال|شبکه|آفلاین/i, {
      timeout: 15_000,
    });
  });

  test("browser history back works between storefront pages", async ({
    page,
  }) => {
    await gotoStorefront(page, "/products");
    await dismissAgeGateIfPresent(page);
    await gotoStorefront(page, "/categories");
    await page.goBack();
    await expect(page).toHaveURL(/\/products/);
  });
});
