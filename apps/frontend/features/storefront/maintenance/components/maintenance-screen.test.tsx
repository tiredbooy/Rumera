import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/image", () => ({
  default: ({
    src,
    alt,
    className,
    width,
    height,
  }: {
    src: string;
    alt: string;
    className?: string;
    width?: number;
    height?: number;
  }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className={className}
      width={width}
      height={height}
    />
  ),
}));

import { MaintenanceScreen } from "./maintenance-screen";

describe("MaintenanceScreen", () => {
  it("renders the given message and no shopping chrome or CTAs", () => {
    const markup = renderToStaticMarkup(
      <MaintenanceScreen message="ظهر برمی‌گردیم." />,
    );

    expect(markup).toContain("ظهر برمی‌گردیم.");
    expect(markup).toContain('id="main-content"');
    expect(markup).not.toContain("href=\"/\"");
    expect(markup).not.toContain("/products");
    expect(markup).not.toContain("/cart");
    expect(markup).not.toContain("/checkout");
  });
});
