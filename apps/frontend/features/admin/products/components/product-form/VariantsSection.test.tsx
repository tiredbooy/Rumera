// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useFieldArray, useForm } from "react-hook-form";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ProductOptionGroup } from "@/features/admin/products/types";
import type { ProductFormValues } from "../../validations";
import { VariantsSection } from "./VariantsSection";

const mocks = vi.hoisted(() => ({
  refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));

const volume: ProductOptionGroup = {
  id: 3,
  title: "volume",
  display_name: "حجم",
  created_at: "2026-07-27T00:00:00Z",
  updated_at: "2026-07-27T00:00:00Z",
  values: [
    {
      id: 11,
      option_type_id: 3,
      value: "700ml",
      sort_order: 0,
      created_at: "2026-07-27T00:00:00Z",
      updated_at: "2026-07-27T00:00:00Z",
    },
  ],
};

function Harness({
  optionTypes,
  optionCatalogError = null,
}: {
  optionTypes: ProductOptionGroup[];
  optionCatalogError?: string | null;
}) {
  const { register, control, setValue, formState } = useForm<ProductFormValues>({
    defaultValues: { variants: [] },
  });
  const { fields, append, remove } = useFieldArray({
    control,
    name: "variants",
  });

  return (
    <VariantsSection
      register={register}
      control={control}
      setValue={setValue}
      errors={formState.errors}
      fields={fields}
      append={append}
      remove={remove}
      optionTypes={optionTypes}
      optionCatalogError={optionCatalogError}
    />
  );
}

afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("VariantsSection option catalog", () => {
  it("uses the empty-options copy when the catalog loaded and is empty", () => {
    render(<Harness optionTypes={[]} />);

    expect(screen.getByText("هنوز ویژگی مشترکی تعریف نشده")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "تلاش دوباره" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("بارگذاری ویژگی‌های تنوع ناموفق بود. دوباره تلاش کنید."),
    ).not.toBeInTheDocument();
  });

  it("keeps the empty-options UI and adds a distinct error with retry on catalog failure", () => {
    render(
      <Harness
        optionTypes={[]}
        optionCatalogError="بارگذاری ویژگی‌های تنوع ناموفق بود. دوباره تلاش کنید."
      />,
    );

    expect(screen.getByText("هنوز ویژگی مشترکی تعریف نشده")).toBeInTheDocument();
    expect(
      screen.getByText("بارگذاری ویژگی‌های تنوع ناموفق بود. دوباره تلاش کنید."),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "تلاش دوباره" }));
    expect(mocks.refresh).toHaveBeenCalledOnce();
  });

  it("does not show the empty-options copy when types loaded", () => {
    render(<Harness optionTypes={[volume]} />);

    expect(
      screen.queryByText("هنوز ویژگی مشترکی تعریف نشده"),
    ).not.toBeInTheDocument();
    expect(screen.getByText(/ویژگی‌های مشترک از/)).toBeInTheDocument();
  });
});
