"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type {
  ApiErrorEnvelope,
  ApiFieldErrors,
  ApiSuccess,
  Paginated,
} from "@/lib/api/types";
import { buildQueryString } from "@/lib/utils/api-helpers";

import type {
  AvailableShippingMethodsQuery,
  CreateShippingMethodInput,
  CreateShippingZoneInput,
  ShippingMethod,
  ShippingMethodListQuery,
  ShippingZone,
  ShippingZoneListQuery,
  UpdateShippingMethodInput,
  UpdateShippingZoneInput,
} from "./types";

export class ShippingApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly fields?: ApiFieldErrors,
  ) {
    super(message);
    this.name = "ShippingApiError";
  }
}

export const shippingKeys = {
  all: ["shipping"] as const,
  availableRoot: () => [...shippingKeys.all, "available"] as const,
  available: (query: AvailableShippingMethodsQuery) =>
    [...shippingKeys.availableRoot(), query] as const,
  zones: () => [...shippingKeys.all, "zones"] as const,
  zoneLists: () => [...shippingKeys.zones(), "list"] as const,
  zoneList: (query: ShippingZoneListQuery) =>
    [...shippingKeys.zoneLists(), query] as const,
  zoneDetails: () => [...shippingKeys.zones(), "detail"] as const,
  zoneDetail: (id: number) => [...shippingKeys.zoneDetails(), id] as const,
  zoneMethods: (zoneID: number) =>
    [...shippingKeys.zones(), zoneID, "methods"] as const,
  zoneMethodList: (zoneID: number, query: ShippingMethodListQuery) =>
    [...shippingKeys.zoneMethods(zoneID), query] as const,
  methods: () => [...shippingKeys.all, "methods"] as const,
  methodDetails: () => [...shippingKeys.methods(), "detail"] as const,
  methodDetail: (id: number) => [...shippingKeys.methodDetails(), id] as const,
};

async function shippingRequest<T>(
  path: string,
  init: RequestInit = {},
  admin = false,
): Promise<T> {
  const prefix = admin ? "/api/admin/admin/shipping" : "/api/store/shipping";
  const response = await fetch(`${prefix}${path}`, {
    ...init,
    headers: {
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
  });

  if (response.status === 204) return undefined as T;

  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const error = (body as ApiErrorEnvelope | null)?.error;
    throw new ShippingApiError(
      response.status,
      error?.code ?? "UNKNOWN",
      error?.message ?? response.statusText,
      error?.fields,
    );
  }

  return ((body as ApiSuccess<T> | null)?.data ?? body) as T;
}

export function listShippingZones(
  query: ShippingZoneListQuery,
): Promise<Paginated<ShippingZone>> {
  return shippingRequest<Paginated<ShippingZone>>(
    `/zones${buildQueryString(query)}`,
  );
}

export function getShippingZone(id: number): Promise<ShippingZone> {
  return shippingRequest<ShippingZone>(`/zones/${id}`);
}

export function listShippingMethods(
  zoneID: number,
  query: ShippingMethodListQuery,
): Promise<Paginated<ShippingMethod>> {
  return shippingRequest<Paginated<ShippingMethod>>(
    `/zones/${zoneID}/methods${buildQueryString(query)}`,
  );
}

export function getShippingMethod(id: number): Promise<ShippingMethod> {
  return shippingRequest<ShippingMethod>(`/methods/${id}`);
}

export function getAvailableShippingMethods(
  query: AvailableShippingMethodsQuery,
): Promise<ShippingMethod[]> {
  return shippingRequest<ShippingMethod[]>(
    `/available${buildQueryString(query)}`,
  );
}

export function createAdminShippingZone(
  input: CreateShippingZoneInput,
): Promise<ShippingZone> {
  return shippingRequest<ShippingZone>(
    "/zones",
    { method: "POST", body: JSON.stringify(input) },
    true,
  );
}

export function updateAdminShippingZone(
  id: number,
  input: UpdateShippingZoneInput,
): Promise<ShippingZone> {
  return shippingRequest<ShippingZone>(
    `/zones/${id}`,
    { method: "PATCH", body: JSON.stringify(input) },
    true,
  );
}

export function deleteAdminShippingZone(id: number): Promise<void> {
  return shippingRequest<void>(`/zones/${id}`, { method: "DELETE" }, true);
}

export function createAdminShippingMethod(
  zoneID: number,
  input: CreateShippingMethodInput,
): Promise<ShippingMethod> {
  return shippingRequest<ShippingMethod>(
    `/zones/${zoneID}/methods`,
    { method: "POST", body: JSON.stringify(input) },
    true,
  );
}

