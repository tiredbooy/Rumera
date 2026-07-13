import { apiFetch } from "@/lib/api/client";
import type { Brand } from "@/features/catalog/brands/types";

export function getBrand(id: number | string): Promise<Brand> {
  return apiFetch<Brand>(`/brands/${id}`);
}
