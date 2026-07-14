import { storeRequest } from "@/lib/api/store-client";
import type { ApiSuccess } from "@/lib/api/types";

import type {
  CreateSubscriptionInput,
  Subscription,
  UpdateSubscriptionVariables,
} from "./types";

/** GET /subscriptions has no query-string contract. */
export function listSubscriptions(): Promise<Subscription[]> {
  return storeRequest<ApiSuccess<Subscription[]>>("subscriptions").then(
    (body) => body.data,
  );
}

export function createSubscription(
  input: CreateSubscriptionInput,
): Promise<Subscription> {
  return storeRequest<ApiSuccess<Subscription>>("subscriptions", {
    method: "POST",
    body: JSON.stringify(input),
  }).then((body) => body.data);
}

export function updateSubscription({
  id,
  ...input
}: UpdateSubscriptionVariables): Promise<Subscription> {
  return storeRequest<ApiSuccess<Subscription>>(`subscriptions/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  }).then((body) => body.data);
}
