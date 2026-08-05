"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  Lock,
  RefreshCw,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { QueryStateRegion } from "@/components/query-state-region";
import { Button } from "@/components/ui/button";
import { useAddresses } from "@/features/addresses/api";
import { useCart } from "@/features/cart/api";
import { useValidateCoupon } from "@/features/coupons/api";
import { usePlaceOrder } from "@/features/orders/hooks";
import { useShippingMethods } from "@/features/shipping/api";
import type { CouponValidation } from "@/features/coupons/types";
import type { PaymentMethod } from "@/features/orders/types";
import { ApiClientError } from "@/lib/api/store-client";
import {
  CHECKOUT_STEPS,
  CheckoutStepper,
  type CheckoutStepKey,
} from "./checkout-stepper";
import { CheckoutAddressStep } from "./checkout-address-step";
import { CheckoutPaymentStep } from "./checkout-payment-step";
import { CheckoutReviewStep } from "./checkout-review-step";
import { CheckoutShippingStep } from "./checkout-shipping-step";
import { CheckoutSummary } from "./checkout-summary";

type CouponAttempt = {
  code: string;
  subtotal: number;
  result?: CouponValidation;
  error?: string;
};

/** Package weight for quotes — sum of unit weights when known, else 0 (backend
 *  re-computes authoritatively from catalog weights at order creation). */
function packageWeightKg(
  items: Array<{ quantity: number; weight_kg?: number | null }> | undefined,
): number {
  if (!items?.length) return 0;
  return items.reduce((sum, item) => {
    const unit = typeof item.weight_kg === "number" && item.weight_kg > 0
      ? item.weight_kg
      : 0;
    return sum + unit * item.quantity;
  }, 0);
}

