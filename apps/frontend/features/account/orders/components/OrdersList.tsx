"use client";

import * as React from "react";
import { Loader2, ShoppingBag, ChevronRight, ChevronLeft } from "lucide-react";

import { faNum } from "@/lib/products";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useOrders } from "@/features/orders/hooks";
import type { OrderListItem, OrderStatus } from "@/features/orders/types";
import { OrderCard } from "./OrderCard";
import { EmptyState } from "@/features/account/EmptyState";

/** Filter tabs → the set of statuses each one matches (empty = all). */
const TABS: {
  value: string;
  label: string;
  match: (s: OrderStatus) => boolean;
}[] = [
  { value: "all", label: "همه", match: () => true },
  {
    value: "processing",
    label: "در حال پردازش",
    match: (s) =>
      ["pending", "paid", "processing", "ready_to_ship"].includes(s),
  },
  {
    value: "shipped",
    label: "ارسال‌شده",
    match: (s) => ["shipped", "out_for_delivery"].includes(s),
  },
  { value: "delivered", label: "تحویل‌شده", match: (s) => s === "delivered" },
  {
    value: "cancelled",
    label: "لغو/بازگشت",
    match: (s) =>
      [
        "cancelled",
        "refund_requested",
        "refund_approved",
        "refunded",
        "partially_refunded",
      ].includes(s),
  },
];

export function OrdersList() {
  const [tab, setTab] = React.useState("all");
  const [page, setPage] = React.useState(1);
  const { data, isLoading, isError, isFetching, refetch } = useOrders({ page });

  const matcher = TABS.find((t) => t.value === tab) ?? TABS[0];
  const all = data?.results ?? [];
  const visible = all.filter((o: OrderListItem) => matcher.match(o.status));
  const pagination = data?.pagination;

  return (
    <div>
      <Tabs
        value={tab}
        onValueChange={(v) => {
          setTab(v);
          setPage(1);
        }}
        className="mb-6"
      >
        <TabsList className="flex-wrap">
          {TABS.map((t) => (
            <TabsTrigger
              key={t.value}
              value={t.value}
              className="cursor-pointer"
            >
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-44 rounded-2xl" />
          ))}
        </div>
      ) : isError ? (
        <div className="border-hairline flex flex-col items-center gap-3 rounded-2xl border-dashed bg-card/40 px-6 py-12 text-center">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
            <ShoppingBag className="size-6" />
          </span>
          <p className="text-sm text-muted-foreground">
            خطا در دریافت سفارش‌ها.
          </p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            تلاش دوباره
          </Button>
        </div>
      ) : visible.length === 0 ? (
        <EmptyState
          icon={ShoppingBag}
          title={
            tab === "all"
              ? "هنوز سفارشی ثبت نکرده‌اید"
              : "سفارشی در این وضعیت نیست"
          }
          description={
            tab === "all"
              ? "پس از اولین خرید، سفارش‌های شما اینجا نمایش داده می‌شوند."
              : "سفارش‌های دیگری را از زبانه‌های بالا ببینید."
          }
          actionLabel={tab === "all" ? "شروع خرید" : undefined}
          actionHref={tab === "all" ? "/products" : undefined}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {visible.map((order) => (
            <OrderCard key={order.id} order={order} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {pagination && pagination.total_pages > 1 ? (
        <div className="mt-6 flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={!pagination.has_prev || isFetching}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            <ChevronRight className="size-4" /> قبلی
          </Button>
          <span className="px-2 text-sm text-muted-foreground">
            {isFetching ? (
              <Loader2 className="inline size-4 animate-spin" />
            ) : (
              <>
                صفحهٔ {faNum(pagination.page)} از{" "}
                {faNum(pagination.total_pages)}
              </>
            )}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={!pagination.has_next || isFetching}
            onClick={() => setPage((p) => p + 1)}
          >
            بعدی <ChevronLeft className="size-4" />
          </Button>
        </div>
      ) : null}
    </div>
  );
}
