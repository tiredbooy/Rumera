import { describe, expect, it } from "vitest";

import {
  firstSettingsTabWithErrors,
  settingsTabForField,
  settingsTabsWithErrors,
} from "./settings-tabs";

describe("settings tab error mapping", () => {
  it("maps nested gift rows and SEO leaves onto their tabs", () => {
    expect(settingsTabForField("defaultTitle")).toBe("seo");
    expect(settingsTabForField("giftOptions.0.id")).toBe("gift");
    expect(settingsTabForField("name")).toBe("store");
  });

  it("picks the first tab in editor order, not object-key order", () => {
    expect(
      firstSettingsTabWithErrors({
        defaultTitle: { type: "max", message: "too long" },
        name: { type: "required", message: "required" },
      }),
    ).toBe("store");
    expect(
      settingsTabsWithErrors({
        defaultTitle: { type: "max", message: "too long" },
        supportEmail: { type: "custom", message: "bad email" },
      }),
    ).toEqual(new Set(["seo", "contact"]));
  });
});
