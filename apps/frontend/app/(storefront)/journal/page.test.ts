import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ view: vi.fn(() => null) }));

vi.mock("@/features/journal/components/journal-list-view", () => ({
  JournalListView: mocks.view,
}));

import JournalPage, { generateMetadata } from "./page";

describe("journal list route", () => {
  it("forwards the promised Next 16 search params", () => {
    const searchParams = Promise.resolve({ page: ["2", "3"] });
    const element = JournalPage({ searchParams });
    expect(element.props.searchParams).toBe(searchParams);
  });

  it("self-canonicalizes clean paginated pages", async () => {
    const metadata = await generateMetadata({
      searchParams: Promise.resolve({ page: "2" }),
    });
    expect(String(metadata.title)).toContain("صفحهٔ ۲");
    expect(metadata.alternates?.canonical).toBe(
      "http://localhost:3000/journal?page=2",
    );
    expect(metadata.robots).toBeUndefined();
  });

  it("noindexes search, sort, and malformed variants at the clean canonical", async () => {
    for (const searchParams of [
      { q: "مالت", page: "2" },
      { sort: "popular", page: "3" },
      { page: ["2", "3"] },
    ]) {
      const metadata = await generateMetadata({
        searchParams: Promise.resolve(searchParams),
      });
      expect(metadata.robots).toMatchObject({ index: false, follow: false });
      expect(metadata.alternates?.canonical).toBe(
        "http://localhost:3000/journal",
      );
    }
  });
});
