"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { useSession } from "next-auth/react";
import { Heart, Minus, Plus, Loader2, Check } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { formatPrice, faNum } from "@/lib/products";
import type {
  ProductDetail,
  ProductVariant,
} from "@/features/catalog/products/types";
import {
  buildVariantAxes,
  findVariantForSelection,
  isOptionValueAvailable,
  selectionFromVariant,
} from "@/features/catalog/products/variant-matrix";
import {
  useWishlist,
  useAddWishlistItem,
  useRemoveWishlistItem,
} from "@/features/wishlist/hooks";
import { useRecordInteraction } from "@/features/recommendations/hooks";
import { AddToCartButton } from "@/features/cart/components/add-to-cart-button";
import { lowStockLabel } from "@/features/catalog/products/stock-display";
import { AlertButton } from "./alert-button";

const MAX_QTY = 12;

function variantLabel(variant: ProductVariant, index: number) {
  const options = variant.options
    ?.map((option) => option.value.trim())
    .filter(Boolean)
    .join(" · ");

  return options || variant.sku?.trim() || `گزینه ${faNum(index + 1)}`;
}

function availableStock(variant: ProductVariant | undefined) {
  return Math.max(0, variant?.available_stock ?? 0);
}

/**
 * ProductPurchasePanel — modern buy box: multi-axis variant matrix when the
 * catalogue provides option types, clean price block, qty, cart, alerts, wishlist,
 * and sticky mobile CTA bar.
 */
