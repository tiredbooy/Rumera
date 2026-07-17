// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import {
  FieldControl,
  fieldDescriptionId,
  fieldErrorId,
} from "./field";

afterEach(cleanup);

describe("FieldControl", () => {
  it("uses stable description and error ids without losing existing descriptions", () => {
    const { rerender } = render(
      <FieldControl id="email" description>
        <input aria-label="ایمیل" aria-describedby="external-help" />
      </FieldControl>,
    );

    expect(screen.getByRole("textbox", { name: "ایمیل" })).toHaveAttribute(
      "aria-describedby",
      `external-help ${fieldDescriptionId("email")}`,
    );

    rerender(
      <FieldControl id="email" error="نامعتبر" description>
        <input aria-label="ایمیل" aria-describedby="external-help" />
      </FieldControl>,
    );

    const control = screen.getByRole("textbox", { name: "ایمیل" });
    expect(control).toHaveAttribute(
      "aria-describedby",
      `external-help ${fieldErrorId("email")}`,
    );
    expect(control).toHaveAttribute("aria-invalid", "true");
  });
});
