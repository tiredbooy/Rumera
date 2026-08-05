import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";

/**
 * Run axe against the current page. Fail only on serious/critical violations
 * so color-contrast noise in third-party chrome does not block the suite.
 */
export async function expectNoCriticalA11y(page: Page, context?: string) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    // Next.js dev overlays / toast portals occasionally trip region rules.
    .exclude(["#nextjs__container_errors", "[data-sonner-toaster]"])
    .analyze();

  const blocking = results.violations.filter(
    (v) => v.impact === "critical" || v.impact === "serious",
  );

  expect
    .soft(
      blocking,
      [
        context ? `a11y (${context})` : "a11y",
        ...blocking.map(
          (v) =>
            `${v.id} [${v.impact}] ${v.help} — nodes: ${v.nodes.length}`,
        ),
      ].join("\n"),
    )
    .toEqual([]);
}
