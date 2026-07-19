import { describe, expect, it } from "vitest";

import type { ShippingMethod, ShippingZone } from "./types";
import {
  parseRegionCodes,
  shippingMethodFormDefaults,
  shippingMethodFormSchema,
  shippingZoneFormDefaults,
  toUpdateShippingMethodInput,
  toUpdateShippingZoneInput,
} from "./validations";

describe("shipping validation", () => {
  it("normalizes and deduplicates region codes", () => {
    expect(parseRegionCodes(" ir-teh، IR-TEH, de\nIR-ALB ")).toEqual([
      "IR-TEH",
      "DE",
      "IR-ALB",
    ]);
  });

  it("rejects contradictory method rules", () => {
    const result = shippingMethodFormSchema.safeParse({
      ...shippingMethodFormDefaults(),
      rate_type: "percentage",
      base_rate: "100.01",
      min_delivery_days: "5",
      max_delivery_days: "2",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.base_rate).toBeDefined();
      expect(
        result.error.flatten().fieldErrors.max_delivery_days,
      ).toBeDefined();
    }
  });

  it("emits explicit null only for cleared nullable method rules", () => {
    const method: ShippingMethod = {
      id: 4,
      shipping_zone_id: 2,
      name: "Standard",
      carrier: "Post",
      description: "Ground",
      rate_type: "flat_rate",
      base_rate: 12,
      free_above_amount: 100,
      min_delivery_days: 2,
      max_delivery_days: 5,
      max_weight_kg: 10,
      is_active: true,
      estimated_cost: 0,
    };
    const values = {
      ...shippingMethodFormDefaults(method),
      carrier: "",
      description: "",
      free_above_amount: "",
      min_delivery_days: "",
      max_delivery_days: "",
      max_weight_kg: "",
    };

    expect(toUpdateShippingMethodInput(values, method)).toEqual({
      carrier: null,
      description: null,
      free_above_amount: null,
      min_delivery_days: null,
      max_delivery_days: null,
      max_weight_kg: null,
    });
  });

  it("builds a selective normalized zone patch", () => {
    const zone: ShippingZone = {
      id: 2,
      name: "Tehran",
      description: "Old",
      region_codes: ["IR-TEH"],
      is_active: true,
    };
    const values = {
      ...shippingZoneFormDefaults(zone),
      description: "",
      region_codes: " ir-teh، de ",
    };

    expect(toUpdateShippingZoneInput(values, zone)).toEqual({
      description: null,
      region_codes: ["IR-TEH", "DE"],
    });
  });
});
