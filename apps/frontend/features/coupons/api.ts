"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { storeRequest } from "@/lib/api/store-client";
import { buildQueryString } from "@/lib/utils/api-helpers";
import type {
  ApiErrorEnvelope,
  ApiFieldErrors,
  ApiSuccess,
  Paginated,
} from "@/lib/api/types";
import type {
  Coupon,
  CouponListQuery,
  CouponValidation,
  CreateCouponInput,
  UpdateCouponInput,
  ValidateCouponInput,
} from "./types";

export class CouponApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly fields?: ApiFieldErrors,
  ) {
    super(message);
    this.name = "CouponApiError";
  }
}

export const couponKeys = {
  admin: ["admin", "coupons"] as const,
  lists: () => [...couponKeys.admin, "list"] as const,
  list: (query: CouponListQuery) => [...couponKeys.lists(), query] as const,
  details: () => [...couponKeys.admin, "detail"] as const,
  detail: (id: number) => [...couponKeys.details(), id] as const,
};

async function couponAdminRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(`/api/admin/admin/coupons${path}`, {
    ...init,
    headers: {
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
  });

  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const error = (body as ApiErrorEnvelope | null)?.error;
    throw new CouponApiError(
      response.status,
      error?.code ?? "UNKNOWN",
      error?.message ?? response.statusText,
      error?.fields,
    );
  }

  return ((body as ApiSuccess<T> | null)?.data ?? body) as T;
}

export function listAdminCoupons(
  query: CouponListQuery,
): Promise<Paginated<Coupon>> {
  return couponAdminRequest<Paginated<Coupon>>(buildQueryString(query));
}

export function getAdminCoupon(id: number): Promise<Coupon> {
  return couponAdminRequest<Coupon>(`/${id}`);
}

export function createAdminCoupon(input: CreateCouponInput): Promise<Coupon> {
  return couponAdminRequest<Coupon>("", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateAdminCoupon(
  id: number,
  input: UpdateCouponInput,
): Promise<Coupon> {
  return couponAdminRequest<Coupon>(`/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deactivateAdminCoupon(id: number): Promise<Coupon> {
  return updateAdminCoupon(id, { is_active: false });
}

export function useAdminCoupons(query: CouponListQuery) {
  return useQuery({
    queryKey: couponKeys.list(query),
    queryFn: () => listAdminCoupons(query),
    refetchInterval: 60_000,
  });
}

export function useAdminCoupon(id: number) {
  return useQuery({
    queryKey: couponKeys.detail(id),
    queryFn: () => getAdminCoupon(id),
    enabled: Number.isInteger(id) && id > 0,
  });
}

export function useCreateAdminCoupon() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createAdminCoupon,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: couponKeys.lists() });
    },
  });
}

export function useUpdateAdminCoupon(id: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateCouponInput) => updateAdminCoupon(id, input),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: couponKeys.detail(id) }),
        queryClient.invalidateQueries({ queryKey: couponKeys.lists() }),
      ]);
    },
  });
}

export function useDeactivateAdminCoupon() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deactivateAdminCoupon,
    onSuccess: async (coupon) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: couponKeys.detail(coupon.id),
        }),
        queryClient.invalidateQueries({ queryKey: couponKeys.lists() }),
      ]);
    },
  });
}

export function validateCoupon(
  input: ValidateCouponInput,
): Promise<CouponValidation> {
  return storeRequest<ApiSuccess<CouponValidation>>("coupons/validate", {
    method: "POST",
    body: JSON.stringify(input),
  }).then((body) => body.data);
}

export function useValidateCoupon() {
  return useMutation({ mutationFn: validateCoupon });
}
