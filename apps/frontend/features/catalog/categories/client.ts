import type { ApiSuccess } from "@/lib/api/types";

import type { CategoryTree } from "./types";

export async function fetchCategoryTree(): Promise<CategoryTree[]> {
  const response = await fetch("/api/public/categories/tree", {
    headers: { Accept: "application/json" },
  });
  const body = (await response.json()) as ApiSuccess<CategoryTree[]>;

  if (!response.ok) {
    throw new Error("دریافت دسته‌بندی‌ها ناموفق بود");
  }

  return body.data;
}