export function updateAdminShippingMethod(
  id: number,
  input: UpdateShippingMethodInput,
): Promise<ShippingMethod> {
  return shippingRequest<ShippingMethod>(
    `/methods/${id}`,
    { method: "PATCH", body: JSON.stringify(input) },
    true,
  );
}

export function deleteAdminShippingMethod(id: number): Promise<void> {
  return shippingRequest<void>(`/methods/${id}`, { method: "DELETE" }, true);
}

export function useShippingMethods(
  region: string,
  weight: number,
  subtotal = 0,
  enabled = true,
) {
  const query = { region, weight, subtotal };
  return useQuery({
    queryKey: shippingKeys.available(query),
    queryFn: () => getAvailableShippingMethods(query),
    enabled: enabled && region.trim().length > 0,
  });
}

export function useAdminShippingZones(query: ShippingZoneListQuery) {
  return useQuery({
    queryKey: shippingKeys.zoneList(query),
    queryFn: () => listShippingZones(query),
    refetchInterval: 60_000,
  });
}

export function useAdminShippingZone(id: number) {
  return useQuery({
    queryKey: shippingKeys.zoneDetail(id),
    queryFn: () => getShippingZone(id),
    enabled: Number.isSafeInteger(id) && id > 0,
  });
}

export function useAdminShippingMethods(
  zoneID: number,
  query: ShippingMethodListQuery,
) {
  return useQuery({
    queryKey: shippingKeys.zoneMethodList(zoneID, query),
    queryFn: () => listShippingMethods(zoneID, query),
    enabled: Number.isSafeInteger(zoneID) && zoneID > 0,
    refetchInterval: 60_000,
  });
}

export function useAdminShippingMethod(id: number) {
  return useQuery({
    queryKey: shippingKeys.methodDetail(id),
    queryFn: () => getShippingMethod(id),
    enabled: Number.isSafeInteger(id) && id > 0,
  });
}

export function useCreateAdminShippingZone() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createAdminShippingZone,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: shippingKeys.zoneLists() }),
        queryClient.invalidateQueries({
          queryKey: shippingKeys.availableRoot(),
        }),
      ]);
    },
  });
}

export function useUpdateAdminShippingZone() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: number;
      input: UpdateShippingZoneInput;
    }) => updateAdminShippingZone(id, input),
    onSuccess: async (zone) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: shippingKeys.zoneDetail(zone.id),
        }),
        queryClient.invalidateQueries({ queryKey: shippingKeys.zoneLists() }),
        queryClient.invalidateQueries({
          queryKey: shippingKeys.availableRoot(),
        }),
      ]);
    },
  });
}

export function useDeleteAdminShippingZone() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteAdminShippingZone,
    onSuccess: async (_, id) => {
      queryClient.removeQueries({
        queryKey: shippingKeys.zoneDetail(id),
        exact: true,
      });
      queryClient.removeQueries({ queryKey: shippingKeys.zoneMethods(id) });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: shippingKeys.zoneLists() }),
        queryClient.invalidateQueries({
          queryKey: shippingKeys.methodDetails(),
        }),
        queryClient.invalidateQueries({
          queryKey: shippingKeys.availableRoot(),
        }),
      ]);
    },
  });
}

export function useCreateAdminShippingMethod(zoneID: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateShippingMethodInput) =>
      createAdminShippingMethod(zoneID, input),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: shippingKeys.zoneMethods(zoneID),
        }),
        queryClient.invalidateQueries({
          queryKey: shippingKeys.zoneDetail(zoneID),
        }),
        queryClient.invalidateQueries({
          queryKey: shippingKeys.availableRoot(),
        }),
      ]);
    },
  });
}

export function useUpdateAdminShippingMethod(zoneID: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: number;
      input: UpdateShippingMethodInput;
    }) => updateAdminShippingMethod(id, input),
    onSuccess: async (method) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: shippingKeys.methodDetail(method.id),
        }),
        queryClient.invalidateQueries({
          queryKey: shippingKeys.zoneMethods(zoneID),
        }),
        queryClient.invalidateQueries({
          queryKey: shippingKeys.zoneDetail(zoneID),
        }),
        queryClient.invalidateQueries({
          queryKey: shippingKeys.availableRoot(),
        }),
      ]);
    },
  });
}

export function useDeleteAdminShippingMethod(zoneID: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteAdminShippingMethod,
    onSuccess: async (_, id) => {
      queryClient.removeQueries({
        queryKey: shippingKeys.methodDetail(id),
        exact: true,
      });
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: shippingKeys.zoneMethods(zoneID),
        }),
        queryClient.invalidateQueries({
          queryKey: shippingKeys.zoneDetail(zoneID),
        }),
        queryClient.invalidateQueries({
          queryKey: shippingKeys.availableRoot(),
        }),
      ]);
    },
  });
}
