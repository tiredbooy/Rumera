"use client";

import type {
  ApiErrorEnvelope,
  ApiFieldErrors,
  ApiSuccess,
} from "@/lib/api/types";

import type { SiteSettings, UpdateSiteSettingsInput } from "../types";

export class SettingsApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly fields?: ApiFieldErrors,
  ) {
    super(message);
    this.name = "SettingsApiError";
  }
}

async function settingsRequest<T>(
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

  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const error = (body as ApiErrorEnvelope | null)?.error;
    throw new SettingsApiError(
      response.status,
      error?.code ?? "UNKNOWN",
      error?.message ?? response.statusText,
      error?.fields,
    );
  }

  return ((body as ApiSuccess<T> | null)?.data ?? body) as T;
}

export function updateSiteSettings(
  input: UpdateSiteSettingsInput,
): Promise<SiteSettings> {
  return settingsRequest<SiteSettings>("admin/settings", {
    method: "PUT",
    body: JSON.stringify(input),
  });
}
