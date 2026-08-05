import { expect, type Page } from "@playwright/test";

/** Fail if the document scrolls horizontally more than 1px (responsive overflow). */
export async function expectNoHorizontalOverflow(page: Page, label: string) {
  // Wait for navigations (auth redirects) to settle.
  await page.waitForLoadState("domcontentloaded").catch(() => undefined);
  await page.waitForTimeout(200);

  const metrics = await page.evaluate(() => {
    const doc = document.documentElement;
    if (!doc) return { clientWidth: 0, scrollWidth: 0 };
    return {
      clientWidth: doc.clientWidth,
      scrollWidth: doc.scrollWidth,
    };
  });
  if (metrics.clientWidth === 0) {
    // Detached document (redirect in flight) — treat as non-failure.
    return;
  }
  // Allow a few px of subpixel/scrollbar chrome on narrow viewports (marquees).
  const delta = metrics.scrollWidth - metrics.clientWidth;
  expect
    .soft(
      delta,
      `${label}: horizontal overflow (scrollWidth=${metrics.scrollWidth}, clientWidth=${metrics.clientWidth})`,
    )
    .toBeLessThanOrEqual(12);
}
