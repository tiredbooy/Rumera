// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { renderToStaticMarkup } from "react-dom/server";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import AccountError from "../app/(account)/account/error";
import AccountLoading from "../app/(account)/account/loading";
import AccountNotFound from "../app/(account)/account/not-found";
import CheckoutError from "../app/(storefront)/checkout/error";
import CheckoutLoading from "../app/(storefront)/checkout/loading";
import CheckoutNotFound from "../app/(storefront)/checkout/not-found";
import CategoriesError from "../app/(storefront)/categories/error";
import CategoriesLoading from "../app/(storefront)/categories/loading";
import CategoriesNotFound from "../app/(storefront)/categories/not-found";
import StorefrontError from "../app/(storefront)/error";
import JournalDetailLoading from "../app/(storefront)/journal/[slug]/loading";
import JournalError from "../app/(storefront)/journal/error";
import JournalLoading from "../app/(storefront)/journal/loading";
import JournalNotFound from "../app/(storefront)/journal/not-found";
import RecipesError from "../app/(storefront)/recipes/error";
import RecipesLoading from "../app/(storefront)/recipes/loading";
import RecipesNotFound from "../app/(storefront)/recipes/not-found";
import StorefrontLoading from "../app/(storefront)/loading";
import StorefrontNotFound from "../app/(storefront)/not-found";
import TagsError from "../app/(storefront)/tags/error";
import TagsLoading from "../app/(storefront)/tags/loading";
import TagsNotFound from "../app/(storefront)/tags/not-found";
import AdminError from "../app/admin/error";
import AdminLoading from "../app/admin/loading";
import AdminNotFound from "../app/admin/not-found";
import RootError from "../app/error";
import GlobalError from "../app/global-error";
import RootLoading from "../app/loading";
import RootNotFound from "../app/not-found";
import { QueryStateRegion } from "./query-state-region";
import { RouteLoading, RouteState } from "./route-state";

const notFoundCases = [
  { name: "root", Component: RootNotFound, hrefs: ["/", "/products"] },
  {
    name: "storefront",
    Component: StorefrontNotFound,
    hrefs: ["/products", "/"],
  },
  {
    name: "account",
    Component: AccountNotFound,
    hrefs: ["/account", "/"],
  },
  {
    name: "checkout",
    Component: CheckoutNotFound,
    hrefs: ["/cart", "/products"],
  },
  {
    name: "categories",
    Component: CategoriesNotFound,
    hrefs: ["/categories", "/products"],
  },
  {
    name: "tags",
    Component: TagsNotFound,
    hrefs: ["/tags", "/products"],
  },
  {
    name: "journal",
    Component: JournalNotFound,
    hrefs: ["/journal", "/products"],
  },
  {
    name: "recipes",
    Component: RecipesNotFound,
    hrefs: ["/recipes", "/products"],
  },
  { name: "admin", Component: AdminNotFound, hrefs: ["/admin", "/"] },
];

const errorCases = [
  { name: "root", Component: RootError },
  { name: "storefront", Component: StorefrontError },
  { name: "account", Component: AccountError },
  { name: "checkout", Component: CheckoutError },
  { name: "categories", Component: CategoriesError },
  { name: "journal", Component: JournalError },
  { name: "recipes", Component: RecipesError },
  { name: "tags", Component: TagsError },
  { name: "admin", Component: AdminError },
];

