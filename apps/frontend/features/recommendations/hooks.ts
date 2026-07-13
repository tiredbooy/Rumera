"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  getForYouClient,
  getRecommendationProfileClient,
  recomputeRecommendationProfileClient,
  recordInteractionClient,
} from "./client";
import { recommendationKeys } from "./query-keys";
import type { RecommendationQuery } from "./types";

export function useForYou(
  enabled = true,
  query: RecommendationQuery = {},
) {
  return useQuery({
    queryKey: recommendationKeys.forYou(query),
    queryFn: () => getForYouClient(query),
    enabled,
  });
}

export function useRecordInteraction() {
  return useMutation({ mutationFn: recordInteractionClient });
}

export function useRecommendationProfile(enabled = true) {
  return useQuery({
    queryKey: recommendationKeys.profile,
    queryFn: getRecommendationProfileClient,
    enabled,
    retry: false,
  });
}

export function useRecomputeRecommendationProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: recomputeRecommendationProfileClient,
    onSuccess: (profile) => {
      queryClient.setQueryData(recommendationKeys.profile, profile);
      queryClient.invalidateQueries({ queryKey: recommendationKeys.forYouAll });
    },
  });
}
