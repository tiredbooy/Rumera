// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useForm } from "react-hook-form";

import {
  getDefaultFormValues,
  type ProductFormValues,
} from "../../../validations";
import { FormHeaderBar } from "./FormHeaderBar";
import { MobileActionBar } from "./MobileActionBar";

afterEach(cleanup);

describe("product form responsive actions", () => {
  it("keeps desktop actions out of the mobile surface and announces status once", () => {
    function Harness() {
      const { control } = useForm<ProductFormValues>({
        defaultValues: getDefaultFormValues(),
      });
      return (
        <>
          <FormHeaderBar
            mode="create"
            title=""
            control={control}
            isSubmitting={false}
            isLocked={false}
            hasPendingRetry={false}
            savePhase="idle"
            hasUnsavedChanges={false}
            onCancel={vi.fn()}
          />
          <MobileActionBar
            control={control}
            isSubmitting={false}
            isLocked={false}
            hasPendingRetry={false}
            savePhase="idle"
            onCancel={vi.fn()}
          />
        </>
      );
    }

    render(<Harness />);

    const cancelButtons = screen.getAllByRole("button", { name: "انصراف" });
    expect(cancelButtons).toHaveLength(2);
    expect(cancelButtons[0].parentElement).toHaveClass("hidden", "sm:flex");
    expect(cancelButtons[1].parentElement).toHaveClass("flex");
    expect(screen.getAllByRole("status")).toHaveLength(1);
    for (const publicationSwitch of screen.getAllByRole("switch", {
      name: "وضعیت انتشار محصول",
    })) {
      expect(publicationSwitch).not.toBeChecked();
    }
  });

  it("hides save and locks publication when the editor is read-only", () => {
    function Harness() {
      const { control } = useForm<ProductFormValues>({
        defaultValues: getDefaultFormValues(),
      });
      return (
        <>
          <FormHeaderBar
            mode="edit"
            title="محصول"
            control={control}
            isSubmitting={false}
            isLocked={false}
            hasPendingRetry={false}
            savePhase="idle"
            hasUnsavedChanges={false}
            canWrite={false}
            onCancel={vi.fn()}
          />
          <MobileActionBar
            control={control}
            isSubmitting={false}
            isLocked={false}
            hasPendingRetry={false}
            savePhase="idle"
            canWrite={false}
            onCancel={vi.fn()}
          />
        </>
      );
    }

    render(<Harness />);

    expect(
      screen.queryByRole("button", { name: "ذخیره" }),
    ).not.toBeInTheDocument();
    for (const publicationSwitch of screen.getAllByRole("switch", {
      name: "وضعیت انتشار محصول",
    })) {
      expect(publicationSwitch).toBeDisabled();
    }
  });

  it("links duplicate to a seeded create route", () => {
    function Harness() {
      const { control } = useForm<ProductFormValues>({
        defaultValues: getDefaultFormValues(),
      });
      return (
        <FormHeaderBar
          mode="edit"
          title="محصول"
          control={control}
          isSubmitting={false}
          isLocked={false}
          hasPendingRetry={false}
          savePhase="idle"
          hasUnsavedChanges={false}
          duplicateHref="/admin/products/new?from=9"
          onCancel={vi.fn()}
        />
      );
    }

    render(<Harness />);
    expect(screen.getByRole("link", { name: /تکثیر/ })).toHaveAttribute(
      "href",
      "/admin/products/new?from=9",
    );
  });
});
