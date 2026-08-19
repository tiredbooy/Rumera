// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type { Ref } from "react";
import Link from "next/link";
import type { FieldErrors, UseFormRegister } from "react-hook-form";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AdminProductDetail } from "@/features/admin/products/types";
import type { ProductFormValues } from "../validations";

const mocks = vi.hoisted(() => ({
  saveProductAggregate: vi.fn(),
  validate: vi.fn(),
  prepare: vi.fn(),
  preservePrepared: vi.fn(),
  discardPrepared: vi.fn(),
  commit: vi.fn(),
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
}));

vi.mock("./product-form/sidebar/FormHeaderBar", () => ({
  FormHeaderBar: ({
    savePhase,
    onCancel,
    isSubmitting,
  }: {
    savePhase: string;
    onCancel: () => void;
    isSubmitting?: boolean;
  }) => (
    <>
      <output data-testid="save-phase">{savePhase}</output>
      <button type="button" onClick={onCancel}>
        انصراف
      </button>
      <button type="submit" disabled={isSubmitting}>
        ذخیره محصول
      </button>
    </>
  ),
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
    errors,
  }: {
    register: UseFormRegister<ProductFormValues>;
    errors: FieldErrors<ProductFormValues>;
  }) => (
    <div>
      <label htmlFor="title">نام محصول</label>
      <input
        id="title"
        aria-invalid={Boolean(errors.title)}
        {...register("title")}
      />
      <Link href="/admin/orders">سفارش‌ها</Link>
    </div>
  ),
}));
vi.mock("./product-form/SpecificationsSection", () => ({
  SpecificationsSection: () => null,
}));
vi.mock("./product-form/VariantsSection", () => ({
  VariantsSection: ({ error }: { error?: string | null }) => (
    <div>
      <button id="product-variants-trigger" type="button">
        قیمت‌گذاری و تنوع‌ها
      </button>
      {error ? <p>{error}</p> : null}
    </div>
  ),
}));
vi.mock("./product-form/TagsSection", () => ({
  TagsSection: () => null,
}));
vi.mock("./product-form/ImagesSection", async () => {
  const React = await import("react");
  return {
    ImagesSection: ({
      uploaderRef,
      onDirtyChange,
      error,
    }: {
      uploaderRef: Ref<unknown>;
      onDirtyChange?: (dirty: boolean) => void;
      error?: string | null;
    }) => {
      React.useImperativeHandle(uploaderRef, () => ({
        hasStaged: false,
        isBusy: false,
        validate: mocks.validate,
        flush: async () => undefined,
        prepare: mocks.prepare,
        preservePrepared: mocks.preservePrepared,
        discardPrepared: mocks.discardPrepared,
        commit: mocks.commit,
      }));
      return (
        <div>
          <button id="product-images-trigger" type="button">
            تصاویر محصول
          </button>
          <button type="button" onClick={() => onDirtyChange?.(true)}>
            تغییر تصویر
          </button>
          {error ? <p>{error}</p> : null}
        </div>
      );
    },
  };
});

import { ProductClientError } from "@/features/admin/products/api/client";
import { ProductForm } from "./ProductForm";
import { openProductSection } from "../test-helpers";

const product: AdminProductDetail = {
  id: 42,
  title: "محصول موجود",
  slug: "existing-product",
  is_active: true,
  updated_at: "2026-07-27T08:00:00Z",
  tags: [],
  variants: [],
  images: [],
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  window.history.replaceState(null, "", "/admin/products/42");
  mocks.validate.mockReturnValue(null);
  mocks.prepare.mockResolvedValue([]);
  mocks.saveProductAggregate.mockResolvedValue(product);
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
    configurable: true,
    value: vi.fn(),
  });
});

