import type { OrderStatus, PaymentMethod } from "./types";

export const ORDER_STATUS_FA: Record<OrderStatus, string> = {
  pending: "در انتظار پرداخت",
  payment_failed: "پرداخت ناموفق",
  paid: "پرداخت‌شده",
  processing: "در حال پردازش",
  ready_to_ship: "آمادهٔ ارسال",
  shipped: "ارسال‌شده",
  out_for_delivery: "در حال تحویل",
  delivered: "تحویل‌شده",
  refund_requested: "درخواست بازگشت",
  refund_approved: "بازگشت تأییدشده",
  refunded: "بازپرداخت‌شده",
  partially_refunded: "بازپرداخت جزئی",
  cancelled: "لغوشده",
};

export const PAYMENT_FA: Record<PaymentMethod, string> = {
  card: "کارت بانکی",
  crypto: "رمزارز",
  bank_transfer: "انتقال بانکی",
  wallet: "کیف پول",
  gateway: "درگاه پرداخت",
};

export function isCancellable(status: OrderStatus): boolean {
  return status === "pending" || status === "payment_failed";
}
