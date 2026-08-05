import "server-only";

import { apiFetch } from "@/lib/api/client";
import type {
  ProductOptionType,
  ProductOptionValueDefinition,
} from "@/features/admin/products/types";

export function getOptionType(id: number): Promise<ProductOptionType> {
  return apiFetch<ProductOptionType>(`/admin/option-types/${id}`);
}

export function listOptionValues(
  typeId: number,
): Promise<ProductOptionValueDefinition[]> {
  return apiFetch<ProductOptionValueDefinition[]>(
    `/admin/option-types/${typeId}/values`,
  );
}
