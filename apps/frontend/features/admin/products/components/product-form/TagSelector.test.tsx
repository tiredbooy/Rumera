// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import * as React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useForm, useWatch } from "react-hook-form";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ProductFormValues } from "../../validations";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  refetch: vi.fn(),
}));

vi.mock("@/features/admin/tags/api", () => ({
  useAllTags: () => mocks.query(),
}));

import { TagSelector } from "./TagSelector";

function Harness({
  initialTags = [{ id: 2, title: "قدیمی" }],
  availableTags,
}: {
  initialTags?: Array<{ id: number; title: string }>;
  availableTags?: Array<{
    id: number;
    title: string;
    slug: string;
    created_at: string;
    updated_at: string;
  }>;
}) {
  const { control } = useForm<ProductFormValues>({
    defaultValues: { tag_ids: [2] },
  });
  const selected = useWatch({ control, name: "tag_ids" });
  return (
    <>
      <TagSelector
        control={control}
        initialTags={initialTags}
        availableTags={availableTags}
      />
      <output data-testid="selected">{JSON.stringify(selected)}</output>
    </>
  );
}

afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("TagSelector", () => {
  it("preserves hydrated assignments and adds canonical numeric IDs", () => {
    mocks.query.mockReturnValue({
      data: [
        {
          id: 3,
          title: "تازه",
          slug: "new",
          created_at: "2026-07-19T00:00:00Z",
          updated_at: "2026-07-19T00:00:00Z",
        },
      ],
      isPending: false,
      isError: false,
      isSuccess: true,
      isFetching: false,
      refetch: mocks.refetch,
    });

    render(<Harness />);

    expect(screen.getByRole("button", { name: "قدیمی" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    const newTag = screen.getByRole("button", { name: "تازه" });
    expect(newTag).toHaveClass("max-w-full", "break-words");
    fireEvent.click(newTag);
    expect(screen.getByTestId("selected")).toHaveTextContent("[2,3]");
  });

  it("keeps hydrated tags visible during a retryable load failure", () => {
    mocks.query.mockReturnValue({
      data: undefined,
      isPending: false,
      isError: true,
      isSuccess: false,
      isFetching: false,
      refetch: mocks.refetch,
    });

    render(<Harness />);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "بارگذاری فهرست برچسب‌ها ناموفق بود",
    );
    expect(screen.getByRole("button", { name: "قدیمی" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "تلاش مجدد" }));
    expect(mocks.refetch).toHaveBeenCalled();
  });

  it("announces the pending and empty states", () => {
    mocks.query.mockReturnValue({
      data: undefined,
      isPending: true,
      isError: false,
      isSuccess: false,
      isFetching: true,
      refetch: mocks.refetch,
    });
    const { rerender } = render(<Harness />);
    expect(screen.getByText("در حال بارگذاری برچسب‌ها…")).toHaveTextContent(
      "در حال بارگذاری برچسب‌ها",
    );

    mocks.query.mockReturnValue({
      data: [],
      isPending: false,
      isError: false,
      isSuccess: true,
      isFetching: false,
      refetch: mocks.refetch,
    });
    rerender(<Harness initialTags={[]} />);
    expect(
      screen.getByText("هنوز برچسبی برای انتخاب ثبت نشده است."),
    ).toBeInTheDocument();
  });

  it("uses server-provided tags as the list source while the client query is pending", () => {
    mocks.query.mockReturnValue({
      data: undefined,
      isPending: true,
      isError: false,
      isSuccess: false,
      isFetching: true,
      refetch: mocks.refetch,
    });

    render(
      <Harness
        initialTags={[]}
        availableTags={[
          {
            id: 4,
            title: "سرور",
            slug: "server",
            created_at: "2026-08-16T00:00:00Z",
            updated_at: "2026-08-16T00:00:00Z",
          },
        ]}
      />,
    );

    expect(
      screen.queryByText("در حال بارگذاری برچسب‌ها…"),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "سرور" }));
    expect(screen.getByTestId("selected")).toHaveTextContent("[2,4]");
  });
});
