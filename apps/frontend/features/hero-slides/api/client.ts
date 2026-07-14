"use client"

import type {
  ApiErrorEnvelope,
  ApiFieldErrors,
  ApiSuccess,
} from "@/lib/api/types"

import type {
  AdminHeroSlide,
  CreateHeroSlideInput,
  UpdateHeroSlideInput,
} from "../types"

export class HeroSlideApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly fields?: ApiFieldErrors
  ) {
    super(message)
    this.name = "HeroSlideApiError"
  }
}

async function heroSlideRequest<T>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const response = await fetch(`/api/admin/${path}`, {
    ...init,
    headers: {
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
  })

  if (response.status === 204) return undefined as T

  const body: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    const error = (body as ApiErrorEnvelope | null)?.error
    throw new HeroSlideApiError(
      response.status,
      error?.code ?? "UNKNOWN",
      error?.message ?? response.statusText,
      error?.fields
    )
  }

  return ((body as ApiSuccess<T> | null)?.data ?? body) as T
}

/** Returns all slides in backend display order, including inactive rows. */
export function listAdminHeroSlides(): Promise<AdminHeroSlide[]> {
  return heroSlideRequest<AdminHeroSlide[]>("admin/hero-slides")
}

export function createHeroSlide(
  input: CreateHeroSlideInput
): Promise<AdminHeroSlide> {
  return heroSlideRequest<AdminHeroSlide>("admin/hero-slides", {
    method: "POST",
    body: JSON.stringify(input),
  })
}

export function updateHeroSlide(
  id: number,
  input: UpdateHeroSlideInput
): Promise<AdminHeroSlide> {
  return heroSlideRequest<AdminHeroSlide>(`admin/hero-slides/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  })
}

export function deleteHeroSlide(id: number): Promise<void> {
  return heroSlideRequest<void>(`admin/hero-slides/${id}`, {
    method: "DELETE",
  })
}
