// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("next-auth/react", () => ({
  signOut: vi.fn(),
}));

vi.mock("@/components/mode-toggle", () => ({
  ModeToggle: () => <span>theme</span>,
}));

vi.mock("./dashboard-nav", () => ({
  DashboardNav: () => <nav>nav</nav>,
}));

vi.mock("@/components/brand/rumera-brand-mark", () => ({
  RumeraBrandMark: () => <span>rumera</span>,
}));

import { AdminPage } from "./admin-page";
import { DashboardShell } from "./dashboard-shell";

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

afterEach(cleanup);

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", ResizeObserverStub);
  Element.prototype.scrollIntoView = vi.fn();
});

const user = { name: "Mina", email: "mina@example.com", roleLabel: "مدیر" };

describe("DashboardShell command search", () => {
  it("mounts compact and desktop admin search triggers", () => {
    render(
      <DashboardShell variant="admin" permissions={[]} user={user}>
        board
      </DashboardShell>,
    );

    expect(
      screen.getAllByRole("button", { name: "جستجو در پنل" }),
    ).toHaveLength(2);
    expect(screen.getByText("پنل مدیریت")).toBeInTheDocument();
  });

  it("toggles the palette from ⌘K even when the wide bar is hidden", async () => {
    render(
      <DashboardShell variant="admin" permissions={[]} user={user}>
        board
      </DashboardShell>,
    );

    fireEvent.keyDown(window, { key: "k", metaKey: true });
    expect(await screen.findByRole("dialog")).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  it("drops the 78rem cap when an AdminPage list asks for width=wide", () => {
    const { rerender } = render(
      <DashboardShell variant="admin" permissions={[]} user={user}>
        form
      </DashboardShell>,
    );
    expect(screen.getByRole("main")).toHaveClass("max-w-[78rem]");

    rerender(
      <DashboardShell variant="admin" permissions={[]} user={user}>
        <AdminPage title="محصولات">
          <p>فهرست</p>
        </AdminPage>
      </DashboardShell>,
    );
    expect(screen.getByRole("main")).toHaveClass("max-w-none");
    expect(screen.getByRole("main")).not.toHaveClass("max-w-[78rem]");
  });

  it("lifts the 78rem content cap when a list page asks for wide", async () => {
    const { AdminPage } = await import("./admin-page");
    const { rerender } = render(
      <DashboardShell variant="admin" permissions={[]} user={user}>
        <AdminPage title="محصولات">
          <p>فهرست</p>
        </AdminPage>
      </DashboardShell>,
    );

    expect(screen.getByRole("main")).toHaveClass("max-w-none");
    expect(screen.getByRole("main")).not.toHaveClass("max-w-[78rem]");

    rerender(
      <DashboardShell variant="admin" permissions={[]} user={user}>
        <AdminPage title="نقش‌ها" width="default">
          <p>فرم</p>
        </AdminPage>
      </DashboardShell>,
    );
    expect(screen.getByRole("main")).toHaveClass("max-w-[78rem]");
  });

  it("does not show admin command search on the account variant", () => {
    render(
      <DashboardShell variant="account" permissions={[]} user={user}>
        account
      </DashboardShell>,
    );

    expect(
      screen.queryByRole("button", { name: "جستجو در پنل" }),
    ).not.toBeInTheDocument();
  });
});
