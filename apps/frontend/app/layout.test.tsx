import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/font/google", () => ({
  Vazirmatn: () => ({ variable: "font-sans" }),
  Markazi_Text: () => ({ variable: "font-serif" }),
}));

vi.mock("@/app/providers", () => ({
  Providers: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock("@/components/ui/sonner", () => ({ Toaster: () => null }));

import RootLayout from "./layout";

describe("RootLayout skip navigation", () => {
  it("renders the skip link before the shared main target", () => {
    const markup = renderToStaticMarkup(
      <RootLayout>
        <main id="main-content" tabIndex={-1}>
          محتوا
        </main>
      </RootLayout>,
    );

    const skipLink = markup.indexOf('href="#main-content"');
    const mainTarget = markup.indexOf('id="main-content"');

    expect(skipLink).toBeGreaterThan(-1);
    expect(mainTarget).toBeGreaterThan(skipLink);
    expect(markup).toContain("رفتن به محتوای اصلی");
  });
});
