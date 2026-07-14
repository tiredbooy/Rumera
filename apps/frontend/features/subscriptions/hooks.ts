"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createSubscription,
  listSubscriptions,
  updateSubscription,
} from "./api";
import { subscriptionKeys } from "./query-keys";

export function useSubscriptions(enabled = true) {
  return useQuery({
    queryKey: subscriptionKeys.all,
    queryFn: listSubscriptions,
    enabled,
  });
}

export function useCreateSubscription() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createSubscription,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: subscriptionKeys.all }),
  });
}

export function useUpdateSubscription() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateSubscription,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: subscriptionKeys.all }),
  });
}
