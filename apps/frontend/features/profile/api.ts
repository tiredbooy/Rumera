"use client";

import { storeRequest } from "@/lib/api/store-client";
import type { ApiSuccess } from "@/lib/api/types";
import type { UpdateProfileInput, UserProfile } from "./types";

export function getProfile(): Promise<UserProfile> {
  return storeRequest<ApiSuccess<UserProfile>>("auth/me").then(
    (body) => body.data,
  );
}

export function updateProfile(
  input: UpdateProfileInput,
): Promise<UserProfile> {
  return storeRequest<ApiSuccess<UserProfile>>("auth/me", {
    method: "PATCH",
    body: JSON.stringify(input),
  }).then((body) => body.data);
}