export function ProductPurchasePanel({ product }: { product: ProductDetail }) {
  const variants = (product.variants ?? []).filter((v) => v.is_active);
  const axes = React.useMemo(() => buildVariantAxes(variants), [variants]);
  const useMatrix = axes.length > 0;

  const defaultVariant =
    variants.find((variant) => availableStock(variant) > 0) ?? variants[0];

  const [selectedId, setSelectedId] = React.useState<number | undefined>(
    defaultVariant?.id,
  );
  const [selection, setSelection] = React.useState<Record<string, string>>(
    () => selectionFromVariant(defaultVariant, axes),
  );
  const [qty, setQty] = React.useState(1);

  // Keep matrix selection → variant in sync.
  React.useEffect(() => {
    if (!useMatrix) return;
    const match = findVariantForSelection(variants, selection);
    if (match && match.id !== selectedId) {
      setSelectedId(match.id);
      setQty(1);
    }
  }, [useMatrix, variants, selection, selectedId]);

  const selected =
    variants.find((v) => v.id === selectedId) ??
    (useMatrix
      ? findVariantForSelection(variants, selection)
      : undefined) ??
    defaultVariant;

  const selectedIndex = variants.findIndex(
    (variant) => variant.id === selected?.id,
  );
  const selectedLabel = selected
    ? variantLabel(selected, Math.max(0, selectedIndex))
    : "";
  const stock = availableStock(selected);
  const isAvailable = stock > 0;
  const maxQty = Math.min(MAX_QTY, stock);
  const safeQty = maxQty > 0 ? Math.min(qty, maxQty) : 1;

  const compareAt = selected?.compare_at_price;
  const onSale = !!compareAt && compareAt > (selected?.price ?? 0);
  const discountPct =
    onSale && compareAt
      ? Math.round(((compareAt - selected!.price) / compareAt) * 100)
      : 0;
  const saving = onSale && compareAt ? compareAt - selected!.price : 0;

  const mounted = React.useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  function selectVariant(id: number) {
    setSelectedId(id);
    setQty(1);
    const next = variants.find((v) => v.id === id);
    if (next && useMatrix) {
      setSelection(selectionFromVariant(next, axes));
    }
  }

  function pickAxisValue(axisKey: string, value: string) {
    setSelection((current) => ({ ...current, [axisKey]: value }));
    setQty(1);
  }

  const { status } = useSession();
  const authed = status === "authenticated";
  const wishlist = useWishlist(authed);
  const addWish = useAddWishlistItem();
  const removeWish = useRemoveWishlistItem();
  const record = useRecordInteraction();
  const wishItem = wishlist.data?.items.find(
    (i) => i.variant_id === selected?.id,
  );
  const inWishlist = !!wishItem;
  const wishPending = addWish.isPending || removeWish.isPending;

  function toggleWishlist() {
    if (!authed) {
      toast.info("برای افزودن به علاقه‌مندی‌ها وارد شوید");
      return;
    }
    if (!selected) return;
    if (wishItem) {
      removeWish.mutate(wishItem.id, {
        onSuccess: () => toast.success("از علاقه‌مندی‌ها حذف شد"),
        onError: () => toast.error("حذف ناموفق بود"),
      });
    } else {
      addWish.mutate(selected.id, {
        onSuccess: () => {
          toast.success("به علاقه‌مندی‌ها افزوده شد");
          record.mutate({
            product_id: product.id,
            interaction_type: "wishlist",
            source: "pdp",
          });
        },
        onError: () => toast.error("افزودن ناموفق بود"),
      });
    }
  }

  return (
    <div data-testid="purchase-panel" className="space-y-6">
      {useMatrix ? (
        <div className="space-y-5">
          {axes.map((axis) => (
            <fieldset key={axis.key}>
              <legend className="mb-2.5 text-sm font-medium text-foreground">
                {axis.title}
              </legend>
              <div className="flex flex-wrap gap-2" role="list">
                {axis.values.map((value) => {
                  const isSel = selection[axis.key] === value;
                  const exists = isOptionValueAvailable(
                    variants,
                    selection,
                    axis.key,
                    value,
                    false,
                  );
                  const inStock = isOptionValueAvailable(
                    variants,
                    selection,
                    axis.key,
                    value,
                    true,
                  );
                  return (
                    <button
                      key={value}
                      type="button"
                      role="listitem"
                      disabled={!exists}
                      onClick={() => pickAxisValue(axis.key, value)}
                      aria-pressed={isSel}
                      aria-label={
                        !exists
                          ? `${value}، در دسترس نیست`
                          : !inStock
                            ? `${value}، ناموجود`
                            : value
                      }
                      className={cn(
                        "min-h-11 rounded-xl border px-4 py-2 text-sm transition-all duration-200",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                        "disabled:cursor-not-allowed disabled:opacity-40",
                        isSel
                          ? "border-primary bg-primary/10 font-semibold text-primary ring-1 ring-primary/25"
                          : "border-border bg-background hover:border-primary/40 hover:bg-accent/40",
                        exists && !inStock && "line-through decoration-muted-foreground/50",
                      )}
                    >
                      {value}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          ))}
        </div>
      ) : variants.length > 1 ? (
        <fieldset>
          <legend className="mb-2.5 text-sm font-medium text-foreground">
            انتخاب گزینه
          </legend>
          <div className="flex flex-wrap gap-2">
            {variants.map((variant, index) => {
              const isSel = variant.id === selected?.id;
              const label = variantLabel(variant, index);
              const variantStock = availableStock(variant);
              return (
                <label key={variant.id} className="relative cursor-pointer">
                  <input
                    type="radio"
                    name={`product-${product.id}-variant`}
                    value={variant.id}
                    checked={isSel}
                    onChange={() => selectVariant(variant.id)}
                    aria-label={
                      variantStock > 0 ? label : `${label}، ناموجود`
                    }
                    className="peer sr-only"
                  />
                  <span
                    className={cn(
                      "flex min-h-11 items-center gap-2 rounded-xl border px-4 py-2 text-sm transition-all duration-200 peer-focus-visible:ring-2 peer-focus-visible:ring-primary peer-focus-visible:outline-none",
                      isSel
                        ? "border-primary bg-primary/10 font-medium text-primary ring-1 ring-primary/30"
                        : "border-border hover:border-primary/40 hover:bg-accent/40",
                    )}
                  >
                    <span>{label}</span>
                    {variantStock <= 0 ? (
                      <span className="text-xs font-normal text-muted-foreground">
                        ناموجود
                      </span>
                    ) : null}
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>
      ) : null}

      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="rounded-2xl border border-border/60 bg-background/60 p-4 sm:p-5"
      >
        {selected ? (
          <>
            <p className="text-xs font-medium tracking-wide text-muted-foreground">
              قیمت
              {selectedLabel ? (
                <span className="font-normal"> · {selectedLabel}</span>
              ) : null}
            </p>
            <div className="mt-1.5 flex flex-wrap items-baseline gap-x-3 gap-y-1.5">
              <span className="font-serif text-3xl tracking-tight text-foreground sm:text-4xl">
                {formatPrice(selected.price)}
              </span>
              {onSale ? (
                <>
                  <span
                    className="text-muted-foreground line-through"
                    aria-label="قیمت پیشین"
                  >
                    {formatPrice(compareAt!)}
                  </span>
                  <span className="inline-flex items-center rounded-full bg-wine/10 px-2.5 py-1 text-xs font-bold text-wine ring-1 ring-wine/20">
                    {faNum(discountPct)}٪ تخفیف
                  </span>
                </>
              ) : null}
            </div>
            {onSale ? (
              <p className="mt-1.5 text-sm text-wine">
                {formatPrice(saving)} صرفه‌جویی می‌کنید
              </p>
            ) : null}
            <p
              className={cn(
                "mt-2 text-sm",
                isAvailable ? "text-primary" : "text-wine",
              )}
            >
              {!isAvailable
                ? "این گزینه در حال حاضر ناموجود است."
                : (lowStockLabel(stock) ?? "آمادهٔ سفارش")}
            </p>
          </>
        ) : (
          <p className="text-muted-foreground">
            این محصول گزینهٔ فعالی برای خرید ندارد.
          </p>
        )}
      </div>

      {selected ? (
        <div className="space-y-4">
          {isAvailable ? (
            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground" id="qty-label">
                تعداد
              </span>
              <div
                className="inline-flex items-center rounded-xl border border-border bg-card"
                role="group"
                aria-labelledby="qty-label"
              >
                <button
                  type="button"
                  onClick={() => setQty(Math.max(1, safeQty - 1))}
                  disabled={safeQty <= 1}
                  aria-label="کاهش تعداد"
                  className="flex size-11 cursor-pointer items-center justify-center rounded-r-xl text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Minus className="size-4" />
                </button>
                <span
                  aria-live="polite"
                  className="w-10 text-center text-sm font-semibold tabular-nums"
                >
                  {faNum(safeQty)}
                </span>
                <button
                  type="button"
                  onClick={() => setQty(Math.min(maxQty, safeQty + 1))}
                  disabled={safeQty >= maxQty}
                  aria-label="افزایش تعداد"
                  className="flex size-11 cursor-pointer items-center justify-center rounded-l-xl text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Plus className="size-4" />
                </button>
              </div>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-3">
            <AddToCartButton
              productVariantId={selected.id}
              productId={product.id}
              quantity={safeQty}
              disabled={!isAvailable}
              label={isAvailable ? "افزودن به سبد" : "ناموجود"}
              className="hidden flex-1 lg:inline-flex lg:flex-none"
            />
            <AlertButton
              productVariantId={selected.id}
              isAvailable={isAvailable}
            />
            <WishlistToggle
              inWishlist={inWishlist}
              pending={wishPending}
              onToggle={toggleWishlist}
              disabled={!selected}
              variantLabel={selectedLabel}
              className="hidden lg:inline-flex"
            />
          </div>
        </div>
      ) : null}

      {mounted
        ? createPortal(
            <div
              className="fixed inset-x-0 bottom-0 z-40 border-t border-border/60 bg-background/95 px-4 py-3 shadow-[0_-8px_30px_rgba(0,0,0,0.08)] backdrop-blur-md lg:hidden [padding-bottom:calc(env(safe-area-inset-bottom)+0.75rem)]"
              aria-label="خرید سریع"
            >
              <div className="mx-auto flex max-w-7xl items-center gap-3">
                <div className="min-w-0 flex-1 leading-tight">
                  {selected ? (
                    <>
                      <p className="truncate font-serif text-lg text-foreground">
                        {formatPrice(selected.price)}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {selectedLabel} ·{" "}
                        {isAvailable ? `تعداد ${faNum(safeQty)}` : "ناموجود"}
                      </p>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">ناموجود</p>
                  )}
                </div>
                <WishlistToggle
                  inWishlist={inWishlist}
                  pending={wishPending}
                  onToggle={toggleWishlist}
                  disabled={!selected}
                  variantLabel={selectedLabel}
                />
                <AddToCartButton
                  productVariantId={selected?.id}
                  productId={product.id}
                  quantity={safeQty}
                  disabled={!selected || !isAvailable}
                  label={isAvailable ? "افزودن به سبد" : "ناموجود"}
                  className="flex-[1.4]"
                />
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

function WishlistToggle({
  inWishlist,
  pending,
  onToggle,
  disabled,
  variantLabel,
  className,
}: {
  inWishlist: boolean;
  pending: boolean;
  onToggle: () => void;
  disabled?: boolean;
  variantLabel?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled || pending}
      aria-pressed={inWishlist}
      aria-label={`${inWishlist ? "حذف از علاقه‌مندی‌ها" : "افزودن به علاقه‌مندی‌ها"}${variantLabel ? `: ${variantLabel}` : ""}`}
      className={cn(
        "inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-xl border transition-colors duration-200 disabled:opacity-50",
        inWishlist
          ? "border-wine/40 bg-wine/10 text-wine"
          : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground",
        className,
      )}
    >
      {pending ? (
        <Loader2 className="size-5 animate-spin" />
      ) : inWishlist ? (
        <span className="relative inline-flex">
          <Heart className="size-5 fill-wine" />
          <Check
            aria-hidden
            className="absolute -end-1.5 -top-1.5 size-3 rounded-full bg-wine p-px text-wine-foreground"
          />
        </span>
      ) : (
        <Heart className="size-5" />
      )}
    </button>
  );
}
