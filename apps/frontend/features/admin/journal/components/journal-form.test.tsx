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
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import type {
  ImageUploaderHandle,
  UploadedImage,
} from "@/features/image-uploader/types";
import type { JournalDetail } from "@/features/journal/types";

type MediaHandle = ImageUploaderHandle<UploadedImage | null>;

const { createMock, updateMock, flushMock, pushMock, refreshMock, mediaState } =
  vi.hoisted(() => ({
    createMock: vi.fn(),
    updateMock: vi.fn(),
    flushMock: vi.fn(),
    pushMock: vi.fn(),
    refreshMock: vi.fn(),
    mediaState: { staged: true, validationError: null as string | null },
  }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, refresh: refreshMock }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

vi.mock("@/features/journal/api/client", () => ({
  JournalApiError: class JournalApiError extends Error {},
  createJournalPost: createMock,
  updateJournalPost: updateMock,
  journalAdminKeys: {
    root: ["admin", "journal"],
    lists: () => ["admin", "journal", "list"],
    detail: (id: number) => ["admin", "journal", "detail", id],
  },
}));

vi.mock("@/components/smart-image", () => ({
  SmartImage: ({ alt }: { alt: string }) => (
    <span role="img" aria-label={alt} />
  ),
}));

vi.mock("@/components/admin/rich-text-editor", () => ({
  RichTextEditor: ({
    value,
    onChange,
    ariaLabel,
    inputRef,
    disabled,
  }: {
    value: string;
    onChange: (value: string) => void;
    ariaLabel: string;
    inputRef?: (element: HTMLElement | null) => void;
    disabled?: boolean;
  }) => (
    <textarea
      ref={(element) => inputRef?.(element)}
      aria-label={ariaLabel}
      disabled={disabled}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  ),
}));

vi.mock("@/features/image-uploader/ImageInput", () => ({
  ImageInput: React.forwardRef(function MockImageInput(
    props: {
      altValue?: string;
      altError?: string;
      altInputRef?: React.Ref<HTMLInputElement>;
      onAltChange?: (value: string) => void;
    },
    ref: React.ForwardedRef<MediaHandle>,
  ) {
    React.useImperativeHandle(ref, () => ({
      hasStaged: mediaState.staged,
      isBusy: false,
      validate: () => mediaState.validationError,
      flush: flushMock,
    }));
    return (
      <>
        <input
          ref={props.altInputRef}
          aria-label="متن جایگزین تصویر"
          value={props.altValue ?? ""}
          onChange={(event) => props.onAltChange?.(event.target.value)}
        />
        {props.altError ? <span>{props.altError}</span> : null}
      </>
    );
  }),
}));

vi.mock("@/features/admin/shared/product-picker", () => ({
  ProductPicker: () => null,
}));

import { JournalForm } from "./journal-form";

const journalListKey = ["admin", "journal", "list", { page: 1 }];

function renderForm(props: React.ComponentProps<typeof JournalForm>) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  queryClient.setQueryData(journalListKey, { results: [] });
  render(
    <QueryClientProvider client={queryClient}>
      <JournalForm {...props} />
    </QueryClientProvider>,
  );
  return queryClient;
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  Element.prototype.scrollIntoView = vi.fn();
  vi.clearAllMocks();
  mediaState.staged = true;
  mediaState.validationError = null;
  createMock.mockResolvedValue({ id: 52 });
  updateMock.mockResolvedValue({ id: 52 });
  flushMock.mockResolvedValue({
    url: "/media/journal/52/cover-image.webp",
    key: "journal/52/cover-image.webp",
    width: 1200,
    height: 900,
  });
});

function fillRequiredFields() {
  fireEvent.change(screen.getByLabelText("عنوان"), {
    target: { value: "راهنمای رومرا" },
  });
  fireEvent.change(screen.getByLabelText("محتوای نوشتهٔ ژورنال"), {
    target: { value: "<p>متن کامل نوشته</p>" },
  });
  fireEvent.change(screen.getByLabelText("متن جایگزین تصویر"), {
    target: { value: "بطری روی میز چوبی" },
  });
}

