import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { formatPrice } from "@/lib/products";

import { PromoBar } from "./promo-bar";

describe("PromoBar", () => {
  it("renders the live announcement and no hardcoded ۵٬۰۰۰٬۰۰۰", () => {
    const live = `ارسال رایگان برای سفارش‌های بالای ${formatPrice(6_000_000)} — با ضمانت اصالت`;
    const markup = renderToStaticMarkup(<PromoBar announcement={live} />);

    expect(markup).toContain(formatPrice(6_000_000));
    expect(markup).not.toContain("۵٬۰۰۰٬۰۰۰");
  });

  it("renders nothing when settings have no free-ship copy", () => {
    expect(renderToStaticMarkup(<PromoBar />)).toBe("");
    expect(renderToStaticMarkup(<PromoBar announcement="" />)).toBe("");
  });
});