export function CheckoutFlow() {
  const router = useRouter();
  const cartQuery = useCart();
  const addressesQuery = useAddresses();
  const validateCoupon = useValidateCoupon();
  const placeOrder = usePlaceOrder();
  const cart = cartQuery.data;
  const addresses = addressesQuery.data;

  const [selectedAddressId, setSelectedAddressId] = React.useState<number>();
  const [adding, setAdding] = React.useState(false);
  const [shippingId, setShippingId] = React.useState<number>();
  const [payment, setPayment] = React.useState<PaymentMethod>("wallet");
  const [couponCode, setCouponCode] = React.useState("");
  const [couponAttempt, setCouponAttempt] = React.useState<CouponAttempt>();
  const [submitError, setSubmitError] = React.useState<string>();
  const couponAttemptVersion = React.useRef(0);

  // Wizard navigation. `maxReached` keeps already-visited steps clickable.
  const [step, setStep] = React.useState(0);
  const [maxReached, setMaxReached] = React.useState(0);
  const goTo = React.useCallback((i: number) => {
    const clamped = Math.max(0, Math.min(CHECKOUT_STEPS.length - 1, i));
    setStep(clamped);
    setMaxReached((m) => Math.max(m, clamped));
  }, []);

  // Gift mode
  const [isGift, setIsGift] = React.useState(false);
  const [giftMessage, setGiftMessage] = React.useState("");
  const [giftWrap, setGiftWrap] = React.useState(false);
  const [hidePrice, setHidePrice] = React.useState(true);
  const [deliveryDate, setDeliveryDate] = React.useState("");

  const subtotal = cart?.summary.subtotal ?? 0;
  React.useEffect(() => {
    couponAttemptVersion.current += 1;
  }, [subtotal]);

  const defaultAddressId = (
    addresses?.find((address) => address.is_default) ?? addresses?.[0]
  )?.id;
  const addressId = selectedAddressId ?? defaultAddressId;
  const selectedAddress = addresses?.find((a) => a.id === addressId);
  // Region is authoritative from the selected address country — never a
  // checkout constant. Quotes stay disabled until an address is chosen.
  const shipRegion = (selectedAddress?.country ?? "").trim().toUpperCase();
  const shipWeight = packageWeightKg(
    cart?.items as Array<{ quantity: number; weight_kg?: number | null }> | undefined,
  );
  const shipping = useShippingMethods(
    shipRegion,
    shipWeight,
    subtotal,
    shipRegion.length > 0,
  );

  // Drop a previously selected method when the region/weight quote set changes.
  React.useEffect(() => {
    if (!shippingId || !shipping.data) return;
    if (!shipping.data.some((m) => m.id === shippingId)) {
      setShippingId(undefined);
    }
  }, [shipping.data, shippingId]);

  const selectedShipping = shipping.data?.find((m) => m.id === shippingId);
  const normalizedCouponCode = couponCode.trim();
  const activeCouponAttempt =
    couponAttempt?.code === normalizedCouponCode &&
    couponAttempt.subtotal === subtotal
      ? couponAttempt
      : undefined;
  const coupon = activeCouponAttempt?.result;
  const couponError =
    activeCouponAttempt?.error ??
    (coupon && !coupon.is_valid ? "کد تخفیف معتبر نیست." : undefined);
  const couponNotice =
    couponAttempt?.code === normalizedCouponCode &&
    couponAttempt.subtotal !== subtotal &&
    couponAttempt.result?.is_valid
      ? "مبلغ سبد تغییر کرده است؛ کد تخفیف را دوباره بررسی کنید."
      : undefined;
  const discount = coupon?.is_valid ? coupon.discount_amount : 0;
  const shippingCost = coupon?.is_valid && coupon.free_shipping
    ? 0
    : (selectedShipping?.estimated_cost ?? 0);
  const total = Math.max(0, subtotal - discount + shippingCost);
  const canPlace = !!addressId && !!selectedShipping && !!cart?.items.length;

  const currentKey: CheckoutStepKey = CHECKOUT_STEPS[step].key;
  // Whether the user may advance past the current step.
  const stepValid =
    currentKey === "address"
      ? !!addressId
      : currentKey === "shipping"
        ? !!selectedShipping
        : true;

  function applyCoupon() {
    const code = normalizedCouponCode;
    if (!code) {
      setCouponAttempt({
        code,
        subtotal,
        error: "کد تخفیف را وارد کنید.",
      });
      return;
    }

    setCouponAttempt({ code, subtotal });
    const attemptVersion = ++couponAttemptVersion.current;
    validateCoupon.mutate(
      { code, order_subtotal: subtotal },
      {
        onSuccess: (res) => {
          if (couponAttemptVersion.current !== attemptVersion) return;
          setCouponAttempt((current) =>
            current?.code === code && current.subtotal === subtotal
              ? { code, subtotal, result: res }
              : current,
          );
          if (!res.is_valid) toast.error("کد تخفیف معتبر نیست");
          else toast.success("کد تخفیف اعمال شد");
        },
        onError: () => {
          if (couponAttemptVersion.current !== attemptVersion) return;
          const message = "بررسی کد تخفیف انجام نشد. دوباره تلاش کنید.";
          setCouponAttempt((current) =>
            current?.code === code && current.subtotal === subtotal
              ? { code, subtotal, error: message }
              : current,
          );
          toast.error(message);
        },
      },
    );
  }

  function submit() {
    if (!canPlace) return;
    setSubmitError(undefined);
    placeOrder.mutate(
      {
        address_id: addressId!,
        shipping_method_id: shippingId!,
        payment_method: payment,
        coupon_code: coupon?.is_valid ? coupon.coupon.code : undefined,
        ...(isGift
          ? {
              is_gift: true,
              gift_message: giftMessage.trim() || undefined,
              gift_wrap: giftWrap,
              hide_price: hidePrice,
              scheduled_delivery_date: deliveryDate
                ? new Date(deliveryDate).toISOString()
                : undefined,
            }
          : {}),
      },
      {
        onSuccess: (order) => {
          toast.success("سفارش ثبت شد");
          // Fire-and-forget purchase signals for recommendation profiles.
          const productIds = [
            ...new Set(
              (cart?.items ?? [])
                .map((item) => item.product_id)
                .filter((id): id is number => typeof id === "number" && id > 0),
            ),
          ];
          for (const productId of productIds) {
            void import("@/features/recommendations/client")
              .then(({ recordInteractionClient }) =>
                recordInteractionClient({
                  product_id: productId,
                  interaction_type: "purchase",
                  source: "checkout",
                  metadata: { order_id: order.id },
                }),
              )
              .catch(() => undefined);
          }
          router.push(`/checkout/confirmation/${order.id}`);
        },
        onError: (e) => {
          const message = orderErrorMessage(e);
          setSubmitError(message);
          toast.error(message);
        },
      },
    );
  }

  if (cartQuery.isPending) {
    return (
      <QueryStateRegion
        state="loading"
        aria-label="در حال دریافت سبد خرید"
        className="mt-8 flex min-h-64 items-center justify-center gap-2 rounded-2xl border border-border/60 bg-card/40 text-sm text-muted-foreground"
      >
        <Loader2 className="size-6 animate-spin" aria-hidden="true" />
        در حال دریافت سبد خرید…
      </QueryStateRegion>
    );
  }

  if (cartQuery.isError && !cart) {
    return (
      <QueryStateRegion
        state="error"
        className="border-hairline mt-8 flex min-h-64 flex-col items-center justify-center rounded-2xl bg-card/40 px-6 text-center"
      >
        <p className="font-medium">دریافت سبد خرید انجام نشد.</p>
        <Button
          type="button"
          variant="outline"
          className="mt-5"
          disabled={cartQuery.isFetching}
          onClick={() => void cartQuery.refetch()}
        >
          <RefreshCw className={cartQuery.isFetching ? "animate-spin" : undefined} />
          تلاش دوباره
        </Button>
      </QueryStateRegion>
    );
  }

  if (!cart) {
    return (
      <QueryStateRegion
        state="error"
        className="border-hairline mt-8 rounded-2xl bg-card/40 px-6 py-14 text-center"
      >
        دریافت سبد خرید انجام نشد. دوباره تلاش کنید.
      </QueryStateRegion>
    );
  }

  if (cart.items.length === 0) {
    return (
      <div className="border-hairline mt-8 flex flex-col items-center rounded-2xl bg-card/40 px-6 py-14 text-center">
        <p className="font-medium">سبد خرید شما خالی است</p>
        <Button asChild className="mt-5">
          <Link href="/products">رفتن به فروشگاه</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mt-8 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
      <div className="flex flex-col gap-6">
        {cartQuery.isError ? (
          <QueryStateRegion
            state="error"
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm"
          >
            <span>تازه‌سازی سبد انجام نشد؛ اطلاعات قبلی نمایش داده می‌شود.</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={cartQuery.isFetching}
              onClick={() => void cartQuery.refetch()}
            >
              <RefreshCw className={cartQuery.isFetching ? "animate-spin" : undefined} />
              تلاش دوباره
            </Button>
          </QueryStateRegion>
        ) : null}

        {/* Progress stepper */}
        <div className="border-hairline rounded-2xl bg-card/80 p-4 backdrop-blur-sm ring-1 ring-foreground/5">
          <CheckoutStepper
            current={step}
            maxReached={maxReached}
            onJump={goTo}
          />
        </div>

        {/* Step 1 — Address */}
        {currentKey === "address" ? (
          <CheckoutAddressStep
            addresses={addresses}
            isLoading={addressesQuery.isPending && addresses === undefined}
            isError={addressesQuery.isError}
            isRetrying={addressesQuery.isFetching}
            addressId={addressId}
            adding={adding}
            defaultNewAddress={addressesQuery.isSuccess && addresses?.length === 0}
            onRetry={() => void addressesQuery.refetch()}
            onSelectAddress={setSelectedAddressId}
            onStartAdding={() => setAdding(true)}
            onAddressCreated={(addr) => {
              setSelectedAddressId(addr.id);
              setAdding(false);
            }}
            onCancelAdding={() => setAdding(false)}
          />
        ) : null}

        {/* Step 2 — Shipping */}
        {currentKey === "shipping" ? (
          <CheckoutShippingStep
            methods={shipping.data}
            isLoading={shipping.isPending && shipping.data === undefined}
            isError={shipping.isError}
            isRetrying={shipping.isFetching}
            shippingId={shippingId}
            onRetry={() => void shipping.refetch()}
            onSelectShipping={setShippingId}
          />
        ) : null}

        {/* Step 3 — Payment + Coupon + Gift */}
        {currentKey === "payment" ? (
          <CheckoutPaymentStep
            payment={payment}
            onPaymentChange={setPayment}
            couponCode={couponCode}
            onCouponCodeChange={(code) => {
              couponAttemptVersion.current += 1;
              setCouponCode(code);
              setCouponAttempt(undefined);
            }}
            onApplyCoupon={applyCoupon}
            couponPending={validateCoupon.isPending}
            coupon={coupon}
            couponError={couponError}
            couponNotice={couponNotice}
            isGift={isGift}
            onGiftChange={setIsGift}
            giftMessage={giftMessage}
            onGiftMessageChange={setGiftMessage}
            giftWrap={giftWrap}
            onGiftWrapChange={setGiftWrap}
            hidePrice={hidePrice}
            onHidePriceChange={setHidePrice}
            deliveryDate={deliveryDate}
            onDeliveryDateChange={setDeliveryDate}
          />
        ) : null}

        {submitError ? (
          <QueryStateRegion
            state="error"
            className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
          >
            {submitError}
          </QueryStateRegion>
        ) : null}

        {/* Step 4 — Review */}
        {currentKey === "review" ? (
          <CheckoutReviewStep
            selectedAddress={selectedAddress}
            selectedShipping={selectedShipping}
            payment={payment}
            isGift={isGift}
            giftMessage={giftMessage}
            items={cart.items}
            onEditAddress={() => goTo(0)}
            onEditShipping={() => goTo(1)}
            onEditPayment={() => goTo(2)}
          />
        ) : null}

        {/* Step navigation */}
        <div className="flex items-center justify-between gap-3">
          <Button
            variant="ghost"
            onClick={() => goTo(step - 1)}
            disabled={step === 0 || placeOrder.isPending}
            className={cn(step === 0 && "invisible")}
          >
            <ChevronRight className="size-4" /> مرحلهٔ قبل
          </Button>

          {currentKey === "review" ? (
            <Button
              size="lg"
              className="h-12 min-w-44"
              disabled={!canPlace || placeOrder.isPending}
              onClick={submit}
            >
              {placeOrder.isPending ? (
                <Loader2 className="animate-spin" />
              ) : (
                <Lock className="size-4" />
              )}{" "}
              ثبت و پرداخت
            </Button>
          ) : (
            <Button
              size="lg"
              className="h-12 min-w-36"
              disabled={!stepValid}
              onClick={() => goTo(step + 1)}
            >
              ادامه <ChevronLeft className="size-4" />
            </Button>
          )}
        </div>

        {currentKey !== "review" && !stepValid ? (
          <p className="-mt-3 text-center text-xs text-muted-foreground">
            {currentKey === "address"
              ? "یک آدرس تحویل انتخاب کنید."
              : "یک روش ارسال انتخاب کنید."}
          </p>
        ) : null}
      </div>

      {/* Summary rail (sticky desktop) */}
      <CheckoutSummary
        totalItems={cart.summary.total_items}
        subtotal={subtotal}
        discount={discount}
        shippingCost={shippingCost}
        hasSelectedShipping={!!selectedShipping}
        total={total}
        showSubmit={currentKey === "review"}
        canPlace={canPlace}
        isSubmitting={placeOrder.isPending}
        onSubmit={submit}
      />
    </div>
  );
}

function orderErrorMessage(error: unknown) {
  if (!(error instanceof ApiClientError)) return "ثبت سفارش ناموفق بود. دوباره تلاش کنید.";

  switch (error.code) {
    case "OUT_OF_STOCK":
      return "موجودی برخی اقلام کافی نیست. سبد خرید را دوباره بررسی کنید.";
    case "CART_EMPTY":
      return "سبد خرید خالی است. پیش از ثبت سفارش یک کالا اضافه کنید.";
    case "INVALID_SHIPPING_METHOD":
      return "روش ارسال انتخاب‌شده دیگر در دسترس نیست. روش دیگری انتخاب کنید.";
    case "INSUFFICIENT_FUNDS":
      return "موجودی کیف پول برای پرداخت این سفارش کافی نیست.";
    default:
      return error.code.includes("COUPON") || error.code === "INVALID_COUPON"
        ? "کد تخفیف دیگر معتبر نیست. آن را دوباره بررسی کنید."
        : "ثبت سفارش ناموفق بود. دوباره تلاش کنید.";
  }
}
