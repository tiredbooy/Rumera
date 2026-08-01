import "server-only";

import { apiFetch } from "@/lib/api/client";
import type { Paginated } from "@/lib/api/types";
import { buildQueryString } from "@/lib/utils/api-helpers";

import type { ShippingZone, ShippingZoneListQuery } from "../types";

export function listShippingZones(
  query: ShippingZoneListQuery = {},
): Promise<Paginated<ShippingZone>> {
  return apiFetch<Paginated<ShippingZone>>(
    `/shipping/zones${buildQueryString(query)}`,
  );
}
