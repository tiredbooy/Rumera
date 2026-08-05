import { describe, expect, it } from "vitest";

import {
  BRAND_MARK_ASPECT,
  brandMarkBox,
  brandMarks,
  brandPaths,
} from "./brand";

describe("brand assets", () => {
  it("registers both light and dark source pairs with positive dimensions", () => {
    for (const pair of [brandMarks.onLight, brandMarks.onDark]) {
      expect(pair.svg.width).toBeGreaterThan(0);
      expect(pair.svg.height).toBeGreaterThan(0);
      expect(pair.png.src).toMatch(/^\/logo\//);
      expect(pair.svg.src).toMatch(/\.svg$/);
    }
    // Filenames retained as shipped (including Rumra-Dark typo).
    expect(brandMarks.onDark.png.src).toContain("Rumra-Dark");
    expect(brandMarks.onLight.png.src).toContain("Rumera-Light");
  });

  it("reserves a stable aspect box for CLS-safe layout", () => {
    expect(BRAND_MARK_ASPECT).toBeCloseTo(446 / 377, 5);
    const md = brandMarkBox("md");
    expect(md.height).toBe(36);
    expect(md.width).toBe(Math.round(36 * BRAND_MARK_ASPECT));
  });

  it("points install/metadata icons at the dark-field badge", () => {
    expect(brandPaths.iconPng).toBe(brandMarks.onDark.png.src);
    expect(brandPaths.appleTouch).toBe(brandMarks.onDark.png.src);
  });
});