describe("JournalForm owner-aware media", () => {
  it("creates the article owner before attaching a staged cover", async () => {
    const queryClient = renderForm({
      mode: "create",
      categories: [],
      tags: [],
      initialProducts: [],
    });
    fillRequiredFields();
    fireEvent.click(screen.getByRole("button", { name: "ساخت نوشته" }));

    await waitFor(() => expect(createMock).toHaveBeenCalledTimes(1));
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "راهنمای رومرا",
        image_url: null,
        image_alt: undefined,
      }),
    );
    expect(flushMock).toHaveBeenCalledWith(52);
    expect(pushMock).toHaveBeenCalledWith("/admin/journal");
    expect(queryClient.getQueryState(journalListKey)?.isInvalidated).toBe(true);
  });

  it("requires alternative text before uploading a staged cover", async () => {
    renderForm({
      mode: "create",
      categories: [],
      tags: [],
      initialProducts: [],
    });
    fireEvent.change(screen.getByLabelText("عنوان"), {
      target: { value: "راهنمای رومرا" },
    });
    fireEvent.change(screen.getByLabelText("محتوای نوشتهٔ ژورنال"), {
      target: { value: "<p>متن کامل نوشته</p>" },
    });
    fireEvent.click(screen.getByRole("button", { name: "ساخت نوشته" }));

    expect(
      await screen.findByText("برای تصویر شاخص متن جایگزین بنویسید"),
    ).toBeInTheDocument();
    expect(document.activeElement).toBe(
      screen.getByLabelText("متن جایگزین تصویر"),
    );
    expect(createMock).not.toHaveBeenCalled();
  });

  it("focuses the rich-text surface when content validation fails", async () => {
    renderForm({
      mode: "create",
      categories: [],
      tags: [],
      initialProducts: [],
    });
    fireEvent.change(screen.getByLabelText("عنوان"), {
      target: { value: "راهنمای رومرا" },
    });
    fireEvent.click(screen.getByRole("button", { name: "ساخت نوشته" }));

    expect(
      await screen.findByText("محتوای نوشته الزامی است"),
    ).toBeInTheDocument();
    expect(document.activeElement).toBe(
      screen.getByLabelText("محتوای نوشتهٔ ژورنال"),
    );
  });

  it("keeps a created article recoverable when cover attachment fails", async () => {
    flushMock.mockRejectedValue(new Error("بارگذاری تصویر ناموفق بود"));
    renderForm({
      mode: "create",
      categories: [],
      tags: [],
      initialProducts: [],
    });
    fillRequiredFields();
    fireEvent.click(screen.getByRole("button", { name: "ساخت نوشته" }));

    await waitFor(() =>
      expect(pushMock).toHaveBeenCalledWith("/admin/journal/52"),
    );
  });

  it("locks the rich-text editor while the article save is pending", async () => {
    mediaState.staged = false;
    let resolveCreate: ((value: { id: number }) => void) | undefined;
    createMock.mockReturnValue(
      new Promise((resolve) => {
        resolveCreate = resolve;
      }),
    );
    renderForm({
      mode: "create",
      categories: [],
      tags: [],
      initialProducts: [],
    });
    fillRequiredFields();
    fireEvent.click(screen.getByRole("button", { name: "ساخت نوشته" }));

    await waitFor(() => expect(createMock).toHaveBeenCalledTimes(1));
    expect(screen.getByLabelText("محتوای نوشتهٔ ژورنال")).toBeDisabled();
    resolveCreate?.({ id: 52 });
    await waitFor(() =>
      expect(pushMock).toHaveBeenCalledWith("/admin/journal"),
    );
  });

  it("does not patch an existing article when staged cover upload fails", async () => {
    const post: JournalDetail = {
      id: 18,
      author_id: 4,
      title: "نوشتهٔ موجود",
      slug: "نوشته-موجود",
      excerpt: null,
      content: "<p>متن موجود</p>",
      image_url: "/media/journal/18/old.webp",
      image_alt: "تصویر قبلی",
      time_to_read: 4,
      total_reads: 3,
      status: "published",
      is_featured: false,
      meta_title: null,
      meta_description: null,
      published_at: "2026-08-01T10:00:00Z",
      created_at: "2026-08-01T09:00:00Z",
      updated_at: "2026-08-01T10:00:00Z",
      categories: [],
      product_ids: [],
      tag_ids: [],
    };
    flushMock.mockRejectedValue(new Error("بارگذاری تصویر ناموفق بود"));
    renderForm({
      mode: "edit",
      post,
      categories: [],
      tags: [],
      initialProducts: [],
    });
    fireEvent.click(screen.getByRole("button", { name: "ذخیرهٔ تغییرات" }));

    expect(
      await screen.findByText("بارگذاری تصویر ناموفق بود"),
    ).toBeInTheDocument();
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("shows a Jalali schedule field and confirms unpublish of a live post", async () => {
    mediaState.staged = false;
    const post: JournalDetail = {
      id: 18,
      author_id: 4,
      title: "نوشتهٔ موجود",
      slug: "نوشته-موجود",
      excerpt: null,
      content: "<p>متن موجود</p>",
      image_url: "/media/journal/18/old.webp",
      image_alt: "تصویر قبلی",
      time_to_read: 4,
      total_reads: 3,
      status: "published",
      is_featured: false,
      meta_title: null,
      meta_description: null,
      published_at: "2026-08-01T10:00:00Z",
      created_at: "2026-08-01T09:00:00Z",
      updated_at: "2026-08-01T10:00:00Z",
      categories: [],
      product_ids: [],
      tag_ids: [],
    };
    renderForm({
      mode: "edit",
      post,
      categories: [],
      tags: [],
      initialProducts: [],
    });

    expect(screen.getByLabelText("زمان انتشار (شمسی)")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("منتشرشده");

    fireEvent.click(screen.getByLabelText("وضعیت انتشار"));
    fireEvent.click(await screen.findByRole("option", { name: "پیش‌نویس" }));
    fireEvent.click(screen.getByRole("button", { name: "ذخیرهٔ تغییرات" }));

    expect(await screen.findByRole("alertdialog")).toHaveTextContent(
      "برداشتن از انتشار",
    );
    expect(updateMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "تأیید برداشتن از انتشار" }));
    await waitFor(() => expect(updateMock).toHaveBeenCalledTimes(1));
    expect(updateMock.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({ status: "draft" }),
    );
  });

  it("does not submit when canWrite is false", () => {
    const post: JournalDetail = {
      id: 18,
      author_id: 4,
      title: "نوشتهٔ موجود",
      slug: "نوشته-موجود",
      excerpt: null,
      content: "<p>متن موجود</p>",
      image_url: "/media/journal/18/old.webp",
      image_alt: "تصویر قبلی",
      time_to_read: 4,
      total_reads: 3,
      status: "published",
      is_featured: false,
      meta_title: null,
      meta_description: null,
      published_at: "2026-08-01T10:00:00Z",
      created_at: "2026-08-01T09:00:00Z",
      updated_at: "2026-08-01T10:00:00Z",
      categories: [],
      product_ids: [],
      tag_ids: [],
    };
    renderForm({
      mode: "edit",
      post,
      categories: [],
      tags: [],
      initialProducts: [],
      canWrite: false,
    });

    expect(
      screen.getByText(/فقط مشاهده — ذخیره و بارگذاری تصویر/),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "ذخیرهٔ تغییرات" }),
    ).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("عنوان"), {
      target: { value: "عنوان اصلاح‌شده" },
    });
    fireEvent.submit(document.querySelector("form")!);

    expect(updateMock).not.toHaveBeenCalled();
    expect(createMock).not.toHaveBeenCalled();
    expect(pushMock).not.toHaveBeenCalled();
  });
});
