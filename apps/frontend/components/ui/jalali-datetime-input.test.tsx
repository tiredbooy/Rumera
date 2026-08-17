// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { toJalali } from "@/lib/datetime/jalali";

import { JalaliDateTimeInput } from "./jalali-datetime-input";

afterEach(cleanup);

describe("JalaliDateTimeInput", () => {
  it("commits a date-only Jalali value as YYYY-MM-DD and posts it hidden", () => {
    const onChange = vi.fn();
    render(
      <JalaliDateTimeInput
        id="paid-from"
        name="paid_from"
        granularity="date"
        defaultValue="2026-08-08"
        onChange={onChange}
      />,
    );

    const field = document.getElementById("paid-from") as HTMLInputElement;
    const j = toJalali(2026, 3, 21);
    fireEvent.change(field, {
      target: {
        value: `${j.jy}/${String(j.jm).padStart(2, "0")}/${String(j.jd).padStart(2, "0")}`,
      },
    });
    fireEvent.blur(field);

    expect(onChange).toHaveBeenCalledWith("2026-03-21");
    expect(
      document.querySelector('input[type="hidden"][name="paid_from"]'),
    ).toHaveValue("2026-03-21");
    expect(document.querySelector('input[type="date"]')).toBeNull();
  });
});
