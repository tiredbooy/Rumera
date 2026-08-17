import { describe, expect, it } from "vitest";

import {
  categorySelectOptions,
  type CategorySelectSource,
} from "./category-select-options";

function cat(
  id: number,
  title: string,
  parent_id?: number | null,
): CategorySelectSource {
  return { id, title, parent_id };
}

describe("categorySelectOptions", () => {
  it("labels a root with its title alone", () => {
    expect(categorySelectOptions([cat(1, "اسپیریتس")])).toEqual([
      { id: 1, title: "اسپیریتس" },
    ]);
  });

  it("prefixes a child with its parent title", () => {
    const options = categorySelectOptions([
      cat(1, "پدربخش"),
      cat(2, "فرزند", 1),
    ]);

    expect(options).toEqual([
      { id: 1, title: "پدربخش" },
      { id: 2, title: "پدربخش / فرزند" },
    ]);
  });

  it("walks nested ancestors without inventing ids", () => {
    const options = categorySelectOptions([
      cat(3, "ویکی", 2),
      cat(1, "اسپیریتس"),
      cat(2, "اسکاچ", 1),
    ]);

    expect(options.map((option) => option.id)).toEqual([3, 1, 2]);
    expect(options).toEqual([
      { id: 3, title: "اسپیریتس / اسکاچ / ویکی" },
      { id: 1, title: "اسپیریتس" },
      { id: 2, title: "اسپیریتس / اسکاچ" },
    ]);
  });

  it("falls back to the title when the parent is missing from the page", () => {
    expect(categorySelectOptions([cat(8, "فرزند یتیم", 99)])).toEqual([
      { id: 8, title: "فرزند یتیم" },
    ]);
  });

  it("does not loop on a parent cycle", () => {
    const options = categorySelectOptions([
      cat(1, "آلفا", 2),
      cat(2, "بتا", 1),
    ]);

    expect(options).toHaveLength(2);
    expect(options[0]).toEqual({ id: 1, title: "بتا / آلفا" });
    expect(options[1]).toEqual({ id: 2, title: "آلفا / بتا" });
    for (const option of options) {
      expect(option.title.split(" / ").length).toBeLessThanOrEqual(2);
    }
  });

  it("falls back to the title on a self-parent cycle", () => {
    expect(categorySelectOptions([cat(4, "حلقه", 4)])).toEqual([
      { id: 4, title: "حلقه" },
    ]);
  });
});
