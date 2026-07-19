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

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  update: vi.fn(),
  push: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/features/admin/tags/api", () => ({
  TagApiError: class TagApiError extends Error {},
  useCreateTag: () => ({ mutateAsync: mocks.create, isPending: false }),
  useUpdateTag: () => ({ mutateAsync: mocks.update, isPending: false }),
}));

import { TagForm } from "./tag-form";

afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.create.mockResolvedValue({ id: 1 });
  mocks.update.mockResolvedValue({ id: 7 });
});

describe("TagForm", () => {
  it("suggests a Unicode slug and submits a normalized create payload", async () => {
    render(<TagForm mode="create" />);

    fireEvent.change(screen.getByLabelText("نام برچسب"), {
      target: { value: " نوشیدنی ویژه " },
    });
    await waitFor(() =>
      expect(screen.getByLabelText("نامک")).toHaveValue("نوشیدنی-ویژه"),
    );
    fireEvent.change(screen.getByLabelText("توضیحات"), {
      target: { value: "  انتخاب سردبیر  " },
    });
    fireEvent.click(screen.getByRole("button", { name: "ساخت برچسب" }));

    await waitFor(() => expect(mocks.create).toHaveBeenCalledTimes(1));
    expect(mocks.create).toHaveBeenCalledWith({
      title: "نوشیدنی ویژه",
      slug: "نوشیدنی-ویژه",
      description: "انتخاب سردبیر",
    });
    expect(mocks.push).toHaveBeenCalledWith("/admin/tags");
  });

  it("blocks malformed slugs and focuses the invalid field", async () => {
    render(<TagForm mode="create" />);

    fireEvent.change(screen.getByLabelText("نام برچسب"), {
      target: { value: "هدیه" },
    });
    fireEvent.change(screen.getByLabelText("نامک"), {
      target: { value: "gift--set" },
    });
    fireEvent.click(screen.getByRole("button", { name: "ساخت برچسب" }));

    expect(
      await screen.findByText("نامک فقط می‌تواند شامل حرف، عدد و خط تیره باشد"),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("نامک")).toHaveFocus();
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("regenerates a cleared slug and clears an existing description", async () => {
    render(
      <TagForm
        mode="edit"
        tag={{
          id: 7,
          title: "هدیه",
          slug: "gift",
          description: "قدیمی",
          created_at: "2026-07-19T00:00:00Z",
          updated_at: "2026-07-19T00:00:00Z",
        }}
      />,
    );

    fireEvent.change(screen.getByLabelText("توضیحات"), {
      target: { value: "" },
    });
    fireEvent.change(screen.getByLabelText("نامک"), {
      target: { value: "" },
    });
    fireEvent.click(screen.getByRole("button", { name: "ذخیرهٔ تغییرات" }));

    await waitFor(() => expect(mocks.update).toHaveBeenCalledTimes(1));
    expect(mocks.update).toHaveBeenCalledWith({
      title: "هدیه",
      slug: "هدیه",
      description: null,
    });
  });
});
