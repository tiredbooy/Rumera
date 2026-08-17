"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Heart, Plus, ShoppingCart, Check, Ban, Loader2 } from "lucide-react";

import { faNum, formatPrice } from "@/lib/products";
import type { WishlistItem } from "@/features/wishlist/types";
import {
  useWishlist,
  useRemoveWishlistItem,
} from "@/features/wishlist/hooks";
import { useAddCartItem, useBulkAddCartItems } from "@/features/cart/api";
import { cartMutationErrorMessage } from "@/features/cart/errors";
import { useRecordInteraction } from "@/features/recommendations/hooks";
import type {
  BulkAddCartResult,
  SkippedCartItemReason,
} from "@/features/cart/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { StorefrontMedia } from "@/components/storefront-media";
import { cn } from "@/lib/utils";
import { DashboardErrorState } from "@/features/dashboard/components/async-state";
import { EmptyState } from "../../EmptyState";

const productHref = (item: WishlistItem) =>
  item.product_slug
    ? `/products/${item.product_slug}`
    : `/search?q=${encodeURIComponent(item.product_title)}`;

type CartRowStatus = {
  kind: "pending" | "success" | "warning" | "error";
  message: string;
};

const SKIP_REASON_LABELS: Record<SkippedCartItemReason, string> = {
  invalid: "درخواست نامعتبر است",
  not_found: "محصول یافت نشد",
  unavailable: "دیگر قابل خرید نیست",
  out_of_stock: "موجودی کافی نیست",
};

function getBulkFeedback(result: BulkAddCartResult): {
  tone: "success" | "warning" | "error";
  title: string;
  description?: string;
} {
  const skippedCount = result.skipped.length;
  const total = result.added + skippedCount;
  if (skippedCount === 0) {
    return {
      tone: "success",
      title: `${faNum(result.added)} مورد به سبد خرید افزوده شد`,
    };
  }

  const counts = result.skipped.reduce(
    (current, { reason }) => ({
      ...current,
      [reason]: current[reason] + 1,
    }),
    {
      invalid: 0,
      not_found: 0,
      unavailable: 0,
      out_of_stock: 0,
    } satisfies Record<SkippedCartItemReason, number>,
  );
  const description = (Object.keys(counts) as SkippedCartItemReason[])
    .filter((reason) => counts[reason] > 0)
    .map(
      (reason) =>
        `${faNum(counts[reason])} مورد: ${SKIP_REASON_LABELS[reason]}`,
    )
    .join("، ");

  return result.added === 0
    ? {
        tone: "error",
        title: "هیچ موردی به سبد خرید افزوده نشد",
        description,
      }
    : {
        tone: "warning",
        title: `${faNum(result.added)} از ${faNum(total)} مورد به سبد خرید افزوده شد`,
        description,
      };
}

