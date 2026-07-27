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
});
