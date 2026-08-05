import { expect, test } from "@playwright/test";

/**
 * Admin surfaces require staff session. Without credentials we assert the
 * gate redirects or shows forbidden/login — not a raw 500.
 */
test.describe("admin auth gate", () => {
  test("admin root is protected", async ({ page }) => {
    const res = await page.goto("/admin", { waitUntil: "domcontentloaded" });
    const status = res?.status() ?? 0;
    expect(status).toBeLessThan(500);

    await page.waitForTimeout(400);
    const url = page.url();
    const body = await page.locator("body").innerText();

    const gated =
      /login|sign-in|auth|ورود|forbidden|403|مجاز|دسترسی|permission/i.test(
        `${url}\n${body}`,
      ) || url.includes("/admin") === false;

    expect(
      gated || status === 401 || status === 403 || status === 307 || status === 302,
      `expected auth gate, got status=${status} url=${url}`,
    ).toBeTruthy();
  });
});
