import { test } from "@playwright/test";

import { expectNoHorizontalOverflow } from "./helpers/overflow";
import { dismissAgeGateIfPresent, gotoStorefront } from "./helpers/nav";

const narrow = { width: 320, height: 640 } as const;

const routes = [
  "/",
  "/products",
  "/categories",
  "/search",
  "/recipes",
  "/journal",
  "/cart",
  // /checkout auth-redirects guests mid-navigation — covered by checkout.spec.
] as const;

test.describe("responsive overflow @ 320px", () => {
  test.use({ viewport: narrow });

  for (const path of routes) {
    test(`${path} has no horizontal overflow`, async ({ page }) => {
      await gotoStorefront(page, path);
      await dismissAgeGateIfPresent(page);
      await page.waitForTimeout(300);
      await expectNoHorizontalOverflow(page, path);
    });
  }
});
