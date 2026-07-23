// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import * as React from "react";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { Controller } from "react-hook-form";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type {
  ImageUploaderHandle,
  UploadedImage,
} from "@/features/image-uploader/types";

type ContentImageHandle = ImageUploaderHandle<UploadedImage | null>;

const { createRecipeMock, coverFlushMock, pushMock, refreshMock, mediaState } =
  vi.hoisted(() => ({
    createRecipeMock: vi.fn(),
    coverFlushMock: vi.fn(),
    pushMock: vi.fn(),
    refreshMock: vi.fn(),
    mediaState: { ogError: null as string | null },
  }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, refresh: refreshMock }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

vi.mock("@/features/recipes/api/client", () => ({
  RecipeApiError: class RecipeApiError extends Error {},
  createRecipe: createRecipeMock,
  updateRecipe: vi.fn(),
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
  SeoSection: ({
    mediaRef,
    errors,
  }: {
    mediaRef: React.Ref<ContentImageHandle>;
    errors: { og_image_url?: { message?: string } };
  }) => {
    const initialized = React.useRef(false);
    React.useEffect(() => {
      if (initialized.current) return;
      initialized.current = true;
      if (typeof mediaRef === "function") {
        mediaRef({
          hasStaged: false,
          isBusy: false,
          validate: () => mediaState.ogError,
          flush: vi.fn(),
        });
      } else if (mediaRef) {
        mediaRef.current = {
          hasStaged: false,
          isBusy: false,
          validate: () => mediaState.ogError,
          flush: vi.fn(),
        };
      }
    });
    return errors.og_image_url?.message ? (
      <p role="alert">{errors.og_image_url.message}</p>
    ) : null;
  },
}));

vi.mock("./recipe-form/RecipeSidebar", () => ({
  RecipeSidebar: ({
    mediaRef,
    submitLabel,
  }: {
    mediaRef: React.Ref<ContentImageHandle>;
    submitLabel: string;
  }) => {
    const initialized = React.useRef(false);
    React.useEffect(() => {
      if (initialized.current) return;
      initialized.current = true;
      if (typeof mediaRef === "function") {
        mediaRef({
          hasStaged: true,
          isBusy: false,
          validate: () => null,
          flush: coverFlushMock,
        });
      } else if (mediaRef) {
        mediaRef.current = {
          hasStaged: true,
          isBusy: false,
          validate: () => null,
          flush: coverFlushMock,
        };
      }
    });
    return <button type="submit">{submitLabel}</button>;
  },
}));

import { RecipeForm } from "./RecipeForm";

afterEach(cleanup);

beforeEach(() => {
  createRecipeMock.mockReset();
  coverFlushMock.mockReset();
  pushMock.mockReset();
  refreshMock.mockReset();
  mediaState.ogError = null;
  createRecipeMock.mockResolvedValue({ id: 52, image_url: null });
  coverFlushMock.mockResolvedValue({
    url: "/media/recipes/52/cover-image.webp",
    key: "recipes/52/cover-image.webp",
    width: 1200,
    height: 900,
  });
});

describe("RecipeForm owner-aware media", () => {
  it("creates the owner before flushing a staged cover", async () => {
    render(<RecipeForm mode="create" tags={[]} submitLabel="ذخیره" />);
    fireEvent.change(screen.getByLabelText("عنوان دستور"), {
      target: { value: "دستور محلی" },
    });
    fireEvent.change(screen.getByLabelText("محتوا"), {
      target: { value: "<p>مراحل دستور</p>" },
    });
    fireEvent.click(screen.getByRole("button", { name: "ذخیره" }));

    await waitFor(() => expect(createRecipeMock).toHaveBeenCalledTimes(1));
    expect(createRecipeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "دستور محلی",
        image_url: null,
      }),
    );
    expect(coverFlushMock).toHaveBeenCalledWith(52);
    expect(pushMock).toHaveBeenCalledWith("/admin/recipes");
  });

  it("attributes an OG upload validation failure to the OG field", async () => {
    mediaState.ogError = "فرمت تصویر اشتراک‌گذاری معتبر نیست";
    render(<RecipeForm mode="create" tags={[]} submitLabel="ذخیره" />);
    fireEvent.change(screen.getByLabelText("عنوان دستور"), {
      target: { value: "دستور محلی" },
    });
    fireEvent.change(screen.getByLabelText("محتوا"), {
      target: { value: "<p>مراحل دستور</p>" },
    });
    fireEvent.click(screen.getByRole("button", { name: "ذخیره" }));

    expect(
      await screen.findByRole("alert", {
        name: "",
      }),
    ).toHaveTextContent("فرمت تصویر اشتراک‌گذاری معتبر نیست");
    expect(createRecipeMock).not.toHaveBeenCalled();
  });
});
