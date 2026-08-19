// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  UnsavedChangesDialog,
  useUnsavedChangesGuard,
} from "./use-unsaved-changes-guard";

const mocks = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push }),
}));

function Harness({ dirty = true }: { dirty?: boolean }) {
  const guard = useUnsavedChangesGuard({ enabled: dirty });
  return (
    <div>
      <a href="/rumera-guard-target">فهرست محصولات</a>
      <a href="#product-section-seo">پرش به سئو</a>
      <button type="button" onClick={() => guard.requestNavigation("/admin")}>
        انصراف
      </button>
      <button type="button" onClick={guard.release}>
        رها کردن نگهبان
      </button>
      <UnsavedChangesDialog {...guard.dialogProps} />
    </div>
  );
}

afterEach(() => {
  cleanup();
  mocks.push.mockReset();
});

describe("useUnsavedChangesGuard", () => {
  it("stops an in-app link while there is unsaved work", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("link", { name: "فهرست محصولات" }));
    expect(screen.getByText("تغییرات ذخیره نشده‌اند")).toBeInTheDocument();
  });

  it("lets a same-page section jump link through (PE-3)", () => {
    render(<Harness />);
    const event = new MouseEvent("click", { bubbles: true, cancelable: true });
    screen.getByRole("link", { name: "پرش به سئو" }).dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
    expect(screen.queryByText("تغییرات ذخیره نشده‌اند")).not.toBeInTheDocument();
  });

  it("routes a cancel button straight through when the form is clean", () => {
    render(<Harness dirty={false} />);
    fireEvent.click(screen.getByRole("button", { name: "انصراف" }));
    expect(mocks.push).toHaveBeenCalledWith("/admin");
    expect(screen.queryByText("تغییرات ذخیره نشده‌اند")).not.toBeInTheDocument();
  });

  it("navigates once the operator confirms, without asking again", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "انصراف" }));
    fireEvent.click(screen.getByRole("button", { name: "خروج بدون ذخیره" }));
    expect(mocks.push).toHaveBeenCalledWith("/admin");

    // The form is still dirty, but the operator already chose to leave.
    fireEvent.click(screen.getByRole("link", { name: "فهرست محصولات" }));
    expect(screen.queryByText("تغییرات ذخیره نشده‌اند")).not.toBeInTheDocument();
  });

  it("stands down for the form's own submit-then-redirect", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "رها کردن نگهبان" }));
    fireEvent.click(screen.getByRole("link", { name: "فهرست محصولات" }));
    expect(screen.queryByText("تغییرات ذخیره نشده‌اند")).not.toBeInTheDocument();
  });

  it("blocks the browser unload only while dirty", () => {
    const { rerender } = render(<Harness />);
    const blocked = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(blocked);
    expect(blocked.defaultPrevented).toBe(true);

    rerender(<Harness dirty={false} />);
    const allowed = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(allowed);
    expect(allowed.defaultPrevented).toBe(false);
  });
});
