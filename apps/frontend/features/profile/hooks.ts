"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getProfile, updateProfile } from "./api";

export const profileKey = ["auth", "me"] as const;

export function useProfile(enabled = true) {
  return useQuery({ queryKey: profileKey, queryFn: getProfile, enabled });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateProfile,
    onSuccess: (profile) => queryClient.setQueryData(profileKey, profile),
  });
}
