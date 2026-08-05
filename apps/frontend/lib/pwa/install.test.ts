import { describe, expect, it } from "vitest";

import {
  isAndroidDevice,
  isIosDevice,
  isSafariBrowser,
  needsManualIosInstall,
} from "./install";

describe("PWA install detection", () => {
  it("detects iOS and Android user agents", () => {
    expect(isIosDevice("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)")).toBe(
      true,
    );
    expect(isAndroidDevice("Mozilla/5.0 (Linux; Android 14)")).toBe(true);
    expect(isIosDevice("Mozilla/5.0 (Windows NT 10.0)")).toBe(false);
  });

  it("detects Safari vs Chrome on iOS", () => {
    expect(
      isSafariBrowser(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
      ),
    ).toBe(true);
    expect(
      isSafariBrowser(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) CriOS/120.0.0.0 Mobile/15E148 Safari/604.1",
      ),
    ).toBe(false);
  });

  it("requires manual install steps on iOS browser", () => {
    expect(
      needsManualIosInstall(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1",
      ),
    ).toBe(true);
  });
});