describe("ProductForm production behavior", () => {
  // PE-6: one generic sentence plus a jump to whichever field happened to be
  // first told the operator nothing. The summary names every failure, takes
  // focus, and shrinks as they are fixed.
  it("summarises every failure on create and jumps to a named field", async () => {
    render(<ProductForm mode="create" categories={[]} />);

    fireEvent.click(screen.getByRole("button", { name: "ذخیره محصول" }));

    const link = await screen.findByRole("link", {
      name: "نام محصول: نام محصول الزامی است",
    });
    expect(
      screen.getByText("۱ مورد باید پیش از ذخیره اصلاح شود"),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("لطفاً موارد مشخص‌شده در فرم را بررسی کنید."),
    ).not.toBeInTheDocument();
    await waitFor(() =>
      expect(document.getElementById("product-error-summary")).toHaveFocus(),
    );

    fireEvent.click(link);
    await waitFor(() =>
      expect(screen.getByLabelText("نام محصول")).toHaveFocus(),
    );
    expect(mocks.saveProductAggregate).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("نام محصول"), {
      target: { value: "محصول تازه" },
    });
    await waitFor(() =>
      expect(
        screen.queryByText("۱ مورد باید پیش از ذخیره اصلاح شود"),
      ).not.toBeInTheDocument(),
    );
  });

  it("guards app links and cancel navigation while edit changes are dirty", async () => {
    render(<ProductForm mode="edit" product={product} categories={[]} />);
    fireEvent.change(screen.getByLabelText("نام محصول"), {
      target: { value: "محصول ویرایش‌شده" },
    });

    fireEvent.click(screen.getByRole("link", { name: "سفارش‌ها" }));
    expect(await screen.findByRole("alertdialog")).toBeInTheDocument();
    expect(mocks.push).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "ادامهٔ ویرایش" }));

    fireEvent.click(screen.getByRole("button", { name: "انصراف" }));
    expect(await screen.findByRole("alertdialog")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "خروج بدون ذخیره" }));

    expect(mocks.push).toHaveBeenCalledWith("/admin/products");
  });

  // PE-5: sections are addressable by `?tab=`, and switching one is not
  // leaving the form — the unsaved dialog must stay out of the way (PE-3).
  it("switches sections through the URL without warning on a dirty form", () => {
    render(<ProductForm mode="edit" product={product} categories={[]} />);
    fireEvent.change(screen.getByLabelText("نام محصول"), {
      target: { value: "محصول ویرایش‌شده" },
    });
    expect(screen.getByLabelText("نام محصول")).toBeVisible();

    openProductSection("seo");

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(mocks.push).not.toHaveBeenCalled();
    expect(window.location.search).toBe("?tab=seo");
    expect(screen.getByRole("link", { name: /سئو/ })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByLabelText("عنوان سئو")).toBeVisible();
    // Hidden, never unmounted — a remount would take the whole
    // react-hook-form state and the staged gallery with it.
    expect(screen.getByLabelText("نام محصول")).toBeInTheDocument();
    expect(screen.getByLabelText("نام محصول")).not.toBeVisible();

    act(() => {
      window.history.back();
      window.dispatchEvent(new PopStateEvent("popstate", { state: null }));
    });
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("opens the section named by a deep link and steps back through them", async () => {
    window.history.replaceState(null, "", "/admin/products/42?tab=seo");
    render(<ProductForm mode="edit" product={product} categories={[]} />);

    // Rendered from the URL rather than always starting at «اطلاعات کلی» —
    // that is what makes a section linkable at all.
    await waitFor(() =>
      expect(screen.getByLabelText("عنوان سئو")).toBeVisible(),
    );

    openProductSection("specs");
    expect(window.location.search).toBe("?tab=specs");

    act(() => {
      window.history.back();
      window.dispatchEvent(new PopStateEvent("popstate", { state: null }));
    });

    await waitFor(() => expect(window.location.search).toBe("?tab=seo"));
    expect(screen.getByLabelText("عنوان سئو")).toBeVisible();
    window.history.replaceState(null, "", "/admin/products/42");
  });

  it("includes deferred gallery edits in the unsaved-change boundary", async () => {
    render(<ProductForm mode="edit" product={product} categories={[]} />);

    openProductSection("images");
    fireEvent.click(screen.getByRole("button", { name: "تغییر تصویر" }));
    fireEvent.click(screen.getByRole("button", { name: "انصراف" }));

    expect(await screen.findByRole("alertdialog")).toHaveTextContent(
      "تغییرات ذخیره نشده‌اند",
    );
  });

  it("registers beforeunload protection only after the form becomes dirty", () => {
    render(<ProductForm mode="edit" product={product} categories={[]} />);
    const cleanEvent = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(cleanEvent);
    expect(cleanEvent.defaultPrevented).toBe(false);

    fireEvent.change(screen.getByLabelText("نام محصول"), {
      target: { value: "محصول ویرایش‌شده" },
    });
    const dirtyEvent = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(dirtyEvent);

    expect(dirtyEvent.defaultPrevented).toBe(true);
  });

  it("guards browser history traversal while the form is dirty", async () => {
    const forward = vi
      .spyOn(window.history, "forward")
      .mockImplementation(() => {});
    const back = vi.spyOn(window.history, "back").mockImplementation(() => {});
    render(<ProductForm mode="edit" product={product} categories={[]} />);
    fireEvent.change(screen.getByLabelText("نام محصول"), {
      target: { value: "محصول ویرایش‌شده" },
    });
    await waitFor(() =>
      expect(window.history.state).toHaveProperty("__rumeraProductFormGuard"),
    );

    act(() => {
      window.history.pushState(null, "", "/admin/products");
      window.dispatchEvent(new PopStateEvent("popstate", { state: null }));
    });

    expect(forward).toHaveBeenCalledOnce();
    expect(await screen.findByRole("alertdialog")).toHaveTextContent(
      "تغییرات ذخیره نشده‌اند",
    );
    fireEvent.click(screen.getByRole("button", { name: "خروج بدون ذخیره" }));
    expect(back).toHaveBeenCalledOnce();
  });

  it("reports preparation, persistence, and completion as distinct phases", async () => {
    const preparation = deferred<[]>();
    const persistence = deferred<AdminProductDetail>();
    mocks.prepare.mockReturnValueOnce(preparation.promise);
    mocks.saveProductAggregate.mockReturnValueOnce(persistence.promise);
    render(<ProductForm mode="create" categories={[]} />);
    fireEvent.change(screen.getByLabelText("نام محصول"), {
      target: { value: "محصول تازه" },
    });

    fireEvent.click(screen.getByRole("button", { name: "ذخیره محصول" }));
    await waitFor(() =>
      expect(screen.getByTestId("save-phase")).toHaveTextContent("preparing"),
    );

    await act(async () => preparation.resolve([]));
    await waitFor(() =>
      expect(screen.getByTestId("save-phase")).toHaveTextContent("saving"),
    );

    await act(async () => persistence.resolve({ ...product, id: 77 }));
    await waitFor(() =>
      expect(screen.getByTestId("save-phase")).toHaveTextContent("saved"),
    );
    expect(mocks.replace).toHaveBeenCalledWith("/admin/products/77");
    expect(mocks.push).not.toHaveBeenCalledWith("/admin/products");
  });

  it("stays on the editor after an existing product is saved", async () => {
    render(<ProductForm mode="edit" product={product} categories={[]} />);

    fireEvent.click(screen.getByRole("button", { name: "ذخیره محصول" }));

    await waitFor(() =>
      expect(screen.getByTestId("save-phase")).toHaveTextContent("saved"),
    );
    expect(mocks.saveProductAggregate).toHaveBeenCalledWith(
      42,
      expect.any(Object),
    );
    expect(mocks.replace).not.toHaveBeenCalled();
    expect(mocks.push).not.toHaveBeenCalled();
    expect(mocks.refresh).toHaveBeenCalled();
  });

  it("keeps fields editable and cancel available while images prepare", async () => {
    const preparation = deferred<[]>();
    mocks.prepare.mockReturnValueOnce(preparation.promise);
    render(<ProductForm mode="create" categories={[]} />);
    fireEvent.change(screen.getByLabelText("نام محصول"), {
      target: { value: "محصول تازه" },
    });

    fireEvent.click(screen.getByRole("button", { name: "ذخیره محصول" }));
    await waitFor(() =>
      expect(screen.getByTestId("save-phase")).toHaveTextContent("preparing"),
    );

    expect(screen.getByLabelText("نام محصول")).not.toBeDisabled();
    expect(screen.getByRole("button", { name: "ذخیره محصول" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "انصراف" })).not.toBeDisabled();

    await act(async () => preparation.resolve([]));
  });

  it("blocks app-link exit while an aggregate save is unresolved", async () => {
    const persistence = deferred<AdminProductDetail>();
    mocks.saveProductAggregate.mockReturnValueOnce(persistence.promise);
    render(<ProductForm mode="edit" product={product} categories={[]} />);

    fireEvent.click(screen.getByRole("button", { name: "ذخیره محصول" }));
    await waitFor(() =>
      expect(screen.getByTestId("save-phase")).toHaveTextContent("saving"),
    );
    fireEvent.click(screen.getByRole("link", { name: "سفارش‌ها" }));

    expect(await screen.findByRole("alertdialog")).toHaveTextContent(
      "ذخیره در حال انجام است",
    );
    expect(
      screen.queryByRole("button", { name: "خروج بدون ذخیره" }),
    ).not.toBeInTheDocument();
    expect(mocks.push).not.toHaveBeenCalled();

    await act(async () => persistence.resolve(product));
  });

  it("opens the collapsed SEO section and focuses a server-rejected field", async () => {
    mocks.saveProductAggregate.mockRejectedValueOnce(
      new ProductClientError(422, "VALIDATION_ERROR", "validation failed", {
        meta_title: ["عنوان سئو معتبر نیست"],
      }),
    );
    render(<ProductForm mode="edit" product={product} categories={[]} />);

    fireEvent.click(screen.getByRole("button", { name: "ذخیره محصول" }));

    expect(
      (await screen.findAllByText("عنوان سئو معتبر نیست")).length,
    ).toBeGreaterThan(0);
    // A server rejection lands on the same summary a client one does (PE-6).
    await waitFor(() =>
      expect(document.getElementById("product-error-summary")).toHaveFocus(),
    );
    fireEvent.click(
      screen.getByRole("link", { name: "عنوان سئو: عنوان سئو معتبر نیست" }),
    );
    // The section has to be painted before the field in it can take focus.
    await waitFor(() =>
      expect(screen.getByLabelText("عنوان سئو")).toHaveFocus(),
    );
    expect(
      screen.getByRole("button", { name: /سئو و متادیتا/ }),
    ).toHaveAttribute("aria-expanded", "true");
  });

  it("focuses image errors and invalidates a rejected prepared upload", async () => {
    mocks.saveProductAggregate.mockRejectedValueOnce(
      new ProductClientError(422, "VALIDATION_ERROR", "validation failed", {
        "images.0": ["staged upload is missing or invalid"],
      }),
    );
    render(<ProductForm mode="edit" product={product} categories={[]} />);

    fireEvent.click(screen.getByRole("button", { name: "ذخیره محصول" }));

    expect(
      await screen.findAllByText(
        "فایل آماده‌شده در دسترس نیست؛ تصویر در تلاش بعدی دوباره بارگذاری می‌شود.",
      ),
    ).not.toHaveLength(0);
    expect(mocks.discardPrepared).toHaveBeenCalledOnce();
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "تصاویر محصول" }),
      ).toHaveFocus(),
    );
  });

  it("surfaces non-field variant conflicts at the variant section", async () => {
    mocks.saveProductAggregate.mockRejectedValueOnce(
      new ProductClientError(409, "CONFLICT", "conflict", {
        variants: ["one or more removed variants are still in use"],
      }),
    );
    render(<ProductForm mode="edit" product={product} categories={[]} />);

    fireEvent.click(screen.getByRole("button", { name: "ذخیره محصول" }));

    expect(
      await screen.findAllByText(
        "یک یا چند تنوع حذف‌شده دارای موجودی یا سابقهٔ عملیاتی هستند.",
      ),
    ).not.toHaveLength(0);
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "قیمت‌گذاری و تنوع‌ها" }),
      ).toHaveFocus(),
    );
  });

  it("does not submit when canWrite is false", async () => {
    render(
      <ProductForm
        mode="edit"
        product={product}
        categories={[]}
        canWrite={false}
      />,
    );

    expect(
      screen.getByText(/فقط مشاهده — ذخیره، بارگذاری تصویر و تغییر تنوع‌ها/),
    ).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("نام محصول"), {
      target: { value: "محصول ویرایش‌شده" },
    });
    fireEvent.click(screen.getByRole("button", { name: "ذخیره محصول" }));

    expect(mocks.saveProductAggregate).not.toHaveBeenCalled();
    expect(mocks.push).not.toHaveBeenCalled();
  });
});
