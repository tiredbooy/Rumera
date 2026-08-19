// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ listBrands: vi.fn() }));

vi.mock("@/features/admin/brands/client", () => ({
  listBrands: mocks.listBrands,
}));

import { BrandSelect, unknownBrandLabel } from "./BrandSelect";

function page(results: Array<{ id: number; title: string }>) {
  return {
    results,
    pagination: { page: 1, limit: 20, total: results.length, has_next: false },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.listBrands.mockResolvedValue(page([{ id: 101, title: "برند صدویکم" }]));
  Object.defineProperty(globalThis, "ResizeObserver", {
    configurable: true,
    value: class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  });
});

afterEach(cleanup);

describe("BrandSelect", () => {
  // The dangerous half of PE-4: the control used to read «انتخاب برند» over a
  // product that really had brand #101, so an operator would "fix" it.
  it("shows the seeded brand instead of the empty placeholder", () => {
    render(
      <BrandSelect
        value="101"
        selectedBrand={{ id: 101, title: "برند صدویکم" }}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByRole("combobox")).toHaveTextContent("برند صدویکم");
    expect(screen.queryByText("انتخاب برند")).not.toBeInTheDocument();
  });

  it("names an unseeded selection by id rather than claiming none", () => {
    render(<BrandSelect value="101" onChange={vi.fn()} />);

    expect(screen.getByRole("combobox")).toHaveTextContent(
      unknownBrandLabel(101),
    );
  });

  it("says «انتخاب برند» only when nothing is selected", () => {
    render(<BrandSelect value="" onChange={vi.fn()} />);

    expect(screen.getByRole("combobox")).toHaveTextContent("انتخاب برند");
  });

  it("sends the query to the server and reports the picked brand", async () => {
    const onChange = vi.fn();
    render(<BrandSelect value="" onChange={onChange} />);

    fireEvent.click(screen.getByRole("combobox"));
    fireEvent.change(await screen.findByLabelText("جستجوی برند"), {
      target: { value: "صدویکم" },
    });

    await waitFor(() =>
      expect(mocks.listBrands).toHaveBeenCalledWith(
        expect.objectContaining({ search: "صدویکم", limit: 20 }),
      ),
    );

    fireEvent.click(await screen.findByRole("option", { name: /برند صدویکم/ }));
    expect(onChange).toHaveBeenCalledWith("101", {
      id: 101,
      title: "برند صدویکم",
    });
  });

  it("clears the selection through «بدون برند»", async () => {
    const onChange = vi.fn();
    render(
      <BrandSelect
        value="101"
        selectedBrand={{ id: 101, title: "برند صدویکم" }}
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByRole("combobox"));
    fireEvent.click(await screen.findByRole("option", { name: "بدون برند" }));

    expect(onChange).toHaveBeenCalledWith("", null);
  });
});
