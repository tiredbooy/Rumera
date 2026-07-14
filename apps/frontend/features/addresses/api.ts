"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/api/query-keys";
import { storeRequest } from "@/lib/api/store-client";
import type { ApiSuccess } from "@/lib/api/types";
import type {
  Address,
  CreateAddressInput,
  UpdateAddressInput,
} from "./types";

export function listAddresses(): Promise<Address[]> {
  return storeRequest<ApiSuccess<Address[]>>("addresses").then(
    (body) => body.data,
  );
}

export function createAddress(input: CreateAddressInput): Promise<Address> {
  return storeRequest<ApiSuccess<Address>>("addresses", {
    method: "POST",
    body: JSON.stringify(input),
  }).then((body) => body.data);
}

export function updateAddress(
  id: number,
  input: UpdateAddressInput,
): Promise<Address> {
  return storeRequest<ApiSuccess<Address>>(`addresses/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  }).then((body) => body.data);
}

export function deleteAddress(id: number): Promise<void> {
  return storeRequest<void>(`addresses/${id}`, { method: "DELETE" });
}

export function setDefaultAddress(id: number): Promise<void> {
  return storeRequest<void>(`addresses/${id}/default`, { method: "POST" });
}

export function useAddresses(enabled = true) {
  return useQuery({
    queryKey: queryKeys.addresses,
    queryFn: listAddresses,
    enabled,
  });
}

export function useCreateAddress() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createAddress,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.addresses }),
  });
}

export function useUpdateAddress() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: UpdateAddressInput }) =>
      updateAddress(id, input),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.addresses }),
  });
}

export function useDeleteAddress() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteAddress,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.addresses }),
  });
}

export function useSetDefaultAddress() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: setDefaultAddress,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.addresses }),
  });
}
