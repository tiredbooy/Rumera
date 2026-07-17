import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { RolesView } from "./roles-view";

describe("RolesView permission matrix", () => {
  it("exposes text alternatives for granted and denied permissions", () => {
    const markup = renderToStaticMarkup(<RolesView />);

    expect(markup).toContain('<span class="sr-only">دسترسی دارد</span>');
    expect(markup).toContain('<span class="sr-only">دسترسی ندارد</span>');
  });
});
