"use client";

import { buildQuery } from "@/lib/api/qs";
import type {
  ApiErrorEnvelope,
  ApiFieldErrors,
  ApiSuccess,
  Paginated,
} from "@/lib/api/types";

import type {
  AdminRecipeDetail,
  AdminRecipeListItem,
  AdminRecipeListQuery,
  CreateRecipeInput,
  UpdateRecipeInput,
} from "../types";

export class RecipeApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly fields?: ApiFieldErrors,
  ) {
    super(message);
    this.name = "RecipeApiError";
  }
}

async function recipeRequest<T>(
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
    throw new RecipeApiError(
      response.status,
      error?.code ?? "UNKNOWN",
      error?.message ?? response.statusText,
      error?.fields,
    );
  }

  return ((body as ApiSuccess<T> | null)?.data ?? body) as T;
}

export function listAdminRecipes(
  query: AdminRecipeListQuery = {},
): Promise<Paginated<AdminRecipeListItem>> {
  return recipeRequest<Paginated<AdminRecipeListItem>>(
    `admin/recipes${buildQuery({ ...query })}`,
  );
}

export function createRecipe(
  input: CreateRecipeInput,
): Promise<AdminRecipeDetail> {
  return recipeRequest<AdminRecipeDetail>("admin/recipes", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateRecipe(
  id: number,
  input: UpdateRecipeInput,
): Promise<AdminRecipeDetail> {
  return recipeRequest<AdminRecipeDetail>(`admin/recipes/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deleteRecipe(id: number): Promise<void> {
  return recipeRequest<void>(`admin/recipes/${id}`, { method: "DELETE" });
}
