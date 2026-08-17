// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import {
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AdminRecipeDetail } from "@/features/recipes/types";

const mocks = vi.hoisted(() => ({
  createRecipe: vi.fn(),
  updateRecipe: vi.fn(),
  deleteRecipe: vi.fn(),
  push: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

vi.mock("@/features/recipes/api/client", () => ({
  RecipeApiError: class RecipeApiError extends Error {},
  createRecipe: mocks.createRecipe,
  updateRecipe: mocks.updateRecipe,
  deleteRecipe: mocks.deleteRecipe,
}));

vi.mock("./recipe-form/GeneralInfoSection", () => ({
  GeneralInfoSection: ({
    register,
  }: {
    register: (name: "title") => object;
  }) => <input aria-label="عنوان دستور" {...register("title")} />,
}));

vi.mock("./recipe-form/ContentSection", () => ({
  ContentSection: () => null,
}));
vi.mock("./recipe-form/SpecificationsSection", () => ({
  SpecificationsSection: () => null,
}));
vi.mock("./recipe-form/IngredientsSection", () => ({
  IngredientsSection: () => null,
}));
vi.mock("./recipe-form/ShoppableProductsSection", () => ({
  ShoppableProductsSection: () => null,
}));
vi.mock("./recipe-form/SeoSection", () => ({
  SeoSection: () => null,
}));

vi.mock("./recipe-form/RecipeSidebar", () => ({
  RecipeSidebar: ({
    submitLabel,
    canWrite = true,
    canDelete,
    onDelete,
  }: {
    submitLabel: string;
    canWrite?: boolean;
    canDelete?: boolean;
    onDelete?: () => void;
  }) => (
    <>
      {canWrite ? <button type="submit">{submitLabel}</button> : null}
      {canWrite && canDelete && onDelete ? (
        <button type="button" onClick={onDelete}>
          حذف دستور
        </button>
      ) : null}
    </>
  ),
}));

import { RecipeForm } from "./RecipeForm";

const recipe = {
  id: 7,
  title: "نگroni",
  slug: "negroni",
  excerpt: "",
  content: "<p>هم بزنید</p>",
  difficulty: "easy",
  prep_time_minutes: 5,
  cook_time_minutes: 0,
  servings: 1,
  status: "draft",
  image_url: "",
  image_alt: "",
  og_image_url: "",
  is_featured: false,
  meta_title: "",
  meta_description: "",
  tags: [],
  ingredients: [],
  products: [],
} as unknown as AdminRecipeDetail;

afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("RecipeForm write gate", () => {
  it("does not submit when canWrite is false", () => {
    render(
      <RecipeForm
        mode="edit"
        recipe={recipe}
        tags={[]}
        submitLabel="ذخیرهٔ تغییرات"
        canWrite={false}
      />,
    );

    expect(
      screen.getByText(/فقط مشاهده — ذخیره، بارگذاری تصویر و حذف دستور/),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "ذخیرهٔ تغییرات" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "حذف دستور" }),
    ).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("عنوان دستور"), {
      target: { value: "نگroni اصلاح‌شده" },
    });
    fireEvent.submit(document.querySelector("form")!);

    expect(mocks.updateRecipe).not.toHaveBeenCalled();
    expect(mocks.createRecipe).not.toHaveBeenCalled();
    expect(mocks.deleteRecipe).not.toHaveBeenCalled();
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it("keeps save when the operator can write", () => {
    render(
      <RecipeForm
        mode="edit"
        recipe={recipe}
        tags={[]}
        submitLabel="ذخیرهٔ تغییرات"
        canWrite
      />,
    );

    expect(
      screen.queryByText(/فقط مشاهده — ذخیره، بارگذاری تصویر و حذف دستور/),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "ذخیرهٔ تغییرات" }),
    ).toBeInTheDocument();
  });
});
