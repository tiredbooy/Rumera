// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  searchParams: vi.fn(() => new URLSearchParams()),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/orders",
  useRouter: () => ({ push: mocks.push, replace: mocks.replace }),
  useSearchParams: () => mocks.searchParams(),
}));

import {
  AdminFilterChips,
  AdminSavedViews,
  FilterSearchInput,
  FilterSelect,
  type FilterChip,
  type FilterParamLabels,
} from "./admin-filter-controls";

const PARAMS: FilterParamLabels = { status: "وضعیت", q: "جستجو" };

const STATUS_OPTIONS = [
  { value: "", label: "همهٔ وضعیت‌ها" },
  { value: "paid", label: "پرداخت‌شده" },
  { value: "shipped", label: "در حال ارسال" },
];

/**
 * Stand-in for a migrated list: it parses its own params (and, like every real
 * list, refuses a value it does not recognise) and hands the parsed result to
 * the chips.
 */
function Fixture() {
  const params = mocks.searchParams();
  const raw = params.get("status") ?? "";
  const status = raw === "paid" || raw === "shipped" ? raw : "";
  const query = params.get("q") ?? "";

  const chips: FilterChip[] = [];
  if (status) {
    chips.push({
      param: "status",
      label: `وضعیت: ${status === "paid" ? "پرداخت‌شده" : "در حال ارسال"}`,
    });
  }
  if (query) chips.push({ param: "q", label: `جستجو: ${query}` });

  return (
    <>
      <FilterSelect
        id="fixture-status"
        label="وضعیت"
        param="status"
        value={status}
        options={STATUS_OPTIONS}
      />
      <FilterSearchInput
        id="fixture-query"
        label="جستجو"
        value={query}
      />
      <AdminFilterChips params={PARAMS} chips={chips} />
      <AdminSavedViews list="orders" params={PARAMS} />
    </>
  );
}

/** jsdom here ships without Web Storage; saved views need a real one. */
function stubLocalStorage() {
  const store = new Map<string, string>();
  const memory: Storage = {
    get length() {
      return store.size;
    },
    clear: () => store.clear(),
    getItem: (key) => (store.has(key) ? store.get(key)! : null),
    key: (index) => [...store.keys()][index] ?? null,
    removeItem: (key) => void store.delete(key),
    setItem: (key, value) => void store.set(key, String(value)),
  };
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: memory,
  });
}

function atParams(query: string) {
  mocks.searchParams.mockReturnValue(new URLSearchParams(query));
}

afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
  atParams("");
  stubLocalStorage();
});

describe("useFilterParams", () => {
  it("applies a select on change, without an apply button", () => {
    render(<Fixture />);

    fireEvent.change(screen.getByLabelText("وضعیت"), {
      target: { value: "paid" },
    });

    expect(mocks.replace).toHaveBeenCalledTimes(1);
    expect(mocks.replace).toHaveBeenCalledWith("/admin/orders?status=paid");
  });

  it("replaces rather than pushes, so a triage loop leaves one history entry", () => {
    render(<Fixture />);

    fireEvent.change(screen.getByLabelText("وضعیت"), {
      target: { value: "shipped" },
    });

    expect(mocks.push).not.toHaveBeenCalled();
  });

  it("debounces a text field into a single navigation, not one per keystroke", () => {
    vi.useFakeTimers();
    try {
      render(<Fixture />);
      const box = screen.getByLabelText("جستجو");

      for (const value of ["a", "ab", "abc"]) {
        fireEvent.change(box, { target: { value } });
        act(() => void vi.advanceTimersByTime(100));
      }
      expect(mocks.replace).not.toHaveBeenCalled();

      act(() => void vi.advanceTimersByTime(300));
      expect(mocks.replace).toHaveBeenCalledTimes(1);
      expect(mocks.replace).toHaveBeenCalledWith("/admin/orders?q=abc");
    } finally {
      vi.useRealTimers();
    }
  });

  it("returns to page 1 whenever a filter changes", () => {
    atParams("page=4&status=paid");
    render(<Fixture />);

    fireEvent.change(screen.getByLabelText("وضعیت"), {
      target: { value: "shipped" },
    });

    expect(mocks.replace).toHaveBeenCalledWith("/admin/orders?status=shipped");
  });

  it("keeps params the list does not own", () => {
    atParams("utm_source=newsletter&ref=triage&page=2");
    render(<Fixture />);

    fireEvent.change(screen.getByLabelText("وضعیت"), {
      target: { value: "paid" },
    });

    expect(mocks.replace).toHaveBeenCalledWith(
      "/admin/orders?utm_source=newsletter&ref=triage&status=paid",
    );
  });
});

describe("AdminFilterChips", () => {
  it("clears exactly its own filter and nothing else", () => {
    atParams("status=paid&q=box&utm_source=newsletter");
    render(<Fixture />);

    fireEvent.click(
      screen.getByRole("button", { name: "حذف فیلتر وضعیت: پرداخت‌شده" }),
    );

    expect(mocks.replace).toHaveBeenCalledWith(
      "/admin/orders?q=box&utm_source=newsletter",
    );
  });

  it("renders nothing when no filter is applied", () => {
    render(<Fixture />);
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });

  it("surfaces a value the list refused instead of filtering silently", () => {
    atParams("status=archived");
    render(<Fixture />);

    expect(
      screen.getByText("وضعیت: مقدار نامعتبر، اعمال نشد"),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "حذف فیلتر نامعتبر وضعیت" }),
    );
    expect(mocks.replace).toHaveBeenCalledWith("/admin/orders");
  });
});

describe("AdminSavedViews", () => {
  function openMenu() {
    fireEvent.click(screen.getByRole("button", { name: /نماهای ذخیره‌شده/ }));
  }

  it("round-trips a filter combination through storage", () => {
    atParams("status=paid&q=box&page=3");
    const saved = render(<Fixture />);

    openMenu();
    fireEvent.change(screen.getByLabelText("ذخیرهٔ فیلترهای فعلی"), {
      target: { value: "صف صبح" },
    });
    fireEvent.click(screen.getByRole("button", { name: "ذخیره" }));
    saved.unmount();

    // Come back tomorrow on a clean URL and pick the view up again. The page
    // number was never part of it.
    atParams("");
    render(<Fixture />);
    openMenu();
    fireEvent.click(screen.getByRole("button", { name: "صف صبح" }));

    expect(mocks.replace).toHaveBeenCalledWith("/admin/orders?status=paid&q=box");
  });

  it("clears filters the view does not carry rather than intersecting with them", () => {
    atParams("status=paid");
    const saved = render(<Fixture />);
    openMenu();
    fireEvent.change(screen.getByLabelText("ذخیرهٔ فیلترهای فعلی"), {
      target: { value: "پرداخت‌شده‌ها" },
    });
    fireEvent.click(screen.getByRole("button", { name: "ذخیره" }));
    saved.unmount();

    atParams("q=box");
    render(<Fixture />);
    openMenu();
    fireEvent.click(screen.getByRole("button", { name: "پرداخت‌شده‌ها" }));

    expect(mocks.replace).toHaveBeenCalledWith("/admin/orders?status=paid");
  });

  it("refuses to save an empty filter set", () => {
    render(<Fixture />);
    openMenu();

    expect(screen.getByLabelText("ذخیرهٔ فیلترهای فعلی")).toBeDisabled();
    expect(screen.getByRole("button", { name: "ذخیره" })).toBeDisabled();
  });
});
