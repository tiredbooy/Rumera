import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/features/motion/components/reveal", () => ({
  Reveal: ({ children }: { children: ReactNode }) => children,
}));

vi.mock("@/components/ui/accordion", () => ({
  Accordion: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  AccordionItem: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  AccordionTrigger: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  AccordionContent: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
}));

import { FaqView } from "./faq-view";

describe("FaqView", () => {
  it("does not invent a returns page, free-ship threshold, or guest checkout", () => {
    const markup = renderToStaticMarkup(<FaqView />);

    expect(markup).toContain("پرسش‌های پرتکرار");
    expect(markup).not.toContain("صفحهٔ بازگشت کالا");
    expect(markup).not.toContain("صفحهٔ بازگشت");
    expect(markup).not.toContain("۵٬۰۰۰٬۰۰۰");
    expect(markup).not.toContain("بدون حساب");
    expect(markup).toContain("صفحهٔ تماس با ما");
    expect(markup).toContain('href="/contact"');
    expect(markup).toContain("باید وارد حساب شوید");
  });
});
