import { afterEach, describe, expect, it } from "vitest";

import {
  configuredMediaOrigin,
  isMediaPipelinePath,
  mediaTransformUrl,
  normalizeMediaStorageKey,
  resolveMediaUrl,
} from "./resolve-media-url";

const originalEnv = { ...process.env };

afterEach(() => {
  // Restore a full snapshot — do not `delete` ProcessEnv keys (read-only in TS).
  process.env = { ...originalEnv };
});

function env(partial: Record<string, string | undefined>): NodeJS.ProcessEnv {
  return { ...process.env, ...partial } as NodeJS.ProcessEnv;
}

describe("configuredMediaOrigin", () => {
  it("prefers MEDIA_BASE over API_URL and strips paths", () => {
    expect(
      configuredMediaOrigin(
        env({
          NEXT_PUBLIC_MEDIA_BASE_URL: "http://localhost:8080/extra/",
          NEXT_PUBLIC_API_URL: "http://localhost:9000",
          NODE_ENV: "development",
        }),
      ),
    ).toBe("http://localhost:8080");
  });

  it("falls back to the public API origin in local development", () => {
    expect(
      configuredMediaOrigin(
        env({
          NEXT_PUBLIC_API_URL: "http://localhost:8080",
          NODE_ENV: "development",
        }),
      ),
    ).toBe("http://localhost:8080");
  });

  it("rejects insecure configured origins in production (same-origin fallback)", () => {
    expect(
      configuredMediaOrigin(
        env({
          NEXT_PUBLIC_MEDIA_BASE_URL: "http://cdn.example",
          NEXT_PUBLIC_API_URL: "http://api.example",
          NODE_ENV: "production",
        }),
      ),
    ).toBe("");
  });

  it("accepts https configured origins in production", () => {
    expect(
      configuredMediaOrigin(
        env({
          NEXT_PUBLIC_MEDIA_BASE_URL: "https://media.rumera.test/",
          NODE_ENV: "production",
        }),
      ),
    ).toBe("https://media.rumera.test");
  });
});

describe("normalizeMediaStorageKey", () => {
  it("strips media prefixes and absolute origins", () => {
    expect(normalizeMediaStorageKey("products/a.webp")).toBe("products/a.webp");
    expect(normalizeMediaStorageKey("/media/products/a.webp")).toBe(
      "products/a.webp",
    );
    expect(
      normalizeMediaStorageKey("http://localhost:8080/media/products/a.webp"),
    ).toBe("products/a.webp");
    expect(normalizeMediaStorageKey("media/products/a.webp")).toBe(
      "products/a.webp",
    );
  });
});

describe("resolveMediaUrl", () => {
  const local = env({
    NEXT_PUBLIC_API_URL: "http://localhost:8080",
    NODE_ENV: "development",
  });

  it("joins backend-relative media paths to the API origin", () => {
    expect(resolveMediaUrl("/media/recipes/x.webp", local)).toBe(
      "http://localhost:8080/media/recipes/x.webp",
    );
  });

  it("preserves absolute URLs without double-prefixing", () => {
    expect(
      resolveMediaUrl("https://cdn.example/media/products/a.webp", local),
    ).toBe("https://cdn.example/media/products/a.webp");
    expect(
      resolveMediaUrl("http://localhost:8080/media/products/a.webp", local),
    ).toBe("http://localhost:8080/media/products/a.webp");
  });

  it("preserves blob/data previews and same-origin static assets", () => {
    expect(resolveMediaUrl("blob:http://localhost/abc", local)).toBe(
      "blob:http://localhost/abc",
    );
    expect(resolveMediaUrl("/images/hero/slide-1.jpg", local)).toBe(
      "/images/hero/slide-1.jpg",
    );
  });

  it("collapses accidental /media/media prefixes", () => {
    expect(resolveMediaUrl("/media/media/products/a.webp", local)).toBe(
      "http://localhost:8080/media/products/a.webp",
    );
  });

  it("returns null for empty input", () => {
    expect(resolveMediaUrl("  ", local)).toBeNull();
    expect(resolveMediaUrl(null, local)).toBeNull();
  });

  it("uses same-origin media paths when no origin is configured", () => {
    expect(resolveMediaUrl("/media/x.webp", env({ NODE_ENV: "development" }))).toBe(
      "/media/x.webp",
    );
  });
});

describe("mediaTransformUrl", () => {
  const local = env({
    NEXT_PUBLIC_API_URL: "http://localhost:8080",
    NODE_ENV: "development",
  });

  it("builds transform URLs without duplicating /media", () => {
    expect(mediaTransformUrl("products/a.webp", { f: "webp", w: 400 }, local)).toBe(
      "http://localhost:8080/media/products/a.webp?f=webp&w=400",
    );
    expect(
      mediaTransformUrl("/media/products/a.webp", { f: "avif" }, local),
    ).toBe("http://localhost:8080/media/products/a.webp?f=avif");
  });
});

describe("isMediaPipelinePath", () => {
  it("detects relative and absolute media pipeline paths", () => {
    expect(isMediaPipelinePath("/media/x.webp")).toBe(true);
    expect(isMediaPipelinePath("https://api.test/media/x.webp")).toBe(true);
    expect(isMediaPipelinePath("/images/hero.jpg")).toBe(false);
  });
});