const loadingCases = [
  { name: "root", Component: RootLoading },
  { name: "storefront", Component: StorefrontLoading },
  { name: "journal detail", Component: JournalDetailLoading },
  { name: "journal", Component: JournalLoading },
  { name: "recipes", Component: RecipesLoading },
  { name: "account", Component: AccountLoading },
  { name: "checkout", Component: CheckoutLoading },
  { name: "categories", Component: CategoriesLoading },
  { name: "tags", Component: TagsLoading },
  { name: "admin", Component: AdminLoading },
];

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("route state contracts", () => {
  it.each(errorCases)(
    "$name error boundary logs safely and retries through its rendered button",
    ({ Component }) => {
      const unstable_retry = vi.fn();
      const secretMessage = "token=server-secret";
      const secretDigest = "private-digest-123";
      const error = Object.assign(new Error(secretMessage), {
        digest: secretDigest,
      });
      const consoleError = vi
        .spyOn(console, "error")
        .mockImplementation(() => undefined);

      render(<Component error={error} unstable_retry={unstable_retry} />);
      fireEvent.click(screen.getByRole("button", { name: "تلاش دوباره" }));

      expect(unstable_retry).toHaveBeenCalledTimes(1);
      expect(consoleError).toHaveBeenCalledWith(error);
      expect(document.body).not.toHaveTextContent(secretMessage);
      expect(document.body).not.toHaveTextContent(secretDigest);
      expect(document.querySelector('[aria-live="assertive"]')).not.toBeNull();
    },
  );

  it("keeps the terminal global fallback self-contained and safe", () => {
    const markup = renderToStaticMarkup(
      <GlobalError
        error={new Error("token=server-secret")}
        unstable_retry={() => undefined}
      />,
    );

    expect(markup).toContain('role="alert"');
    expect(markup).toContain('id="main-content"');
    expect(markup).toContain('tabindex="-1"');
    expect(markup).not.toMatch(/<main[^>]*role="alert"/);
    expect(markup).toContain("<button");
    expect(markup).toContain('<a href="/"');
    expect(markup).not.toContain('data-slot="route-state"');
    expect(markup).not.toContain("token=server-secret");
  });

  it("gives root route states a focusable main-content target", () => {
    const stateMarkup = renderToStaticMarkup(
      <RouteState
        as="main"
        eyebrow="خطا"
        title="عنوان"
        description="توضیح"
        icon={<span />}
      />,
    );
    const loadingMarkup = renderToStaticMarkup(
      <RouteLoading as="main" label="در حال بارگذاری" />,
    );

    for (const markup of [stateMarkup, loadingMarkup]) {
      expect(markup).toContain('id="main-content"');
      expect(markup).toContain('tabindex="-1"');
    }
  });

  it("exposes localized busy and status semantics while loading", () => {
    const label = "در حال بارگذاری حساب کاربری";
    const markup = renderToStaticMarkup(<RouteLoading label={label} />);

    expect(markup).toContain('role="status"');
    expect(markup).toContain('aria-busy="true"');
    expect(markup).toContain(`aria-label="${label}"`);
    expect(markup).toContain(label);
  });

  it.each(loadingCases)(
    "$name loading boundary exposes busy and status semantics",
    ({ Component }) => {
      const markup = renderToStaticMarkup(<Component />);

      expect(markup).toContain('role="status"');
      expect(markup).toContain('aria-busy="true"');
    },
  );

  it("exposes distinct local query loading and error announcements", () => {
    const { rerender } = render(
      <QueryStateRegion state="loading" aria-label="در حال دریافت داده" />,
    );

    expect(screen.getByRole("status")).toHaveAttribute("aria-live", "polite");
    expect(screen.getByRole("status")).toHaveAttribute("aria-busy", "true");

    rerender(
      <QueryStateRegion state="error">دریافت ناموفق بود</QueryStateRegion>,
    );

    expect(screen.getByRole("alert")).toHaveAttribute("aria-live", "assertive");
    expect(screen.getByRole("alert")).not.toHaveAttribute("aria-busy");
  });

  it.each(notFoundCases)(
    "$name not-found state renders valid internal escape links",
    ({ Component, hrefs }) => {
      const markup = renderToStaticMarkup(<Component />);

      for (const href of hrefs) {
        expect(markup).toContain(`href="${href}"`);
      }
      expect(markup.match(/<a\b/g)).toHaveLength(hrefs.length);
      expect(markup).not.toContain("javascript:");
    },
  );
});
