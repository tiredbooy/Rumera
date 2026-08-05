import { readFile } from "node:fs/promises";
import { join } from "node:path";

export type OgFontWeight = 400 | 600 | 700;

const weightFile: Record<OgFontWeight, string> = {
  400: "Vazirmatn-Regular.ttf",
  600: "Vazirmatn-SemiBold.ttf",
  700: "Vazirmatn-Bold.ttf",
};

export type OgFont = {
  name: string;
  data: ArrayBuffer;
  weight: OgFontWeight;
  style: "normal";
};

/**
 * Load vendored Vazirmatn TTFs for `next/og` ImageResponse.
 * Paths are relative to the frontend app root (`process.cwd()` in Next).
 */
export async function loadOgFonts(
  weights: OgFontWeight[] = [400, 600],
): Promise<OgFont[]> {
  const fontsDir = join(process.cwd(), "public", "fonts");
  return Promise.all(
    weights.map(async (weight) => {
      const buf = await readFile(join(fontsDir, weightFile[weight]));
      // Copy into a fresh ArrayBuffer (Node Buffer may be a view of a pool).
      const data = buf.buffer.slice(
        buf.byteOffset,
        buf.byteOffset + buf.byteLength,
      ) as ArrayBuffer;
      return {
        name: "Vazirmatn",
        data,
        weight,
        style: "normal" as const,
      };
    }),
  );
}
