// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen } from "@testing-library/react";
import { useForm } from "react-hook-form";
import { afterEach, describe, expect, it } from "vitest";

import type { RecipeFormValues } from "@/features/recipes/validations";
import {
  editorialExcerptHint,
  editorialSlugHint,
} from "@/features/admin/shared/editorial-fields";

import { GeneralInfoSection } from "./GeneralInfoSection";

afterEach(cleanup);

function Harness({ mode }: { mode: "create" | "edit" }) {
  const { control, register } = useForm<RecipeFormValues>({
    defaultValues: {
      title: "",
      slug: "",
      excerpt: "کوکتل تلخ",
      content: "<p>x</p>",
      difficulty: "easy",
      prep_time_minutes: "",
      cook_time_minutes: "",
      servings: "",
      status: "draft",
      published_at: "",
      image_url: "",
      image_alt: "",
      og_image_url: "",
      is_featured: false,
      meta_title: "",
      meta_description: "",
      tag_ids: [],
      ingredients: [],
      products: [],
    },
  });
  return (
    <GeneralInfoSection
      control={control}
      register={register}
      errors={{}}
      mode={mode}
      onSlugEdit={() => {}}
    />
  );
}

describe("GeneralInfoSection editorial fields", () => {
  it("uses the shared excerpt and create-slug idiom", () => {
    render(<Harness mode="create" />);

    expect(screen.getByLabelText("عنوان")).toBeInTheDocument();
    expect(screen.getByLabelText("نامک")).toBeInTheDocument();
    expect(screen.getByLabelText("خلاصه").tagName).toBe("TEXTAREA");
    expect(screen.getByText(editorialSlugHint("create"))).toBeInTheDocument();
    expect(screen.getByText(editorialExcerptHint())).toBeInTheDocument();
    expect(screen.getByText(/۵۰۰/)).toBeInTheDocument();
  });

  it("says what a rename actually does to the old public URL", () => {
    render(<Harness mode="edit" />);
    const hint = screen.getByText(editorialSlugHint("edit"));
    expect(hint).toBeInTheDocument();
    // Not "the URL changes" and nothing more: the editor has to know the old
    // link survives via a permanent redirect, and when that redirect dies.
    expect(hint.textContent).toContain("تغییر مسیر دائمی");
    expect(hint.textContent).toContain("از کار می‌افتد");
  });
});
