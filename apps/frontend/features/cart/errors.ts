import { apiErrorMessage } from "@/lib/api/user-facing-error";

/** Map cart mutation failures to short Persian shopper copy (PH-012d). */
export function cartMutationErrorMessage(error: unknown): string {
  return apiErrorMessage(error, "افزودن به سبد ناموفق بود");
}
