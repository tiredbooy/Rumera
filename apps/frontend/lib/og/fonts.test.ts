import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { loadOgFonts } from "./fonts";

describe("loadOgFonts", () => {
  it("loads vendored Vazirmatn weights used by opengraph-image", async () => {
    const fonts = await loadOgFonts([400, 600, 700]);
    expect(fonts).toHaveLength(3);
    for (const font of fonts) {
      expect(font.name).toBe("Vazirmatn");
      expect(font.data.byteLength).toBeGreaterThan(50_000);
      expect(font.style).toBe("normal");
    }
    expect(fonts.map((f) => f.weight)).toEqual([400, 600, 700]);
  });

  it("keeps TTF files present under public/fonts", async () => {
    for (const file of [
      "Vazirmatn-Regular.ttf",
      "Vazirmatn-SemiBold.ttf",
      "Vazirmatn-Bold.ttf",
    ]) {
      const buf = await readFile(join(process.cwd(), "public", "fonts", file));
      // TrueType magic "\0\1\0\0" or OTTO
      const head = buf.subarray(0, 4);
      const isTtf =
        (head[0] === 0 && head[1] === 1 && head[2] === 0 && head[3] === 0) ||
        head.toString("ascii") === "OTTO" ||
        head.toString("ascii") === "true";
      expect(isTtf).toBe(true);
    }
  });
});
