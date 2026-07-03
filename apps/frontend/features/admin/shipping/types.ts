// types/shipping.ts
import { BaseFilter } from "@/lib/types/filters";

// ------------------------------------------------
// Enums / string unions
// ------------------------------------------------

export type ShippingRateType = "flat_rate" | "per_kg" | "percentage" | "free";

// ------------------------------------------------
// Response types
// ------------------------------------------------

export interface ShippingMethodResponse {
  id: number;
  name: string;
  carrier?: string | null;
  description?: string | null;
  rate_type: ShippingRateType;
  base_rate: number;
  free_above_amount?: number | null;
  min_delivery_days?: number | null; // int16
  max_delivery_days?: number | null; // int16
  max_weight_kg?: number | null;
  is_active: boolean;
  estimated_cost: number; // calculated by the service
}

export interface ShippingZoneResponse {
  id: number;
  name: string;
  description?: string | null;
  region_codes: string[];
  is_active: boolean;
  methods?: ShippingMethodResponse[]; // nested methods, omitted if not requested
}

// ------------------------------------------------
// Request payloads
// ------------------------------------------------

export interface CreateShippingZoneReq {
  name: string;
  description?: string | null;
  region_codes: string[];
  is_active?: boolean;
}

export interface UpdateShippingZoneReq {
  name?: string | null;
  description?: string | null;
  region_codes?: string[];
  is_active?: boolean;
}

export interface CreateShippingMethodReq {
  name: string;
  carrier?: string | null;
  description?: string | null;
  rate_type: ShippingRateType;
  base_rate: number;
  free_above_amount?: number | null;
  min_delivery_days?: number | null;
  max_delivery_days?: number | null;
  max_weight_kg?: number | null;
  is_active?: boolean;
}

export interface UpdateShippingMethodReq {
  name?: string | null;
  carrier?: string | null;
  description?: string | null;
  rate_type?: ShippingRateType;
  base_rate?: number | null;
  free_above_amount?: number | null;
  min_delivery_days?: number | null;
  max_delivery_days?: number | null;
  max_weight_kg?: number | null;
  is_active?: boolean;
}

// ------------------------------------------------
// Filters (extend BaseFilter)
// ------------------------------------------------

export interface ShippingZoneFilter extends BaseFilter {
  is_active?: boolean;
}

export interface ShippingMethodFilter extends BaseFilter {
  is_active?: boolean;
  rate_type?: ShippingRateType;
}
