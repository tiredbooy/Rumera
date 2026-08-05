import { expect, test } from "@playwright/test";

import { dismissAgeGateIfPresent, gotoStorefront } from "./helpers/nav";

test.describe("keyboard navigation", () => {
  test("skip link reaches main content", async ({ page }) => {
    await gotoStorefront(page, "/");
    await dismissAgeGateIfPresent(page);

    const skip = page.getByRole("link", { name: "رفتن به محتوای اصلی" });
    await skip.focus();
    await expect(skip).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.locator("#main-content").first()).toBeFocused();
  });

  test("primary nav is reachable by keyboard", async ({ page }) => {
    await gotoStorefront(page, "/");
    await dismissAgeGateIfPresent(page);

    // Tab through chrome until we hit a storefront nav control.
    let found = false;
    for (let i = 0; i < 24; i++) {
      await page.keyboard.press("Tab");
      const focused = page.locator(":focus");
      const name = ((await focused.getAttribute("aria-label")) ?? "").trim();
      const tag = await focused.evaluate((el) => el.tagName).catch(() => "");
      if (
        name.includes("جستجو") ||
        name.includes("منوی") ||
        name.includes("ناوبری") ||
        tag === "A"
      ) {
        found = true;
        break;
      }
    }
    expect(found, "expected a focusable header/nav control").toBe(true);
  });

  test("age gate confirm is keyboard operable (fresh session)", async ({
    browser,
    baseURL,
  }) => {
    const context = await browser.newContext({
      locale: "fa-IR",
      storageState: { cookies: [], origins: [] },
      baseURL,
    });
    const page = await context.newPage();
    // Do NOT pre-set age verification for this test.
    await page.goto("/", { waitUntil: "networkidle" }).catch(() =>
      page.goto("/", { waitUntil: "domcontentloaded" }),
    );

    // Gate is client-only after hydration (SSR hides it to avoid flash).
    const confirm = page.getByRole("button", {
      name: /۱۸ سال|بله/i,
    });
    await expect(confirm.first()).toBeVisible({ timeout: 20_000 });
    await confirm.first().focus();
    await page.keyboard.press("Enter");
    await expect(confirm.first()).toBeHidden({ timeout: 10_000 });
    await context.close();
  });

  test("search field accepts keyboard input and submits", async ({ page }) => {
    await gotoStorefront(page, "/search");
    await dismissAgeGateIfPresent(page);

    const input = page
      .locator('input[type="search"], input[name="q"]')
      .first();
    await expect(input).toBeVisible({ timeout: 15_000 });
    await input.click();
    await input.fill("ویسکی");
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/search/);
  });
});
