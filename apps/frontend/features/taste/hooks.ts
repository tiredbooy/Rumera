"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { getTasteProfile, updateTasteProfile } from "./api"
import { tasteProfileKeys } from "./query-keys"

export function useTasteProfile(enabled = true) {
  return useQuery({
    queryKey: tasteProfileKeys.profile,
    queryFn: getTasteProfile,
    enabled,
  })
}

export function useUpdateTasteProfile() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: updateTasteProfile,
    onSuccess: (profile) =>
      queryClient.setQueryData(tasteProfileKeys.profile, profile),
  })
}
