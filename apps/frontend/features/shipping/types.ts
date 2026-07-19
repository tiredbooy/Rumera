import type { PaginationQuery } from "@/lib/api/types";

export type ShippingRateType = "flat_rate" | "per_kg" | "percentage" | "free";

export interface ShippingMethod {
  id: number;
  shipping_zone_id?: number;
  name: string;
  carrier?: string;
  description?: string;
  rate_type: ShippingRateType;
  base_rate: number;
  free_above_amount?: number;
  min_delivery_days?: number;
  max_delivery_days?: number;
  max_weight_kg?: number;
  is_active: boolean;
  estimated_cost: number;
}

export interface ShippingZone {
  id: number;
  name: string;
  description?: string;
  region_codes: string[];
  is_active: boolean;
  methods?: ShippingMethod[];
}

export interface CreateShippingZoneInput {
  name: string;
  description?: string | null;
  region_codes: string[];
  is_active?: boolean | null;
}

export interface UpdateShippingZoneInput {
  name?: string;
  description?: string | null;
  region_codes?: string[];
  is_active?: boolean;
}

export interface CreateShippingMethodInput {
  name: string;
  carrier?: string | null;
  description?: string | null;
  rate_type: ShippingRateType;
  base_rate?: number;
  free_above_amount?: number | null;
  min_delivery_days?: number | null;
  max_delivery_days?: number | null;
  max_weight_kg?: number | null;
  is_active?: boolean | null;
}

export interface UpdateShippingMethodInput {
  name?: string;
  carrier?: string | null;
  description?: string | null;
  rate_type?: ShippingRateType;
  base_rate?: number;
  free_above_amount?: number | null;
  min_delivery_days?: number | null;
  max_delivery_days?: number | null;
  max_weight_kg?: number | null;
  is_active?: boolean;
}

export type ShippingSortDirection = "asc" | "desc";
export type ShippingZoneSortField = "created_at" | "name";
export type ShippingMethodSortField = "created_at" | "name" | "base_rate";

export interface ShippingZoneListQuery extends PaginationQuery {
  sortBy?: ShippingZoneSortField;
  orderBy?: ShippingSortDirection;
  search?: string;
  is_active?: boolean;
}

export interface ShippingMethodListQuery extends PaginationQuery {
  sortBy?: ShippingMethodSortField;
  orderBy?: ShippingSortDirection;
  search?: string;
  is_active?: boolean;
  rate_type?: ShippingRateType;
}

export interface AvailableShippingMethodsQuery {
  region: string;
  weight?: number;
  subtotal?: number;
}
