import type { PaymentMethod } from "@/features/orders/types";
import type { PaginationQuery } from "@/lib/api/types";

export type PaymentStatus =
  | "pending"
  | "succeeded"
  | "failed"
  | "refunded"
  | "partially_refunded";

/** Customer-safe payment transaction projection. */
export interface PaymentTransaction {
  id: number;
  order_id?: number;
  amount: string;
  currency: string;
  status: PaymentStatus;
  payment_method: PaymentMethod;
  transaction_id: string;
  error_message?: string;
  paid_at?: string;
  created_at: string;
}

/** Admin projection returned by all `/admin/payments` endpoints. */
export interface AdminPaymentTransaction extends PaymentTransaction {
  /** Public `users.user_id` (UUID), same as `/admin/customers/:id`. */
  user_id?: string;
  /** Base64-encoded gateway response bytes. */
  raw_response?: string;
}

/** Query accepted by GET /admin/payments. */
export interface PaymentTransactionListQuery extends PaginationQuery {
  sortBy?: "created_at" | "amount" | "paid_at";
  orderBy?: "asc" | "desc";
  user_id?: number;
  order_id?: number;
  status?: PaymentStatus;
}
