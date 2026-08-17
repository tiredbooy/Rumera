"use client";

import * as React from "react";
import { Loader2, ShoppingBag } from "lucide-react";

import { ListPagination } from "@/components/list-pagination";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ACCOUNT_ORDER_TAB_STATUSES,
  useOrdersTab,
  type AccountOrderTab,
} from "@/features/orders/hooks";
import { OrderCard } from "./OrderCard";
import { EmptyState } from "@/features/account/EmptyState";

const TABS: { value: AccountOrderTab; label: string }[] = [
  { value: "all", label: "همه" },
  { value: "processing", label: "در حال پردازش" },
  { value: "shipped", label: "ارسال‌شده" },
  { value: "delivered", label: "تحویل‌شده" },
  { value: "cancelled", label: "لغو/بازگشت" },
];

export function OrdersList({
  initialTab = "all",
}: {
  initialTab?: AccountOrderTab;
} = {}) {
  const [tab, setTab] = React.useState<AccountOrderTab>(initialTab);
  const [page, setPage] = React.useState(1);
  const { data, isLoading, isError, isFetching, refetch } = useOrdersTab({
    page,
    statuses: ACCOUNT_ORDER_TAB_STATUSES[tab],
  });

  const visible = data?.results ?? [];
  const pagination = data?.pagination;

  return (
    <div>
      <Tabs
        value={tab}
        onValueChange={(v) => {
          setTab(v as AccountOrderTab);
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

      {pagination ? (
        <ListPagination
          page={pagination.page}
          totalPages={pagination.total_pages}
          hasPrev={pagination.has_prev}
          hasNext={pagination.has_next}
          onPrev={() => setPage((p) => Math.max(1, p - 1))}
          onNext={() => setPage((p) => p + 1)}
          disabled={isFetching}
          ariaLabel="صفحه‌بندی سفارش‌ها"
          className="mt-6"
          label={
            isFetching ? (
              <Loader2 className="inline size-4 animate-spin" />
            ) : undefined
          }
        />
      ) : null}
    </div>
  );
}
