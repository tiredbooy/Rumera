// features/admin/brands/api.ts
import { apiFetch } from "@/lib/api/client";
import type {
  BrandResponse as Brand,
  CreateBrandReq,
  UpdateBrandReq,
} from "./types";

export function createBrand(payload: CreateBrandReq): Promise<Brand> {
  return apiFetch<Brand>("/admin/brands", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateBrand(
  id: number,
  payload: UpdateBrandReq,
): Promise<Brand> {
  return apiFetch<Brand>(`/admin/brands/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function deleteBrand(id: number): Promise<void> {
  return apiFetch<void>(`/admin/brands/${id}`, {
    method: "DELETE",
  });
}