export function WishlistView() {
  const wishlist = useWishlist();
  const removeItem = useRemoveWishlistItem();
  const addCart = useAddCartItem();
  const recordInteraction = useRecordInteraction();
  const bulkAdd = useBulkAddCartItems();
  const [addingItemId, setAddingItemId] = React.useState<number | null>(null);
  const [removingItemId, setRemovingItemId] = React.useState<number | null>(null);
  const [bulkRunning, setBulkRunning] = React.useState(false);
  const [rowStatuses, setRowStatuses] = React.useState<
    Record<number, CartRowStatus>
  >({});
  const [actionStatus, setActionStatus] = React.useState<string | null>(null);
  const items = wishlist.data?.items ?? [];
  const availableItems = items.filter((item) => item.is_in_stock);
  const isBulkPending = bulkRunning || bulkAdd.isPending;
  const actionsPending =
    isBulkPending ||
    addingItemId !== null ||
    removingItemId !== null ||
    addCart.isPending ||
    removeItem.isPending;

  function setRowStatus(itemId: number, status: CartRowStatus) {
    setRowStatuses((current) => ({ ...current, [itemId]: status }));
  }

  async function remove(item: WishlistItem) {
    if (actionsPending) return;
    setRemovingItemId(item.id);
    setActionStatus(`در حال حذف ${item.product_title}…`);
    try {
      await removeItem.mutateAsync(item.id);
      setActionStatus(`${item.product_title} از علاقه‌مندی‌ها حذف شد`);
      toast.success("از علاقه‌مندی‌ها حذف شد", {
        description: item.product_title,
      });
    } catch {
      setActionStatus(`حذف ${item.product_title} ناموفق بود`);
      toast.error("حذف ناموفق بود", { description: item.product_title });
    } finally {
      setRemovingItemId(null);
    }
  }

  async function addToCart(item: WishlistItem) {
    if (actionsPending) return;
    setAddingItemId(item.id);
    setRowStatus(item.id, { kind: "pending", message: "در حال افزودن…" });
    setActionStatus(`در حال افزودن ${item.product_title} به سبد خرید…`);
    try {
      await addCart.mutateAsync({
        product_variant_id: item.variant_id,
        quantity: 1,
      });
      setRowStatus(item.id, { kind: "success", message: "به سبد افزوده شد" });
      setActionStatus(`${item.product_title} به سبد خرید افزوده شد`);
      toast.success("به سبد خرید افزوده شد", {
        description: `${item.product_title} — ${formatPrice(item.price)}`,
      });
      if (item.product_id > 0) {
        void recordInteraction
          .mutateAsync({
            product_id: item.product_id,
            interaction_type: "add_to_cart",
            source: "wishlist",
          })
          .catch(() => undefined);
      }
    } catch (error) {
      const message = cartMutationErrorMessage(error);
      setRowStatus(item.id, { kind: "error", message });
      setActionStatus(`افزودن ${item.product_title} به سبد خرید ناموفق بود`);
      toast.error(message, {
        description: item.product_title,
      });
    } finally {
      setAddingItemId(null);
    }
  }

  async function addAllToCart() {
    if (availableItems.length === 0 || actionsPending) return;

    setBulkRunning(true);
    setActionStatus(
      `در حال افزودن ${faNum(availableItems.length)} مورد به سبد خرید…`,
    );
    setRowStatuses((current) => {
      const next = { ...current };
      availableItems.forEach((item) => {
        next[item.id] = { kind: "pending", message: "در حال افزودن…" };
      });
      return next;
    });

    try {
      const result = await bulkAdd.mutateAsync(
        availableItems.map((item) => ({
          product_variant_id: item.variant_id,
          quantity: 1,
        })),
      );
      const skippedByVariant = new Map(
        result.skipped.map((item) => [item.product_variant_id, item.reason]),
      );
      setRowStatuses((current) => {
        const next = { ...current };
        availableItems.forEach((item) => {
          const reason = skippedByVariant.get(item.variant_id);
          next[item.id] = reason
            ? {
                kind: "warning",
                message: SKIP_REASON_LABELS[reason],
              }
            : { kind: "success", message: "به سبد افزوده شد" };
        });
        return next;
      });

      const feedback = getBulkFeedback(result);
      setActionStatus(
        [feedback.title, feedback.description].filter(Boolean).join("؛ "),
      );
      toast[feedback.tone](feedback.title, {
        description: feedback.description,
      });

      // Fire-and-forget recs signals only for variants that were not skipped.
      for (const item of availableItems) {
        if (skippedByVariant.has(item.variant_id) || item.product_id <= 0) {
          continue;
        }
        void recordInteraction
          .mutateAsync({
            product_id: item.product_id,
            interaction_type: "add_to_cart",
            source: "wishlist_bulk",
          })
          .catch(() => undefined);
      }
    } catch {
      setRowStatuses((current) => {
        const next = { ...current };
        availableItems.forEach((item) => {
          next[item.id] = { kind: "error", message: "افزودن ناموفق بود" };
        });
        return next;
      });
      setActionStatus("افزودن گروهی به سبد خرید ناموفق بود");
      toast.error("افزودن گروهی به سبد خرید ناموفق بود");
    } finally {
      setBulkRunning(false);
    }
  }

  if (wishlist.isLoading) {
    return (
      <div className="grid grid-cols-2 gap-4 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton
            key={i}
            className="aspect-[3/4] rounded-2xl sm:rounded-3xl"
          />
        ))}
      </div>
    );
  }

  if (wishlist.isError) {
    return (
      <DashboardErrorState
        title="خطا در دریافت علاقه‌مندی‌ها"
        description="فهرست علاقه‌مندی‌ها بارگذاری نشد. اتصال را بررسی کنید و دوباره تلاش کنید."
        onRetry={() => void wishlist.refetch()}
        isRetrying={wishlist.isFetching}
      />
    );
  }

  if (items.length === 0) {
    return (
      <EmptyState
        icon={Heart}
        title="فهرست علاقه‌مندی‌ها خالی است"
        description="بطری‌هایی را که دوست دارید ذخیره کنید تا بعداً به‌راحتی پیدایشان کنید."
        actionLabel="کشف محصولات"
        actionHref="/products"
      />
    );
  }

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">
            {faNum(items.length)}
          </span>{" "}
          مورد ذخیره‌شده
        </p>
        <Button
          size="sm"
          variant="outline"
          onClick={addAllToCart}
          disabled={availableItems.length === 0 || actionsPending}
        >
          {isBulkPending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <ShoppingCart className="size-4" aria-hidden />
          )}
          {isBulkPending ? "در حال افزودن همه…" : "افزودن همه به سبد"}
        </Button>
      </div>

      {actionStatus ? (
        <p
          role="status"
          className="mb-4 rounded-xl bg-secondary/60 px-3 py-2 text-xs text-muted-foreground"
        >
          {actionStatus}
        </p>
      ) : null}

      <div className="grid grid-cols-2 gap-4 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4">
        {items.map((item) => {
          const onSale =
            item.compare_at_price && item.compare_at_price > item.price;
          const discount = onSale
            ? Math.round((1 - item.price / item.compare_at_price!) * 100)
            : 0;
          const rowStatus = rowStatuses[item.id];
          const isAdding =
            addingItemId === item.id || rowStatus?.kind === "pending";
          const isRemoving = removingItemId === item.id;
          return (
            <article
              key={item.id}
              aria-busy={isAdding || isRemoving ? true : undefined}
              className="group/product hover-lift border-hairline relative flex h-full flex-col overflow-hidden rounded-2xl bg-card sm:rounded-3xl"
            >
              <div className="relative aspect-4/5 overflow-hidden">
                <Link
                  href={productHref(item)}
                  className="absolute inset-0"
                  aria-label={item.product_title}
                >
                  <div className="absolute inset-0 transition-transform duration-700 ease-out group-hover/product:scale-105">
                    <StorefrontMedia
                      slot="wishlist"
                      src={item.image_url}
                      alt={item.product_title}
                      monogram={item.product_title.charAt(0)}
                    />
                  </div>
                </Link>

                {onSale ? (
                  <div className="pointer-events-none absolute start-3 top-3 z-10 sm:start-4 sm:top-4">
                    <Badge className="bg-wine text-wine-foreground shadow-sm">
                      ٪{faNum(discount)}-
                    </Badge>
                  </div>
                ) : null}

                <button
                  type="button"
                  onClick={() => remove(item)}
                  disabled={actionsPending}
                  aria-label={`حذف ${item.product_title} از علاقه‌مندی‌ها`}
                  className="absolute end-3 top-3 z-10 flex size-9 cursor-pointer items-center justify-center rounded-full bg-background/80 text-wine shadow-sm backdrop-blur-md transition-all duration-300 hover:scale-110 hover:bg-wine hover:text-wine-foreground disabled:cursor-wait disabled:opacity-50 sm:end-4 sm:top-4"
                >
                  {isRemoving ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                  ) : (
                    <Heart className="size-4 fill-current" aria-hidden />
                  )}
                </button>

                {item.is_in_stock ? (
                  <div className="pointer-events-none absolute inset-x-3 bottom-3 z-10 hidden translate-y-3 opacity-0 transition-all duration-300 group-hover/product:translate-y-0 group-hover/product:opacity-100 [@media(hover:hover)]:block">
                    <Button
                      type="button"
                      className="pointer-events-auto h-11 w-full cursor-pointer rounded-2xl shadow-lg"
                      onClick={() => addToCart(item)}
                      disabled={actionsPending}
                    >
                      {isAdding ? (
                        <Loader2 className="animate-spin" aria-hidden />
                      ) : (
                        <Plus aria-hidden />
                      )}
                      {isAdding ? "در حال افزودن…" : "افزودن به سبد"}
                    </Button>
                  </div>
                ) : null}
              </div>

              <div className="flex flex-1 flex-col gap-2 p-4 sm:gap-2.5 sm:p-5">
                <div className="flex flex-wrap items-center justify-end gap-2">
                  {item.is_in_stock ? (
                    <Badge
                      variant="secondary"
                      className="gap-1 px-2 py-0 text-[10px]"
                    >
                      <Check className="size-3" /> موجود
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="gap-1 px-2 py-0 text-[10px] text-muted-foreground"
                    >
                      <Ban className="size-3" /> ناموجود
                    </Badge>
                  )}
                  {rowStatus ? (
                    <span
                      className={cn(
                        "text-[10px] font-medium",
                        rowStatus.kind === "success" &&
                          "text-success",
                        rowStatus.kind === "warning" &&
                          "text-warning",
                        rowStatus.kind === "error" && "text-destructive",
                        rowStatus.kind === "pending" &&
                          "text-muted-foreground",
                      )}
                    >
                      {rowStatus.message}
                    </span>
                  ) : null}
                </div>

                <h3 className="line-clamp-2 font-serif text-base leading-tight transition-colors group-hover/product:text-primary sm:text-lg">
                  <Link href={productHref(item)}>
                    {item.product_title}
                  </Link>
                </h3>

                <div className="mt-auto flex items-end justify-between gap-2 pt-1.5 sm:pt-2">
                  <span className="flex flex-wrap items-baseline gap-x-1.5">
                    <span className="font-serif text-lg text-foreground sm:text-2xl">
                      {formatPrice(item.price)}
                    </span>
                    {onSale ? (
                      <span className="text-[10px] text-muted-foreground line-through sm:text-xs">
                        {formatPrice(item.compare_at_price!)}
                      </span>
                    ) : null}
                  </span>
                  {item.is_in_stock ? (
                    <Button
                      type="button"
                      size="icon"
                      variant="secondary"
                      className="size-10 shrink-0 cursor-pointer rounded-xl transition-colors group-hover/product:bg-primary group-hover/product:text-primary-foreground sm:size-11 sm:rounded-2xl [@media(hover:hover)]:hidden"
                      aria-label={`افزودن ${item.product_title} به سبد خرید`}
                      onClick={() => addToCart(item)}
                      disabled={actionsPending}
                    >
                      {isAdding ? (
                        <Loader2 className="animate-spin" aria-hidden />
                      ) : (
                        <Plus aria-hidden />
                      )}
                    </Button>
                  ) : null}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </>
  );
}
