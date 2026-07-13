import { storeRequest } from "@/lib/api/store-client"
import type { ApiSuccess } from "@/lib/api/types"

import type { TasteProfile, UpdateTasteProfileInput } from "./types"

export function getTasteProfile(): Promise<TasteProfile> {
  return storeRequest<ApiSuccess<TasteProfile>>("me/taste-profile").then(
    (body) => body.data,
  )
}

export function updateTasteProfile(
  input: UpdateTasteProfileInput,
): Promise<TasteProfile> {
  return storeRequest<ApiSuccess<TasteProfile>>("me/taste-profile", {
    method: "PUT",
    body: JSON.stringify(input),
  }).then((body) => body.data)
}
