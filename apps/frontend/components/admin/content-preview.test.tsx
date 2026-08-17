// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

afterEach(cleanup);

import { ContentPreview } from "./content-preview";

describe("ContentPreview", () => {
  // CE-1. The point is not "a preview exists" — it is that the author sees the
  // PUBLISHED result. That means the real sanitizer and the real prose-rumera
  // typography, not the denser prose-recipe editing surface.
  it("renders through the publish-time sanitizer, not the raw editor HTML", () => {
    const { container } = render(
      <ContentPreview
        content={'<h2>عنوان</h2><script>alert(1)</script><p>متن</p>'}
        emptyMessage="خالی"
      />,
    );

    const body = screen.getByTestId("content-preview-body");
    expect(body.querySelector("h2")).not.toBeNull();
    expect(body.querySelector("p")).not.toBeNull();
    // A tag the allowlist drops must disappear here, before publishing.
    expect(container.innerHTML).not.toContain("<script");
    expect(container.innerHTML).not.toContain("alert(1)");
  });

  it("uses the public prose-rumera scale so the preview matches the live page", () => {
    render(<ContentPreview content="<p>متن</p>" emptyMessage="خالی" />);

    expect(
      screen.getByTestId("content-preview-body").querySelector(".prose-rumera"),
    ).not.toBeNull();
  });

  // Legacy bodies predate the rich text editor and are Markdown; the public page
  // falls back to a Markdown renderer for them, so the preview must too.
  it("falls back to markdown for a non-HTML body", () => {
    render(<ContentPreview content={"## عنوان\n\nمتن"} emptyMessage="خالی" />);

    const body = screen.getByTestId("content-preview-body");
    expect(body.querySelector("h2")?.textContent).toBe("عنوان");
  });

  it("shows the empty message rather than a blank panel", () => {
    render(<ContentPreview content="" emptyMessage="هنوز چیزی نوشته نشده" />);

    expect(screen.getByText("هنوز چیزی نوشته نشده")).toBeInTheDocument();
  });

  it("is visible by default and can be collapsed", () => {
    render(<ContentPreview content="<p>متن</p>" emptyMessage="خالی" />);

    // Default open: an author who never finds a toggle still gets the preview,
    // which is the whole complaint CE-1 records.
    expect(screen.getByTestId("content-preview-body")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /پنهان کردن/ }));
    expect(screen.queryByTestId("content-preview-body")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /نمایش/ }));
    expect(screen.getByTestId("content-preview-body")).toBeInTheDocument();
  });
});
