import { storeRequest } from "@/lib/api/store-client";
import type { ApiSuccess } from "@/lib/api/types";

import type { ClaimReferralInput, Referral } from "./types";

export function getReferral(): Promise<Referral> {
  return storeRequest<ApiSuccess<Referral>>("referrals/me").then(
    (body) => body.data,
  );
}

export function claimReferral(input: ClaimReferralInput): Promise<void> {
  return storeRequest<void>("referrals/claim", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
