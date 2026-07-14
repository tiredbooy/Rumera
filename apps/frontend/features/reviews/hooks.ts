"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createReviewAction,
  deleteReviewAction,
  moderateReviewAction,
  reactToReviewAction,
  updateReviewAction,
  type ReviewActionResult,
} from "./actions";
import {
  listAdminReviewsClient,
  listMyReviewsClient,
  listPendingReviewsClient,
} from "./client";
import { reviewKeys } from "./query-keys";
import type {
  CreateReviewInput,
  ModerateReviewInput,
  ReviewReactionInput,
  ReviewListQuery,
  UpdateReviewInput,
} from "./types";

export class ReviewMutationError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = "ReviewMutationError";
  }
}

function unwrap<T>(result: ReviewActionResult<T>): T {
  if (!result.ok) throw new ReviewMutationError(result.status, result.message);
  return result.data as T;
}

export function useMyReviews(enabled = true) {
  return useQuery({
    queryKey: reviewKeys.mine,
    queryFn: listMyReviewsClient,
    enabled,
  });
}

export function usePendingReviews(enabled = true) {
  return useQuery({
    queryKey: reviewKeys.pending,
    queryFn: listPendingReviewsClient,
    enabled,
  });
}

export function useAdminReviews(query: ReviewListQuery = {}) {
  return useQuery({
    queryKey: reviewKeys.admin(query),
    queryFn: () => listAdminReviewsClient(query),
  });
}

export function useCreateReview(productId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateReviewInput) =>
      createReviewAction(input).then(unwrap),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: reviewKeys.mine });
      queryClient.invalidateQueries({ queryKey: reviewKeys.pending });
    },
    mutationKey: ["reviews", "create", productId],
  });
}

export function useUpdateReview(id: number, productId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateReviewInput) =>
      updateReviewAction(id, productId, input).then(unwrap),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: reviewKeys.mine }),
  });
}

export function useDeleteReview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, productId }: { id: number; productId: number }) =>
      deleteReviewAction(id, productId).then(unwrap),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: reviewKeys.mine });
      queryClient.invalidateQueries({ queryKey: reviewKeys.pending });
    },
  });
}

export function useReactToReview(productId: number) {
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: ReviewReactionInput }) =>
      reactToReviewAction(id, productId, input).then(unwrap),
  });
}

export function useModerateReview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      productId,
      input,
    }: {
      id: number;
      productId: number;
      input: ModerateReviewInput;
    }) => moderateReviewAction(id, productId, input).then(unwrap),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: reviewKeys.all }),
  });
}
