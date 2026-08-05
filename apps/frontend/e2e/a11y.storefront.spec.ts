import { test } from "@playwright/test";

import { expectNoCriticalA11y } from "./helpers/a11y";
import { dismissAgeGateIfPresent, gotoStorefront } from "./helpers/nav";

const routes = [
  { path: "/", name: "home" },
  { path: "/products", name: "products" },
  { path: "/categories", name: "categories" },
  { path: "/search", name: "search" },
  { path: "/recipes", name: "recipes" },
  { path: "/journal", name: "journal" },
  { path: "/tags", name: "tags" },
  { path: "/cart", name: "cart" },
  { path: "/offline", name: "offline" },
  // Checkout redirects guests to login — scan the auth surface instead.
  { path: "/login", name: "login" },
] as const;

test.describe("storefront axe (critical/serious)", () => {
  for (const route of routes) {
    test(`${route.name} (${route.path})`, async ({ page }) => {
      await gotoStorefront(page, route.path);
      await dismissAgeGateIfPresent(page);
      // Let client recovery / soft-fail content settle.
      await page.waitForTimeout(500);
      await expectNoCriticalA11y(page, route.path);
    });
  }
});
