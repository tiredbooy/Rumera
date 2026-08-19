// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useForm } from "react-hook-form";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { RecipeFormValues } from "@/features/recipes/validations";

vi.mock("@/components/admin/rich-text-editor", () => ({
  RichTextEditor: ({
    value,
    onChange,
    ariaLabel,
  }: {
    value: string;
    onChange: (value: string) => void;
    ariaLabel?: string;
  }) => (
    <textarea
      aria-label={ariaLabel ?? "محتوای دستور"}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  ),
}));

vi.mock("@/components/admin/content-preview", () => ({
  ContentPreview: () => null,
}));

import { ContentSection } from "./ContentSection";

function Harness({
  content,
  onContent,
}: {
  content: string;
  onContent?: (value: string) => void;
}) {
  const form = useForm<RecipeFormValues>({
    defaultValues: { content } as RecipeFormValues,
  });
  const value = form.watch("content");
  onContent?.(value);
  return (
    <>
      <ContentSection control={form.control} errors={{}} />
      <button
        type="button"
        onClick={() =>
          form.reset({
            content: "<ol><li>بازیابی‌شده</li></ol>",
          } as RecipeFormValues)
        }
      >
        بازیابی پیش‌نویس
      </button>
      <output data-testid="content">{value}</output>
    </>
  );
}

afterEach(cleanup);

describe("recipe method step editor", () => {
  it("opens a legacy free-text body as steps and serialises them as one ordered list", () => {
    render(<Harness content="<p>یخ بریزید</p><p>هم بزنید</p>" />);

    expect(screen.getByLabelText("گام ۱")).toHaveValue("<p>یخ بریزید</p>");
    expect(screen.getByLabelText("گام ۲")).toHaveValue("<p>هم بزنید</p>");
    expect(screen.getByText(/به ۲ گام تقسیم شد/)).toBeInTheDocument();
    // Opening a recipe must not dirty the form: the blob is rewritten as an
    // ordered list on the first real edit, not on mount.
    expect(screen.getByTestId("content")).toHaveTextContent(
      "<p>یخ بریزید</p><p>هم بزنید</p>",
    );

    fireEvent.change(screen.getByLabelText("گام ۲"), {
      target: { value: "<p>خوب هم بزنید</p>" },
    });
    expect(screen.getByTestId("content")).toHaveTextContent(
      "<ol><li><p>یخ بریزید</p></li><li><p>خوب هم بزنید</p></li></ol>",
    );
  });

  it("adds, reorders and removes steps", () => {
    render(<Harness content="<ol><li>یک</li><li>دو</li></ol>" />);

    fireEvent.click(
      screen.getByRole("button", { name: "انتقال گام ۲ به بالا" }),
    );
    expect(screen.getByTestId("content")).toHaveTextContent(
      "<ol><li>دو</li><li>یک</li></ol>",
    );

    fireEvent.click(screen.getByRole("button", { name: /افزودن گام/ }));
    fireEvent.change(screen.getByLabelText("گام ۳"), {
      target: { value: "<p>سه</p>" },
    });
    expect(screen.getByTestId("content")).toHaveTextContent(
      "<ol><li>دو</li><li>یک</li><li><p>سه</p></li></ol>",
    );

    fireEvent.click(screen.getByRole("button", { name: "حذف گام ۱" }));
    expect(screen.getByTestId("content")).toHaveTextContent(
      "<ol><li>یک</li><li><p>سه</p></li></ol>",
    );
  });

  it("re-splits when the form value changes from outside, e.g. draft recovery", () => {
    render(<Harness content="<ol><li>یک</li></ol>" />);

    fireEvent.click(screen.getByRole("button", { name: "بازیابی پیش‌نویس" }));

    expect(screen.getByLabelText("گام ۱")).toHaveValue("بازیابی‌شده");
    expect(screen.queryByLabelText("گام ۲")).not.toBeInTheDocument();
  });

  it("keeps the whole body in one editor in free-text mode", () => {
    render(<Harness content="<ol><li>یک</li><li>دو</li></ol>" />);

    fireEvent.click(
      screen.getByRole("button", { name: "ویرایش به‌صورت متن آزاد" }),
    );
    expect(screen.getByLabelText("محتوای دستور")).toHaveValue(
      "<ol><li>یک</li><li>دو</li></ol>",
    );

    fireEvent.click(screen.getByRole("button", { name: "بازگشت به گام‌ها" }));
    expect(screen.getByLabelText("گام ۲")).toHaveValue("دو");
  });

  it("keeps Markdown intro and table on first edit and only then claims nothing was deleted", () => {
    render(
      <Harness
        content={"مقدمه.\n\n1. یخ\n2. هم بزنید\n\n| a | b |\n| --- | --- |\n| 1 | 2 |"}
      />,
    );

    expect(screen.getByText(/به ۲ گام تقسیم شد/)).toBeInTheDocument();
    expect(screen.getByText(/چیزی حذف نشده است/)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("گام ۱"), {
      target: { value: "<p>یخ خرد کنید</p>" },
    });
    const saved = screen.getByTestId("content").textContent ?? "";
    expect(saved).toContain("مقدمه");
    expect(saved).toContain("یخ خرد کنید");
    expect(saved).toContain("a");
    expect(saved).toContain("<ol>");
  });
});
