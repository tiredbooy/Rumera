// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type { Ref } from "react";
import type { UseFormRegister, UseFormSetValue } from "react-hook-form";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AdminProductDetail } from "@/features/admin/products/types";
import type { ProductFormValues } from "../validations";

const mocks = vi.hoisted(() => ({
  saveProductAggregate: vi.fn(),
  getAdminProduct: vi.fn(),
  prepare: vi.fn(),
  preservePrepared: vi.fn(),
  commit: vi.fn(),
  rebase: vi.fn(),
  push: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mocks.push,
    replace: mocks.replace,
    refresh: mocks.refresh,
  }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/features/admin/products/api/client", () => ({
  ProductClientError: class ProductClientError extends Error {
    constructor(
      public readonly status: number,
      public readonly code: string,
      message: string,
      public readonly fields?: Record<string, string[]>,
    ) {
      super(message);
    }
  },
  saveProductAggregate: mocks.saveProductAggregate,
  getAdminProduct: mocks.getAdminProduct,
}));

vi.mock("./product-form/sidebar/FormHeaderBar", () => ({
  FormHeaderBar: () => <button type="submit">ذخیره محصول</button>,
}));
vi.mock("./product-form/sidebar/MobileActionBar", () => ({
  MobileActionBar: () => null,
}));
vi.mock("./product-form/sidebar/PreviewCard", () => ({
  PreviewCard: () => null,
}));
vi.mock("./product-form/GeneralInfoSection", () => ({
  GeneralInfoSection: ({
    register,
  }: {
    register: UseFormRegister<ProductFormValues>;
  }) => <input aria-label="نام محصول" {...register("title")} />,
}));
vi.mock("./product-form/SpecificationsSection", () => ({
  SpecificationsSection: () => null,
}));
vi.mock("./product-form/SeoSection", () => ({
  SeoSection: () => null,
}));
vi.mock("./product-form/TagsSection", () => ({
  TagsSection: () => null,
}));
vi.mock("./product-form/VariantsSection", () => ({
  VariantsSection: ({
    setValue,
  }: {
    setValue: UseFormSetValue<ProductFormValues>;
  }) => (
    <>
      <button
        type="button"
        onClick={() => setValue("tag_ids", [1, 5], { shouldDirty: true })}
      >
        افزودن برچسب
      </button>
      <button
        type="button"
        onClick={() =>
          setValue(
            "variants",
            [
              {
                _id: 11,
                sku: "W-1",
                price: "100",
                compare_at_price: "",
                is_active: true,
                option_value_ids: [202],
              },
              {
                sku: "NEW",
                price: "120",
                compare_at_price: "",
                is_active: true,
                option_value_ids: [],
              },
            ],
            { shouldDirty: true },
          )
        }
      >
        افزودن تنوع
      </button>
    </>
  ),
}));
vi.mock("./product-form/ImagesSection", async () => {
  const React = await import("react");
  return {
    ImagesSection: ({ uploaderRef }: { uploaderRef: Ref<unknown> }) => {
      React.useImperativeHandle(uploaderRef, () => ({
        hasStaged: true,
        isBusy: false,
        validate: () => null,
        flush: async () => undefined,
        // The real uploader caches prepared uploads, so re-preparing returns
        // the same storage key instead of uploading the file twice.
        prepare: mocks.prepare,
        preservePrepared: mocks.preservePrepared,
        discardPrepared: vi.fn(),
        rebase: mocks.rebase,
        commit: mocks.commit,
      }));
      return null;
    },
  };
});

import { ProductClientError } from "@/features/admin/products/api/client";
import { ProductForm } from "./ProductForm";
import { openProductSection } from "../test-helpers";

const loadedProduct: AdminProductDetail = {
  id: 42,
  title: "ویسکی",
  slug: "whisky",
  description: "توضیح اولیه",
  is_active: true,
  updated_at: "2026-07-26T12:00:00Z",
  images: [],
  tags: [{ id: 1, title: "قدیمی" }],
  variants: [
    {
      id: 11,
      sku: "W-1",
      price: 100,
      is_active: true,
      images: [],
      options: [
        {
          id: 201,
          option_type_id: 7,
          option_type_title: "color",
          option_type: "رنگ",
          value: "قرمز",
        },
      ],
    },
  ],
};

/** What the colleague saved first: a new revision with their own edits. */
const colleagueRevision: AdminProductDetail = {
  ...loadedProduct,
  updated_at: "2026-07-26T12:30:00Z",
  description: "توضیح همکار",
};

const revisionConflict = () =>
  new ProductClientError(409, "CONFLICT", "conflict", {
    expected_updated_at: ["product changed after this editor was loaded"],
  });

const stagedImages = [
  { storage_key: "uploads/staged-1", alt_text: null, is_primary: true },
];

