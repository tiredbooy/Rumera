import type { ReactNode } from "react";
import { Check, Gift, MapPin, Truck, Wallet } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { Address } from "@/features/addresses/types";
import type { CartItem } from "@/features/cart/types";
import type { PaymentMethod } from "@/features/orders/types";
import type { ShippingMethod } from "@/features/shipping/types";
import { faNum, formatPrice } from "@/lib/products";
import { CheckoutSection, shippingDays } from "./checkout-step-presentation";

const PAYMENT_LABEL: Record<string, string> = {
  wallet: "کیف پول رومرا",
  bank_transfer: "کارت به کارت / انتقال بانکی",
};

export function CheckoutReviewStep({
  selectedAddress,
  selectedShipping,
  payment,
  isGift,
  giftMessage,
  giftOptionLabels,
  items,
  onEditAddress,
  onEditShipping,
  onEditPayment,
}: {
  selectedAddress?: Address;
  selectedShipping?: ShippingMethod;
  payment: PaymentMethod;
  isGift: boolean;
  giftMessage: string;
  giftOptionLabels?: string[];
  items: CartItem[];
  onEditAddress: () => void;
  onEditShipping: () => void;
  onEditPayment: () => void;
}) {
  return (
    <CheckoutSection icon={Check} title="بازبینی و تأیید">
      <dl className="divide-y divide-border/60">
        <ReviewRow icon={MapPin} label="آدرس تحویل" onEdit={onEditAddress}>
          {selectedAddress ? (
            <>
              <span className="block font-medium text-foreground">
                {selectedAddress.full_name}
              </span>
              <span className="block">
                {selectedAddress.address_line1}، {selectedAddress.city}
              </span>
            </>
          ) : (
            "—"
          )}
        </ReviewRow>
        <ReviewRow icon={Truck} label="روش ارسال" onEdit={onEditShipping}>
          <span className="text-foreground">
            {selectedShipping?.name ?? "—"}
          </span>
          {shippingDays(selectedShipping) ? (
            <span className="block text-xs">
              {shippingDays(selectedShipping)}
            </span>
          ) : null}
        </ReviewRow>
        <ReviewRow icon={Wallet} label="روش پرداخت" onEdit={onEditPayment}>
          <span className="text-foreground">
            {PAYMENT_LABEL[payment] ?? payment}
          </span>
        </ReviewRow>
        {isGift ? (
          <ReviewRow icon={Gift} label="هدیه" onEdit={onEditPayment}>
            <span className="text-foreground">
              این سفارش به‌عنوان هدیه ارسال می‌شود
            </span>
            {giftOptionLabels && giftOptionLabels.length > 0 ? (
              <span className="mt-0.5 block">
                {giftOptionLabels.join(" · ")}
              </span>
            ) : null}
            {giftMessage ? (
              <span className="mt-0.5 block">«{giftMessage}»</span>
            ) : null}
          </ReviewRow>
        ) : null}
      </dl>

      <ul className="mt-5 divide-y divide-border/60 border-t border-border/60">
        {items.map((item) => (
          <li
            key={item.id}
            className="flex items-center justify-between gap-3 py-3 text-sm"
          >
            <span className="min-w-0">
              <span className="block truncate font-medium">
                {item.product_title}
              </span>
              <span className="text-xs text-muted-foreground">
                {faNum(item.quantity)} ×{" "}
                {formatPrice(item.line_total / item.quantity)}
              </span>
            </span>
            <span className="font-medium tabular-nums">
              {formatPrice(item.line_total)}
            </span>
          </li>
        ))}
      </ul>
    </CheckoutSection>
  );
}

function ReviewRow({
  icon: Icon,
  label,
  onEdit,
  children,
}: {
  icon: typeof MapPin;
  label: string;
  onEdit: () => void;
  children: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 py-3">
      <div className="flex min-w-0 gap-3">
        <Icon className="mt-0.5 size-4 shrink-0 text-primary" />
        <div className="min-w-0">
          <dt className="text-xs text-muted-foreground">{label}</dt>
          <dd className="mt-0.5 text-sm text-muted-foreground">{children}</dd>
        </div>
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="h-8 shrink-0 px-2 text-xs text-primary"
        onClick={onEdit}
      >
        ویرایش
      </Button>
    </div>
  );
}
