// features/orders/types.ts

export type OrderStatus =
  | "pending"
  | "payment_failed"
  | "paid"
  | "processing"
  | "ready_to_ship"
  | "shipped"
  | "out_for_delivery"
  | "delivered"
  | "refund_requested"
  | "refund_approved"
  | "refunded"
  | "partially_refunded"
  | "cancelled";

export type PaymentMethod =
  | "card"
  | "crypto"
  | "bank_transfer"
  | "wallet"
  | "gateway";

export interface OrderItem {
  id: number;
  productId: number;
  variantId: number;
  productTitle: string;
  imageUrl?: string | null;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface Order {
  id: number;

  status: OrderStatus;
  paymentMethod: PaymentMethod;

  subtotal: number;
  discountAmount: number;
  shippingCost: number;
  taxAmount: number;
  totalAmount: number;

  notes?: string | null;

  isGift: boolean;
  giftMessage?: string | null;
  giftWrap: boolean;
  hidePrice: boolean;
  scheduledDeliveryDate?: string | null;

  paidAt?: string | null;
  shippedAt?: string | null;
  deliveredAt?: string | null;
  cancelledAt?: string | null;

  createdAt: string;

  items: OrderItem[];
}

export interface OrderListItem {
  id: number;

  status: OrderStatus;
  paymentMethod: PaymentMethod;

  totalAmount: number;
  itemCount: number;

  createdAt: string;
}

export interface CreateOrderRequest {
  addressId: number;
  paymentMethod: PaymentMethod;
  shippingMethodId: number;

  couponCode?: string;

  notes?: string;

  isGift?: boolean;
  giftMessage?: string;
  giftWrap?: boolean;
  hidePrice?: boolean;

  scheduledDeliveryDate?: string;
}

export interface UpdateOrderStatusRequest {
  status: OrderStatus;
}

export interface OrderFilter {
  page?: number;
  limit?: number;
  sort?: string;
  order?: "asc" | "desc";

  userId?: number;
  status?: OrderStatus;

  paidFrom?: string;
  paidTo?: string;
}
