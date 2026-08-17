// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { AdminUserAuditEvent } from "@/features/customers/types";
import { UserAuditHistory } from "./user-audit-history";

afterEach(cleanup);

const olderEvent: AdminUserAuditEvent = {
  event_id: "event-old",
  actor_user_id: "admin-1",
  actor_email: "owner@example.com",
  target_user_id: "user-2",
  action: "user.created",
  changed_fields: ["email"],
  changes: {
    email: { before: null, after: "mina@example.com" },
  },
  created_at: "2026-07-20T08:00:00Z",
};

const newerEvent: AdminUserAuditEvent = {
  event_id: "event-new",
  actor_user_id: "admin-2",
  actor_email: "security@example.com",
  target_user_id: "user-2",
  action: "user.updated",
  changed_fields: ["role", "is_active"],
  changes: {
    role: { before: "customer", after: "admin" },
    is_active: { before: true, after: false },
  },
  created_at: "2026-07-21T09:30:00Z",
};

describe("UserAuditHistory", () => {
  it("renders newest-first actor/action/time details and role/status transitions", () => {
    render(
      <UserAuditHistory
        userID="user-2"
        events={[olderEvent, newerEvent]}
        pagination={{
          page: 2,
          limit: 20,
          total_items: 42,
          total_pages: 3,
          has_next: true,
          has_prev: true,
        }}
      />,
    );

    const entries = screen.getAllByRole("listitem");
    expect(within(entries[0]).getByText("ویرایش کاربر")).toBeInTheDocument();
    expect(
      within(entries[0]).getByText("security@example.com"),
    ).toBeInTheDocument();
    expect(within(entries[0]).getByText("نقش")).toBeInTheDocument();
    expect(within(entries[0]).getByText("وضعیت")).toBeInTheDocument();
    const changes = Array.from(entries[0].querySelectorAll("dd"), (entry) =>
      entry.textContent?.replace(/\s+/g, " ").trim(),
    );
    expect(changes).toContain("از «مشتری» به «مدیر کل»");
    expect(changes).toContain("از «فعال» به «غیرفعال»");
    expect(within(entries[0]).getByRole("time")).toHaveAttribute(
      "datetime",
      newerEvent.created_at,
    );
    expect(within(entries[1]).getByText("ساخت کاربر")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "صفحهٔ قبلی" }),
    ).toHaveAttribute("href", "/admin/customers/user-2");
    expect(
      screen.getByRole("link", { name: "صفحهٔ بعدی" }),
    ).toHaveAttribute("href", "/admin/customers/user-2?audit_page=3");
  });
});
