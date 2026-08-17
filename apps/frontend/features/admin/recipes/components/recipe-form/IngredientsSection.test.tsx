// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useForm } from "react-hook-form";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { RecipeFormValues } from "@/features/recipes/validations";

const mocks = vi.hoisted(() => ({
  onPick: vi.fn(),
}));

vi.mock("@/features/admin/products/components/variant-picker", () => ({
  VariantPicker: ({
    value,
    onChange,
    initialLabel,
  }: {
    value: number | null;
    onChange: (option: {
      variantId: number;
      productTitle: string;
      brand: string | null;
      sku: string | null;
      price: number;
    } | null) => void;
    initialLabel?: { productTitle: string } | null;
  }) => (
    <div>
      <span data-testid="variant-value">{value ?? ""}</span>
      <span data-testid="variant-label">{initialLabel?.productTitle ?? ""}</span>
      <button
        type="button"
        onClick={() => {
          const option = {
            variantId: 8,
            productTitle: "تکیلای بلانکو",
            brand: null,
            sku: "SKU-8",
            price: 1,
          };
          mocks.onPick(option);
          onChange(option);
        }}
      >
        انتخاب فرآورده
      </button>
      <button type="button" onClick={() => onChange(null)}>
        پاک کردن پیوند
      </button>
    </div>
  ),
}));

import { IngredientsSection } from "./IngredientsSection";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function Harness({
  values,
}: {
  values?: Partial<RecipeFormValues["ingredients"][number]>;
}) {
  const { control, register, setValue } = useForm<RecipeFormValues>({
    defaultValues: {
      title: "موخیتو",
      slug: "",
      excerpt: "",
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
      ingredients: [
        {
          ingredient_name: "تکیلا",
          quantity: "50",
          unit: "میلی‌لیتر",
          notes: "",
          optional: false,
          product_variant_id: values?.product_variant_id ?? null,
          _label: values?._label,
          _brand: values?._brand ?? null,
          _sku: values?._sku ?? null,
        },
      ],
      products: [],
    },
  });

  return (
    <>
      <IngredientsSection
        control={control}
        register={register}
        errors={{}}
        setValue={setValue}
      />
    </>
  );
}

describe("IngredientsSection catalogue link", () => {
  it("lets the operator attach a catalogue variant to an ingredient row", () => {
    render(<Harness />);

    expect(screen.getByText("پیوند به کاتالوگ (اختیاری)")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "انتخاب فرآورده" }));

    expect(mocks.onPick).toHaveBeenCalledWith(
      expect.objectContaining({ variantId: 8 }),
    );
    expect(screen.getByTestId("variant-value")).toHaveTextContent("8");
  });

  it("shows the existing product title when editing a linked ingredient", () => {
    render(
      <Harness
        values={{
          product_variant_id: 8,
          _label: "تکیلای بلانکو",
          _sku: "SKU-8",
        }}
      />,
    );

    expect(screen.getByTestId("variant-value")).toHaveTextContent("8");
    expect(screen.getByTestId("variant-label")).toHaveTextContent("تکیلای بلانکو");
  });
});
