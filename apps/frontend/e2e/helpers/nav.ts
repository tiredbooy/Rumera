import { expect, type Page } from "@playwright/test";

const AGE_KEY = "rumera:age-verified";

/** Ensure age gate is cleared even if storageState origin mismatches. */
export async function ensureAgeVerified(page: Page) {
  await page.addInitScript((key) => {
    try {
      window.localStorage.setItem(key, "true");
    } catch {
      // ignore
    }
  }, AGE_KEY);
}

/** Navigate and wait for main landmark (works for soft-fail / skeleton pages). */
export async function gotoStorefront(page: Page, path = "/") {
  await ensureAgeVerified(page);
  const response = await page.goto(path, { waitUntil: "domcontentloaded" });
  // Allow soft client recovery when API is down (still expect a document).
  await expect(page.locator("body")).toBeVisible();
  return response;
}

export async function dismissAgeGateIfPresent(page: Page) {
  const confirm = page.getByRole("button", {
    name: /بله، ۱۸ سال|۱۸ سال یا بیشتر/i,
  });
  if (await confirm.isVisible({ timeout: 2500 }).catch(() => false)) {
    await confirm.click();
    await expect(confirm).toBeHidden({ timeout: 5000 }).catch(() => undefined);
  }
}
