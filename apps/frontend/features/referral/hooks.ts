"use client";

import { useMutation, useQuery } from "@tanstack/react-query";

import { claimReferral, getReferral } from "./api";
import { referralKeys } from "./query-keys";

export function useReferral(enabled = true) {
  return useQuery({
    queryKey: referralKeys.account,
    queryFn: getReferral,
    enabled,
  });
}

export function useClaimReferral() {
  return useMutation({ mutationFn: claimReferral });
}
