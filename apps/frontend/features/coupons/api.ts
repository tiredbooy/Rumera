"use client";

import { useMutation } from "@tanstack/react-query";
import { storeRequest } from "@/lib/api/store-client";
import type { ApiSuccess } from "@/lib/api/types";
import type { CouponValidation, ValidateCouponInput } from "./types";

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
