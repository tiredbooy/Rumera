// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));

import { CatalogueLoadError } from "./catalogue-load-error";

afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("CatalogueLoadError", () => {
  it("retries by refreshing the route", () => {
    render(
      <CatalogueLoadError
        title="جستجو انجام نشد"
        description="بارگذاری نتایج با خطا روبه‌رو شد."
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "تلاش مجدد" }));
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
  });
});
