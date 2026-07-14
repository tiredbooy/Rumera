"use client";

import { useQuery } from "@tanstack/react-query";
import { buildQuery } from "@/lib/api/qs";
import { storeRequest } from "@/lib/api/store-client";
import type { ApiSuccess } from "@/lib/api/types";
import type {
  AvailableShippingMethodsQuery,
  ShippingMethod,
} from "./types";

export function getAvailableShippingMethods(
  query: AvailableShippingMethodsQuery,
): Promise<ShippingMethod[]> {
  return storeRequest<ApiSuccess<ShippingMethod[]>>(
    `shipping/available${buildQuery({
      region: query.region,
      weight: query.weight,
    })}`,
  ).then((body) => body.data);
}

export function useShippingMethods(
  region: string,
  weight: number,
  enabled = true,
) {
  return useQuery({
    queryKey: ["shipping", region, weight],
    queryFn: () => getAvailableShippingMethods({ region, weight }),
    enabled: enabled && !!region,
  });
}
