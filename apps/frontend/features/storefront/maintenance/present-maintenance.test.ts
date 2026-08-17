import { describe, expect, it } from "vitest";

import { presentMaintenanceCopy } from "./present-maintenance";

describe("presentMaintenanceCopy", () => {
  it("returns null when maintenance is off or unknown", () => {
    expect(presentMaintenanceCopy(null)).toBeNull();
    expect(presentMaintenanceCopy(undefined)).toBeNull();
    expect(presentMaintenanceCopy({ enabled: false, message: "ظهر برمی‌گردیم." })).toBeNull();
    expect(presentMaintenanceCopy({ message: "ظهر برمی‌گردیم." })).toBeNull();
  });

  it("uses the published message and falls back to در حال تعمیر", () => {
    expect(
      presentMaintenanceCopy({ enabled: true, message: "ظهر برمی‌گردیم." }),
    ).toBe("ظهر برمی‌گردیم.");
    expect(presentMaintenanceCopy({ enabled: true, message: "  " })).toBe(
      "در حال تعمیر",
    );
    expect(presentMaintenanceCopy({ enabled: true, message: "" })).toBe(
      "در حال تعمیر",
    );
    expect(presentMaintenanceCopy({ enabled: true })).toBe("در حال تعمیر");
  });
});
