export type SubscriptionCadence = "monthly" | "quarterly";
export type SubscriptionStatus = "active" | "paused" | "cancelled";
export type SubscriptionAction = "pause" | "resume" | "cancel" | "skip";

/** Customer-facing projection returned by all subscription endpoints. */
export interface Subscription {
  id: number;
  plan: string;
  cadence: SubscriptionCadence;
  status: SubscriptionStatus;
  /** The backend omits this field when no delivery address is attached. */
  address_id?: number;
  next_renewal_at: string;
  created_at: string;
}

export interface CreateSubscriptionInput {
  cadence: SubscriptionCadence;
  /** Omission and JSON null both create a subscription without an address. */
  address_id?: number | null;
}

export interface UpdateSubscriptionInput {
  action: SubscriptionAction;
}

/** Route identity is not part of the PATCH request body. */
export type UpdateSubscriptionVariables = UpdateSubscriptionInput & {
  id: number;
};
