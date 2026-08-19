"use client";

import { apiErrorMessage } from "@/lib/api/user-facing-error";

/**
 * Uploads one file into a content owner's media slot and returns the canonical
 * `/media/...` URL the backend attached to it.
 *
 * `POST /admin/uploads/:ownerType/:ownerID/:role` writes the blob and the owner
 * row in one transaction — a `/media/` path can never be set through the normal
 * JSON payload, which is what stops one entity from claiming another's blob. So
 * a media slot has exactly this one way to receive a local file.
 */
export async function uploadOwnerMedia(
  ownerType: string,
  ownerId: number,
  role: string,
  file: File,
): Promise<{ url: string; key: string }> {
  const form = new FormData();
  form.append("file", file);
  const response = await fetch(
    `/api/admin/admin/uploads/${encodeURIComponent(ownerType)}/${ownerId}/${encodeURIComponent(role)}`,
    { method: "POST", body: form, cache: "no-store" },
  );
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(apiErrorMessage(body, "بارگذاری تصویر ناموفق بود"));
  }
  const data = (body as { data?: { url?: string; key?: string } } | null)?.data;
  if (!data?.url) throw new Error("پاسخ بارگذاری تصویر ناقص بود");
  return { url: data.url, key: data.key ?? "" };
}
