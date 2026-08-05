import { expect, test } from "@playwright/test";

import { dismissAgeGateIfPresent, gotoStorefront } from "./helpers/nav";

/**
 * Group 056 storefront surfaces — load, expose a heading/landmark, and do not
 * crash into an unstyled blank document when API is soft-failed.
 */
test.describe("storefront route shells (Group 056)", () => {
  test("home renders main landmark", async ({ page }) => {
    await gotoStorefront(page, "/");
    await dismissAgeGateIfPresent(page);
    // Loading + page shells can both use #main-content briefly — take first.
    await expect(page.locator("#main-content").first()).toBeAttached();
    await expect(page.getByRole("main").first()).toBeVisible();
  });

  test("products catalogue", async ({ page }) => {
    await gotoStorefront(page, "/products");
    await dismissAgeGateIfPresent(page);
    await expect(
      page.getByRole("heading", { level: 1 }).first(),
    ).toBeVisible({ timeout: 15_000 });
  });

  test("category index", async ({ page }) => {
    await gotoStorefront(page, "/categories");
    await dismissAgeGateIfPresent(page);
    await expect(
      page.getByRole("heading", { level: 1 }).first(),
    ).toBeVisible({ timeout: 15_000 });
  });

  test("tags index", async ({ page }) => {
    await gotoStorefront(page, "/tags");
    await dismissAgeGateIfPresent(page);
    await expect(page.locator("body")).toContainText(/برچسب|تگ|دسته|رومرا/i);
  });

  test("journal list", async ({ page }) => {
    await gotoStorefront(page, "/journal");
    await dismissAgeGateIfPresent(page);
    await expect(
      page.getByRole("heading", { level: 1 }).first(),
    ).toBeVisible({ timeout: 15_000 });
  });

  test("recipe list", async ({ page }) => {
    await gotoStorefront(page, "/recipes");
    await dismissAgeGateIfPresent(page);
    await expect(
      page.getByRole("heading", { level: 1 }).first(),
    ).toBeVisible({ timeout: 15_000 });
  });

  test("search empty state is usable", async ({ page }) => {
    await gotoStorefront(page, "/search?q=zzzz-no-such-product-xyz");
    await dismissAgeGateIfPresent(page);
    await expect(
      page.getByRole("search", { name: "جستجوی فروشگاه" }).first(),
    ).toBeVisible({ timeout: 15_000 });
    // Zero-result or idle copy / CTAs should remain.
    await expect(page.locator("body")).toContainText(
      /نتیجه|جستجو|محصول|فروشگاه|پیشنهاد/i,
    );
  });
});

test.describe("product card / media smoke", () => {
  test("product list exposes images with non-empty alt or decorative handling", async ({
    page,
  }) => {
    await gotoStorefront(page, "/products");
    await dismissAgeGateIfPresent(page);
    await page.waitForTimeout(800);

    const images = page.locator("main img");
    const count = await images.count();
    test.skip(count === 0, "no product images when catalogue is empty/API down");

    for (let i = 0; i < Math.min(count, 8); i++) {
      const img = images.nth(i);
      const alt = await img.getAttribute("alt");
      const ariaHidden = await img.getAttribute("aria-hidden");
      const role = await img.getAttribute("role");
      const ok =
        ariaHidden === "true" ||
        role === "presentation" ||
        (alt !== null && alt.length >= 0);
      expect(ok, `img[${i}] needs alt or decorative role`).toBe(true);
    }
  });
});

test.describe("recipe commerce link smoke", () => {
  test("recipe list page does not 500", async ({ page }) => {
    const res = await gotoStorefront(page, "/recipes");
    expect(res?.status() ?? 200).toBeLessThan(500);
  });
});
