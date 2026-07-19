import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getTag: vi.fn(),
  listAllTags: vi.fn(),
}));

vi.mock("@/features/catalog/tags/api/public", () => ({
  getTag: mocks.getTag,
  listAllTags: mocks.listAllTags,
}));
vi.mock("@/features/catalog/tags/components/tag-detail-view", () => ({
  TagDetailView: () => null,
}));

import { generateMetadata, generateStaticParams } from "./page";

const tag = {
  id: 7,
  title: "هدیه",
  slug: "gift",
  description: "برای هدیه",
  created_at: "2026-07-18T00:00:00Z",
  updated_at: "2026-07-19T00:00:00Z",
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getTag.mockResolvedValue(tag);
  mocks.listAllTags.mockResolvedValue([tag]);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("tag detail route metadata", () => {
  it("generates only numeric static parameters", async () => {
    mocks.listAllTags.mockResolvedValue([tag, { ...tag, id: 12 }]);

    await expect(generateStaticParams()).resolves.toEqual([
      { id: "7" },
      { id: "12" },
    ]);
  });

  it("returns an empty static set and logs only safe failure context", async () => {
    mocks.listAllTags.mockRejectedValue(new Error("token=server-secret"));
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    await expect(generateStaticParams()).resolves.toEqual([]);
    expect(consoleError).toHaveBeenCalledWith(
      "generateStaticParams: failed to load tag ids",
      { name: "Error" },
    );
    expect(JSON.stringify(consoleError.mock.calls)).not.toContain(
      "server-secret",
    );
  });

  it("builds canonical metadata from the live tag", async () => {
    const metadata = await generateMetadata({
      params: Promise.resolve({ id: "7" }),
    });

    expect(metadata.title).toBe(tag.title);
    expect(metadata.description).toBe(tag.description);
    expect(metadata.keywords).toEqual([tag.title]);
    expect(metadata.alternates?.canonical).toBe("http://localhost:3000/tags/7");
    expect(metadata.robots).toBeUndefined();
  });

  it("noindexes malformed and missing tag IDs with accurate canonicals", async () => {
    const malformed = await generateMetadata({
      params: Promise.resolve({ id: "01" }),
    });
    expect(malformed.robots).toMatchObject({ index: false, follow: false });
    expect(malformed.alternates?.canonical).toBe("http://localhost:3000/tags");
    expect(mocks.getTag).not.toHaveBeenCalled();

    mocks.getTag.mockResolvedValue(null);
    const missing = await generateMetadata({
      params: Promise.resolve({ id: "99" }),
    });
    expect(missing.robots).toMatchObject({ index: false, follow: false });
    expect(missing.alternates?.canonical).toBe("http://localhost:3000/tags/99");
  });

  it("propagates non-404 metadata failures", async () => {
    const failure = new Error("upstream unavailable");
    mocks.getTag.mockRejectedValue(failure);

    await expect(
      generateMetadata({ params: Promise.resolve({ id: "7" }) }),
    ).rejects.toBe(failure);
  });
});
