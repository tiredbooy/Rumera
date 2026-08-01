import { describe, expect, it } from "vitest";

import {
  journalCategoryFormSchema,
  journalCategoryParentOptions,
  journalPostFormSchema,
  normalizeJournalSlug,
  toCreateJournalCategoryInput,
  toCreateJournalPostInput,
  toUpdateJournalCategoryInput,
} from "./validations";

const postValues = {
  title: "  راهنمای انتخاب نوشیدنی  ",
  slug: "راهنمای-انتخاب-نوشیدنی",
  excerpt: "  خلاصه  ",
  content: "<p>متن نوشته</p>",
  image_url: "https://example.com/cover.webp",
  image_alt: "  بطری روی میز  ",
  time_to_read: "7",
  status: "draft" as const,
  is_featured: false,
  meta_title: "",
  meta_description: "",
  category_ids: [3, 3, 2],
  product_ids: [8, 8],
  tag_ids: [5, 4, 5],
};

describe("journal validations", () => {
  it("normalizes Unicode slugs and deduplicates relation IDs", () => {
    expect(normalizeJournalSlug("  راهنمای انتخاب نوشیدنی  ")).toBe(
      "راهنمای-انتخاب-نوشیدنی",
    );
    const parsed = journalPostFormSchema.parse(postValues);
    expect(toCreateJournalPostInput(parsed)).toEqual({
      title: "راهنمای انتخاب نوشیدنی",
      slug: "راهنمای-انتخاب-نوشیدنی",
      content: "<p>متن نوشته</p>",
      excerpt: "خلاصه",
      image_url: "https://example.com/cover.webp",
      image_alt: "بطری روی میز",
      time_to_read: 7,
      status: "draft",
      is_featured: false,
      meta_title: null,
      meta_description: null,
      category_ids: [3, 2],
      product_ids: [8],
      tag_ids: [5, 4],
    });
  });

  it("rejects visually empty rich text and images without alt text", () => {
    expect(
      journalPostFormSchema.safeParse({
        ...postValues,
        content: "<p><br></p>",
      }).success,
    ).toBe(false);
    const missingAlt = journalPostFormSchema.safeParse({
      ...postValues,
      image_alt: "",
    });
    expect(missingAlt.success).toBe(false);
    if (!missingAlt.success) {
      expect(missingAlt.error.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: ["image_alt"] }),
        ]),
      );
    }
  });

  it("maps category parent clearing truthfully on create and update", () => {
    const values = journalCategoryFormSchema.parse({
      name: "  راهنما  ",
      slug: "راهنما",
      description: "",
      parent_id: "",
    });
    const expected = {
      name: "راهنما",
      slug: "راهنما",
      description: null,
      parent_id: null,
    };
    expect(toCreateJournalCategoryInput(values)).toEqual(expected);
    expect(toUpdateJournalCategoryInput(values)).toEqual(expected);
  });

  it("excludes the edited category and all descendants from parent options", () => {
    const timestamp = "2026-08-01T10:00:00Z";
    const categories = [
      { id: 1, name: "ریشه", parent_id: null },
      { id: 2, name: "فرزند", parent_id: 1 },
      { id: 3, name: "نوه", parent_id: 2 },
      { id: 4, name: "مستقل", parent_id: null },
    ].map((category) => ({
      ...category,
      description: null,
      slug: null,
      created_at: timestamp,
      updated_at: timestamp,
    }));
    expect(
      journalCategoryParentOptions(categories, 1).map(
        (category) => category.id,
      ),
    ).toEqual([4]);
  });
});
