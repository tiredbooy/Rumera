"use client";

import { buildQueryString } from "@/lib/utils/api-helpers";
import type {
  ApiErrorEnvelope,
  ApiFieldErrors,
  ApiSuccess,
  Paginated,
} from "@/lib/api/types";
import type {
  Brand,
  BrandListQuery,
  CreateBrandInput,
  UpdateBrandInput,
} from "@/features/catalog/brands/types";

export class BrandApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly fields?: ApiFieldErrors,
  ) {
    super(message);
    this.name = "BrandApiError";
  }
}

async function brandRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(`/api/admin/${path}`, {
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
    throw new BrandApiError(
      response.status,
      error?.code ?? "UNKNOWN",
      error?.message ?? response.statusText,
      error?.fields,
    );
  }

  return ((body as ApiSuccess<T> | null)?.data ?? body) as T;
}

export function listBrands(
  query: BrandListQuery = { limit: 100 },
): Promise<Paginated<Brand>> {
  return brandRequest<Paginated<Brand>>(`brands${buildQueryString(query)}`);
}

export function createBrand(input: CreateBrandInput): Promise<Brand> {
  return brandRequest<Brand>("admin/brands", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateBrand(
  id: number,
  input: UpdateBrandInput,
): Promise<Brand> {
  return brandRequest<Brand>(`admin/brands/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deleteBrand(id: number): Promise<void> {
  return brandRequest<void>(`admin/brands/${id}`, { method: "DELETE" });
}
