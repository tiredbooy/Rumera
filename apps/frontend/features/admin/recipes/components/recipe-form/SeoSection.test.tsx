// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen } from "@testing-library/react";
import { useForm } from "react-hook-form";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { RecipeFormValues } from "@/features/recipes/validations";

vi.mock("@/features/image-uploader/ImageInput", () => ({
  ImageInput: () => <input aria-label="تصویر اشتراک‌گذاری" />,
}));

import { SeoSection } from "./SeoSection";

function Harness() {
  const { register, control, formState } = useForm<RecipeFormValues>({
    defaultValues: {
      title: "موهیتو",
      slug: "mojito",
      excerpt: "نوشیدنی خنک",
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
      canonical_url: "",
      meta_keywords: "",
      tag_ids: [],
      ingredients: [],
      products: [],
    },
  });
  return (
    <SeoSection
      register={register}
      control={control}
      errors={formState.errors}
    />
  );
}

afterEach(cleanup);

describe("SeoSection", () => {
  it("exposes the storefront SEO fields and fallback preview", () => {
    render(<Harness />);
    expect(screen.getByLabelText("عنوان سئو")).toBeInTheDocument();
    expect(screen.getByLabelText("توضیحات سئو")).toBeInTheDocument();
    expect(screen.getByLabelText("نشانی کانونیکال")).toBeInTheDocument();
    expect(screen.getByLabelText("کلیدواژه‌ها")).toBeInTheDocument();
    expect(screen.getByText("پیش‌نمایش نتیجهٔ گوگل")).toBeInTheDocument();
    expect(screen.getByText(/خالی = عنوان دستور/)).toBeInTheDocument();
    expect(screen.getByText(/خالی = خلاصه/)).toBeInTheDocument();
  });
});
