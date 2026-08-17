import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/features/motion/components/reveal", () => ({
  Reveal: ({ children }: { children: ReactNode }) => children,
}));

vi.mock("@/components/smart-image", () => ({
  SmartImage: ({ alt }: { alt: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt={alt} />
  ),
}));

import { AboutView } from "./about-view";

describe("AboutView", () => {
  it("does not invent catalogue counts, ratings, or province coverage", () => {
    const markup = renderToStaticMarkup(<AboutView />);

    expect(markup).toContain("دربارهٔ رومرا");
    expect(markup).not.toContain("۱٬۲۰۰");
    expect(markup).not.toContain("+۸۰");
    expect(markup).not.toContain("۴٫۹");
    expect(markup).not.toContain("۳۲ استان");
    expect(markup).not.toContain("استان زیر پوشش");
    expect(markup).not.toContain("میانگین رضایت");
  });
});
