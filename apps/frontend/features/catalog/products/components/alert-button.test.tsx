// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import type { ReactNode } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  mutate: vi.fn(),
  push: vi.fn(),
}));

vi.mock("next-auth/react", () => ({
  useSession: () => ({ status: "unauthenticated" }),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push }),
  usePathname: () => "/products/sample",
}));
vi.mock("sonner", () => ({
  toast: { info: vi.fn(), success: vi.fn(), error: vi.fn() },
}));
vi.mock("@/features/product-alerts/hooks", () => ({
  useCreateProductAlert: () => ({ isPending: false, mutate: mocks.mutate }),
}));
vi.mock("@/components/ui/button", () => ({
  Button: ({ children, ...props }: { children: ReactNode }) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
}));
vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenuTrigger: ({ children }: { children: ReactNode }) => (
    <>{children}</>
  ),
  DropdownMenuContent: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenuItem: ({ children }: { children: ReactNode }) => (
    <button type="button">{children}</button>
  ),
}));

import { takeAlertIntent } from "@/features/product-alerts/pending-alert";

import { AlertButton } from "./alert-button";

afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
});

describe("AlertButton availability choices", () => {
  it("does not offer a restock alert for an available variant", () => {
    render(<AlertButton productVariantId={1} isAvailable />);

    expect(screen.queryByText("اطلاع از موجود شدن")).not.toBeInTheDocument();
    expect(screen.getByText("اطلاع از کاهش قیمت")).toBeInTheDocument();
  });

  it("offers a restock alert for a sold-out variant", () => {
    render(<AlertButton productVariantId={1} isAvailable={false} />);

    expect(
      screen.getByRole("button", { name: "اطلاع از موجود شدن" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "اطلاع از کاهش قیمت" }),
    ).toBeInTheDocument();
  });

  it("stashes a restock alert when a guest is bounced to login", () => {
    render(<AlertButton productVariantId={4} isAvailable={false} />);
    fireEvent.click(screen.getByRole("button", { name: "اطلاع از موجود شدن" }));

    expect(mocks.mutate).not.toHaveBeenCalled();
    expect(mocks.push).toHaveBeenCalled();
    expect(takeAlertIntent()).toEqual({
      product_variant_id: 4,
      alert_type: "restock",
    });
    expect(takeAlertIntent()).toBeNull();
  });
});
