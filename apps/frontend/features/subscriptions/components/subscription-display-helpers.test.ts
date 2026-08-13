import { describe, expect, it } from "vitest";

import {
  actionConfirmDescription,
  actionSuccessMessage,
  nextShipHint,
  nextShipTitle,
  planName,
  statusCopy,
} from "./subscription-display-helpers";

describe("subscription display helpers (PH-043b)", () => {
  it("names the cellar box plan", () => {
    expect(planName("cellar-box")).toBe("باکس سرداب");
    expect(planName("unknown")).toContain("باکس");
  });

  it("labels next ship by status (not payment invoice)", () => {
    expect(nextShipTitle("active")).toContain("ارسال");
    expect(nextShipTitle("paused")).toContain("نگه‌داشته");
    expect(nextShipTitle("cancelled")).toContain("لغو");
    expect(nextShipHint("active")).toMatch(/ایمیل|یادآوری/);
    expect(nextShipHint("active")).toMatch(/پرداخت خودکار/);
  });

  it("explains statuses in box language", () => {
    expect(statusCopy("active").label).toBe("فعال");
    expect(statusCopy("paused").explain).toMatch(/متوقف/);
    expect(statusCopy("cancelled").explain).toMatch(/لغو/);
  });

  it("success and confirm copy for lifecycle actions", () => {
    expect(actionSuccessMessage("skip")).toMatch(/رد/);
    expect(actionSuccessMessage("pause")).toMatch(/متوقف/);
    expect(actionConfirmDescription("skip").body).toMatch(/جلو/);
    expect(actionConfirmDescription("cancel").confirm).toMatch(/لغو/);
    expect(actionConfirmDescription("pause").title).toMatch(/توقف/);
  });
});
