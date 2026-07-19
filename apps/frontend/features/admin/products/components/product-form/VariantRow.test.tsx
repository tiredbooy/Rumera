// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { UseFormRegister } from "react-hook-form";

import type { ProductFormValues } from "../../validations";
import { VariantRow } from "./VariantRow";

afterEach(cleanup);

describe("VariantRow responsive layout", () => {
  it("stacks fields on narrow screens and expands only at wider breakpoints", () => {
    const register = vi.fn((name: string) => ({ name })) as unknown as UseFormRegister<ProductFormValues>;

    render(
      <VariantRow
        index={0}
        fieldId="variant-1"
        register={register}
        errors={{}}
        onRemove={vi.fn()}
      />,
    );

    const removeButton = screen.getByRole("button", { name: "حذف تنوع" });
    const row = removeButton.parentElement;

    expect(row).toHaveClass("grid-cols-1", "sm:grid-cols-2");
    expect(row?.className).toContain(
      "xl:grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto]",
    );
    expect(screen.getByLabelText("SKU").parentElement).toHaveClass(
      "min-w-0",
      "sm:col-span-2",
      "xl:col-span-1",
    );
    expect(removeButton).toHaveClass(
      "justify-self-end",
      "sm:col-span-2",
      "xl:col-span-1",
    );
  });
});
