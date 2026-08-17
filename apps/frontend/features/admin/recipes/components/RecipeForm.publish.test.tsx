// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { Controller, useController } from "react-hook-form";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AdminRecipeDetail } from "@/features/recipes/types";
import type { RecipeFormValues } from "@/features/recipes/validations";

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
  ContentSection: ({ control }: { control: never }) => (
    <Controller
      control={control}
      name="content"
      render={({ field }) => <textarea aria-label="محتوا" {...field} />}
    />
  ),
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
    control,
    submitLabel,
  }: {
    control: never;
    submitLabel: string;
  }) => {
    const status = useController<RecipeFormValues, "status">({
      control,
      name: "status",
    });
    const publishedAt = useController<RecipeFormValues, "published_at">({
      control,
      name: "published_at",
    });
    return (
      <>
        <label>
          وضعیت انتشار
          <select
            aria-label="وضعیت انتشار"
            value={status.field.value}
            onChange={(event) => status.field.onChange(event.target.value)}
          >
            <option value="draft">پیش‌نویس</option>
            <option value="published">منتشرشده</option>
            <option value="archived">بایگانی‌شده</option>
          </select>
        </label>
        <label>
          زمان انتشار
          <input
            aria-label="زمان انتشار"
            value={publishedAt.field.value}
            onChange={(event) => publishedAt.field.onChange(event.target.value)}
          />
        </label>
        <button type="submit">{submitLabel}</button>
      </>
    );
  },
}));

import { RecipeForm } from "./RecipeForm";

const liveRecipe = {
  id: 7,
  title: "نگroni",
  slug: "negroni",
  excerpt: "",
  content: "<p>هم بزنید</p>",
  difficulty: "easy",
  prep_time_minutes: 5,
  cook_time_minutes: 0,
  servings: 1,
  status: "published",
  published_at: "2026-08-01T10:00:00Z",
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
  mocks.updateRecipe.mockResolvedValue({ id: 7 });
  mocks.createRecipe.mockResolvedValue({ id: 8 });
});

describe("RecipeForm publish workflow", () => {
  it("asks before pulling a live recipe down", async () => {
    render(
      <RecipeForm
        mode="edit"
        recipe={liveRecipe}
        tags={[]}
        submitLabel="ذخیرهٔ تغییرات"
        canWrite
      />,
    );

    fireEvent.change(screen.getByLabelText("وضعیت انتشار"), {
      target: { value: "draft" },
    });
    fireEvent.click(screen.getByRole("button", { name: "ذخیرهٔ تغییرات" }));

    expect(
      await screen.findByRole("alertdialog"),
    ).toHaveTextContent("برداشتن از انتشار");
    expect(mocks.updateRecipe).not.toHaveBeenCalled();

    fireEvent.click(
      screen.getByRole("button", { name: "تأیید برداشتن از انتشار" }),
    );
    await waitFor(() => expect(mocks.updateRecipe).toHaveBeenCalled());
    expect(mocks.updateRecipe.mock.calls[0]?.[1]).toMatchObject({
      status: "draft",
    });
  });

  it("sends a future published_at as the schedule", async () => {
    render(
      <RecipeForm
        mode="create"
        tags={[]}
        submitLabel="ساخت دستور"
        canWrite
      />,
    );

    fireEvent.change(screen.getByLabelText("عنوان دستور"), {
      target: { value: "موهیتو" },
    });
    fireEvent.change(screen.getByLabelText("محتوا"), {
      target: { value: "<p>هم بزنید</p>" },
    });
    fireEvent.change(screen.getByLabelText("وضعیت انتشار"), {
      target: { value: "published" },
    });
    fireEvent.change(screen.getByLabelText("زمان انتشار"), {
      target: { value: "2026-12-01T18:00" },
    });
    fireEvent.click(screen.getByRole("button", { name: "ساخت دستور" }));

    await waitFor(() => expect(mocks.createRecipe).toHaveBeenCalled());
    const payload = mocks.createRecipe.mock.calls[0]?.[0] as {
      published_at?: string;
      status?: string;
    };
    expect(payload.status).toBe("published");
    expect(payload.published_at).toBe(
      new Date("2026-12-01T18:00").toISOString(),
    );
  });
});
