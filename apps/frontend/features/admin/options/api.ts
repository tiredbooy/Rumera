"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type {
  ApiErrorEnvelope,
  ApiFieldErrors,
  ApiSuccess,
} from "@/lib/api/types";
import type {
  ProductOptionGroup,
  ProductOptionType,
  ProductOptionValueDefinition,
} from "@/features/admin/products/types";

export class OptionApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly fields?: ApiFieldErrors,
  ) {
    super(message);
    this.name = "OptionApiError";
  }
}

export const optionKeys = {
  root: ["admin", "options"] as const,
  types: () => [...optionKeys.root, "types"] as const,
  type: (id: number) => [...optionKeys.root, "type", id] as const,
  values: (typeId: number) => [...optionKeys.root, "values", typeId] as const,
  catalog: () => [...optionKeys.root, "catalog"] as const,
};

async function optionRequest<T>(
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
    throw new OptionApiError(
      response.status,
      error?.code ?? "UNKNOWN",
      error?.message ?? response.statusText,
      error?.fields,
    );
  }

  return ((body as ApiSuccess<T> | null)?.data ?? body) as T;
}

export type CreateOptionTypeInput = {
  title: string;
  display_name: string;
};

export type UpdateOptionTypeInput = {
  title?: string;
  display_name?: string;
};

export type CreateOptionValueInput = {
  value: string;
  sort_order?: number;
};

export type UpdateOptionValueInput = {
  value?: string;
  sort_order?: number;
};

export function listOptionTypes(): Promise<ProductOptionType[]> {
  return optionRequest<ProductOptionType[]>("admin/option-types");
}

export function getOptionType(id: number): Promise<ProductOptionType> {
  return optionRequest<ProductOptionType>(`admin/option-types/${id}`);
}

export function createOptionType(
  input: CreateOptionTypeInput,
): Promise<ProductOptionType> {
  return optionRequest<ProductOptionType>("admin/option-types", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateOptionType(
  id: number,
  input: UpdateOptionTypeInput,
): Promise<ProductOptionType> {
  return optionRequest<ProductOptionType>(`admin/option-types/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deleteOptionType(id: number): Promise<void> {
  return optionRequest<void>(`admin/option-types/${id}`, { method: "DELETE" });
}

export function listOptionValues(
  typeId: number,
): Promise<ProductOptionValueDefinition[]> {
  return optionRequest<ProductOptionValueDefinition[]>(
    `admin/option-types/${typeId}/values`,
  );
}

export function createOptionValue(
  typeId: number,
  input: CreateOptionValueInput,
): Promise<ProductOptionValueDefinition> {
  return optionRequest<ProductOptionValueDefinition>(
    `admin/option-types/${typeId}/values`,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
}

export function updateOptionValue(
  valueId: number,
  input: UpdateOptionValueInput,
): Promise<ProductOptionValueDefinition> {
  return optionRequest<ProductOptionValueDefinition>(
    `admin/option-values/${valueId}`,
    {
      method: "PATCH",
      body: JSON.stringify(input),
    },
  );
}

export function deleteOptionValue(valueId: number): Promise<void> {
  return optionRequest<void>(`admin/option-values/${valueId}`, {
    method: "DELETE",
  });
}

export async function getOptionCatalog(): Promise<ProductOptionGroup[]> {
  const types = await listOptionTypes();
  const values = await Promise.all(types.map((t) => listOptionValues(t.id)));
  return types.map((type, i) => ({
    ...type,
    values: values[i] ?? [],
  }));
}

export function useOptionCatalog() {
  return useQuery({
    queryKey: optionKeys.catalog(),
    queryFn: getOptionCatalog,
  });
}

export function useOptionTypeDetail(id: number) {
  return useQuery({
    queryKey: optionKeys.type(id),
    queryFn: async () => {
      const [type, values] = await Promise.all([
        getOptionType(id),
        listOptionValues(id),
      ]);
      return { ...type, values } satisfies ProductOptionGroup;
    },
    enabled: id > 0,
  });
}

function invalidateOptions(qc: ReturnType<typeof useQueryClient>) {
  return qc.invalidateQueries({ queryKey: optionKeys.root });
}

export function useCreateOptionType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createOptionType,
    onSuccess: () => invalidateOptions(qc),
  });
}

export function useUpdateOptionType(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateOptionTypeInput) => updateOptionType(id, input),
    onSuccess: () => invalidateOptions(qc),
  });
}

export function useDeleteOptionType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteOptionType,
    onSuccess: () => invalidateOptions(qc),
  });
}

export function useCreateOptionValue(typeId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateOptionValueInput) =>
      createOptionValue(typeId, input),
    onSuccess: () => invalidateOptions(qc),
  });
}

export function useUpdateOptionValue(typeId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      valueId,
      input,
    }: {
      valueId: number;
      input: UpdateOptionValueInput;
    }) => updateOptionValue(valueId, input),
    onSuccess: () => invalidateOptions(qc),
  });
}

export function useDeleteOptionValue(typeId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteOptionValue,
    onSuccess: () => invalidateOptions(qc),
  });
}
