// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useForm } from "react-hook-form";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FormDraftNotice, useFormDraft } from "./use-form-draft";

const STORAGE_KEY = "rumera:journal-draft:edit:7";

type Values = { title: string };

function Harness({ revision = "rev-1" }: { revision?: string }) {
  const form = useForm<Values>({ defaultValues: { title: "عنوان سرور" } });
  const draft = useFormDraft({ storageKey: STORAGE_KEY, form, revision });
  return (
    <div>
      <input aria-label="عنوان" {...form.register("title")} />
      <p data-testid="dirty">{form.formState.isDirty ? "dirty" : "clean"}</p>
      <button type="button" onClick={draft.clear}>
        پاک‌سازی
      </button>
      <FormDraftNotice
        draft={draft.draft}
        savedAt={draft.savedAt}
        onRestore={draft.restore}
        onDiscard={draft.discard}
      />
    </div>
  );
}

/** No isDirty in the markup — the case that silently broke autosave. */
function BareHarness() {
  const form = useForm<Values>({ defaultValues: { title: "عنوان سرور" } });
  useFormDraft({ storageKey: STORAGE_KEY, form, revision: "rev-1" });
  return <input aria-label="عنوان" {...form.register("title")} />;
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  sessionStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("useFormDraft", () => {
  it("autosaves a dirty form once, after the debounce, not per keystroke", () => {
    render(<Harness />);
    const input = screen.getByLabelText("عنوان");

    fireEvent.change(input, { target: { value: "پیش" } });
    fireEvent.change(input, { target: { value: "پیش‌نویس" } });
    expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();

    act(() => void vi.advanceTimersByTime(1000));
    const stored = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? "null");
    expect(stored.values.title).toBe("پیش‌نویس");
    expect(stored.revision).toBe("rev-1");
    expect(screen.getByText(/پیش‌نویس محلی/)).toBeInTheDocument();
  });

  it("leaves a clean form alone", () => {
    render(<Harness />);
    const input = screen.getByLabelText("عنوان");
    fireEvent.change(input, { target: { value: "دیگر" } });
    fireEvent.change(input, { target: { value: "عنوان سرور" } });
    act(() => void vi.advanceTimersByTime(1000));
    expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("offers recovery without applying it, and keeps the restored draft unsaved", () => {
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        values: { title: "چهل دقیقه کار" },
        revision: "rev-1",
        savedAt: Date.now(),
      }),
    );
    render(<Harness />);
    act(() => void vi.advanceTimersByTime(0));

    // Nothing is applied on its own.
    expect(screen.getByLabelText("عنوان")).toHaveValue("عنوان سرور");
    expect(screen.getByTestId("dirty")).toHaveTextContent("clean");

    fireEvent.click(screen.getByRole("button", { name: "بازیابی پیش‌نویس" }));
    expect(screen.getByLabelText("عنوان")).toHaveValue("چهل دقیقه کار");
    // Recovered work is still unsaved, so the navigation guard must stay armed.
    expect(screen.getByTestId("dirty")).toHaveTextContent("dirty");
  });

  it("warns when the server moved on after the draft was captured", () => {
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        values: { title: "نسخهٔ من" },
        revision: "rev-1",
        savedAt: Date.now(),
      }),
    );
    render(<Harness revision="rev-2" />);
    act(() => void vi.advanceTimersByTime(0));
    expect(screen.getByText(/روی سرور به‌روزرسانی شده/)).toBeInTheDocument();
  });

  it("drops the draft when it is discarded", () => {
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        values: { title: "دور ریختنی" },
        revision: "rev-1",
        savedAt: Date.now(),
      }),
    );
    render(<Harness />);
    act(() => void vi.advanceTimersByTime(0));
    fireEvent.click(screen.getByRole("button", { name: /دور انداختن/ }));
    expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(screen.getByLabelText("عنوان")).toHaveValue("عنوان سرور");
  });

  it("cancels a pending autosave when the draft is cleared", () => {
    render(<Harness />);
    fireEvent.change(screen.getByLabelText("عنوان"), {
      target: { value: "ذخیره شد" },
    });
    // Mid-debounce, exactly where a successful save lands.
    act(() => void vi.advanceTimersByTime(400));
    fireEvent.click(screen.getByRole("button", { name: "پاک‌سازی" }));
    expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();

    // The in-flight timer must not resurrect what was just saved.
    act(() => void vi.advanceTimersByTime(1500));
    expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("autosaves for a form that never renders isDirty itself", () => {
    render(<BareHarness />);
    fireEvent.change(screen.getByLabelText("عنوان"), {
      target: { value: "بدون isDirty" },
    });
    act(() => void vi.advanceTimersByTime(1000));
    const stored = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? "null");
    expect(stored?.values.title).toBe("بدون isDirty");
  });

  it("ignores a malformed entry instead of crashing the editor", () => {
    sessionStorage.setItem(STORAGE_KEY, "{not json");
    render(<Harness />);
    act(() => void vi.advanceTimersByTime(0));
    expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(screen.queryByRole("button", { name: "بازیابی پیش‌نویس" })).toBeNull();
  });
});