function stageOperatorEdits() {
  fireEvent.change(screen.getByLabelText("نام محصول"), {
    target: { value: "ویسکی من" },
  });
  // The staged variant edits live in another `?tab=` section (PE-5); the form
  // stays mounted across the switch, which is what lets one save carry both.
  openProductSection("variants");
  fireEvent.click(screen.getByRole("button", { name: "افزودن برچسب" }));
  fireEvent.click(screen.getByRole("button", { name: "افزودن تنوع" }));
  openProductSection("general");
}

const save = () =>
  fireEvent.click(screen.getByRole("button", { name: "ذخیره محصول" }));

afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.saveProductAggregate.mockReset();
  mocks.prepare.mockResolvedValue(stagedImages);
  mocks.rebase.mockReturnValue({ dropped: 0, adopted: 0 });
  mocks.getAdminProduct.mockResolvedValue(colleagueRevision);
  sessionStorage.clear();
});

describe("ProductForm revision conflict recovery", () => {
  it("rebases a 409 onto the fresh revision and saves without re-entry", async () => {
    mocks.saveProductAggregate
      .mockRejectedValueOnce(revisionConflict())
      .mockResolvedValueOnce(colleagueRevision);
    render(<ProductForm mode="edit" product={loadedProduct} categories={[]} />);

    stageOperatorEdits();
    save();

    await waitFor(() =>
      expect(mocks.saveProductAggregate).toHaveBeenCalledTimes(1),
    );
    await screen.findByText(/همکار دیگری این محصول را زودتر ذخیره کرد/);
    expect(mocks.getAdminProduct).toHaveBeenCalledWith(42);
    expect(mocks.rebase).toHaveBeenCalledWith(colleagueRevision.images);
    // Staged uploads stay alive across the refresh.
    expect(mocks.preservePrepared).toHaveBeenLastCalledWith(true);
    expect(
      sessionStorage.getItem("rumera:product-aggregate:edit:42"),
    ).toBeNull();

    save();

    await waitFor(() =>
      expect(mocks.saveProductAggregate).toHaveBeenCalledTimes(2),
    );
    const replay = mocks.saveProductAggregate.mock.calls[1]?.[1];
    // Guard intact: the retry carries the colleague's revision, not a bypass.
    expect(replay.expected_updated_at).toBe("2026-07-26T12:30:00Z");
    // Every piece of staged work survived the refresh.
    expect(replay.title).toBe("ویسکی من");
    expect(replay.tag_ids).toEqual([1, 5]);
    expect(replay.variants).toEqual([
      expect.objectContaining({ id: 11, option_value_ids: [202] }),
      expect.objectContaining({ sku: "NEW" }),
    ]);
    expect(replay.images).toEqual(stagedImages);
    expect(replay.operation_id).not.toBe(
      mocks.saveProductAggregate.mock.calls[0]?.[1].operation_id,
    );
  });

  it("does not discard the colleague's concurrent change silently", async () => {
    mocks.getAdminProduct.mockResolvedValue({
      ...colleagueRevision,
      title: "ویسکی همکار",
    });
    mocks.saveProductAggregate
      .mockRejectedValueOnce(revisionConflict())
      .mockResolvedValueOnce(colleagueRevision);
    render(<ProductForm mode="edit" product={loadedProduct} categories={[]} />);

    stageOperatorEdits();
    save();

    // The field only the colleague touched is kept; the field both touched is
    // resolved in the operator's favour and named in the notice.
    const notice = await screen.findByText(/همکار دیگری این محصول را زودتر/);
    expect(notice).toHaveTextContent("«نام محصول»");

    save();
    await waitFor(() =>
      expect(mocks.saveProductAggregate).toHaveBeenCalledTimes(2),
    );
    const replay = mocks.saveProductAggregate.mock.calls[1]?.[1];
    expect(replay.title).toBe("ویسکی من");
    expect(replay.description).toBe("توضیح همکار");
  });

  it("replays the identical request after a partial failure", async () => {
    mocks.saveProductAggregate
      .mockRejectedValueOnce(revisionConflict())
      .mockRejectedValueOnce(new TypeError("network failed"))
      .mockResolvedValueOnce(colleagueRevision);
    render(<ProductForm mode="edit" product={loadedProduct} categories={[]} />);

    stageOperatorEdits();
    save();
    await screen.findByText(/همکار دیگری این محصول را زودتر ذخیره کرد/);

    save();
    await waitFor(() =>
      expect(mocks.saveProductAggregate).toHaveBeenCalledTimes(2),
    );
    // The ambiguous attempt is frozen as a replayable envelope.
    await waitFor(() =>
      expect(
        sessionStorage.getItem("rumera:product-aggregate:edit:42"),
      ).not.toBeNull(),
    );

    save();
    await waitFor(() =>
      expect(mocks.saveProductAggregate).toHaveBeenCalledTimes(3),
    );
    // Same operation ID and same storage keys: the server deduplicates the
    // replay instead of creating a second variant or image.
    expect(mocks.saveProductAggregate.mock.calls[2]?.[1]).toEqual(
      mocks.saveProductAggregate.mock.calls[1]?.[1],
    );
  });
});
