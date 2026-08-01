import { describe, expect, it } from "vitest";

import { passwordFitsBcrypt } from "./password";

describe("passwordFitsBcrypt", () => {
  it("uses bcrypt's UTF-8 byte boundary", () => {
    expect(passwordFitsBcrypt("a".repeat(72))).toBe(true);
    expect(passwordFitsBcrypt("a".repeat(73))).toBe(false);
    expect(passwordFitsBcrypt("آ".repeat(37))).toBe(false);
  });
});
