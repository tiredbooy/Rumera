// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import type { ReactNode } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next-auth/react", () => ({
  useSession: () => ({ status: "unauthenticated" }),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/products/sample",
}));
vi.mock("sonner", () => ({
  toast: { info: vi.fn(), success: vi.fn(), error: vi.fn() },
}));
vi.mock("@/features/product-alerts/hooks", () => ({
  useCreateProductAlert: () => ({ isPending: false, mutate: vi.fn() }),
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

import { AlertButton } from "./alert-button";

afterEach(cleanup);

describe("AlertButton availability choices", () => {
  it("does not offer a restock alert for an available variant", () => {
    render(<AlertButton productVariantId={1} isAvailable />);

    expect(screen.queryByText("اطلاع از موجود شدن")).not.toBeInTheDocument();
    expect(screen.getByText("اطلاع از کاهش قیمت")).toBeInTheDocument();
  });

  it("offers a restock alert for a sold-out variant", () => {
    render(<AlertButton productVariantId={1} isAvailable={false} />);

    expect(screen.getByText("اطلاع از موجود شدن")).toBeInTheDocument();
    expect(screen.getByText("اطلاع از کاهش قیمت")).toBeInTheDocument();
  });
});
