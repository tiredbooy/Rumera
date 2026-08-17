"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Gift } from "lucide-react";

import { Button } from "@/components/ui/button";
import { AdminPage } from "@/features/dashboard/components/admin-page";
import { useAdminPayments } from "@/features/payments/hooks";
import type { PaymentTransactionListQuery } from "@/features/payments/types";

import {
  PaymentListFilters,
  paymentSort,
  paymentStatus,
  positiveInteger,
} from "./payment-list-filters";
import { PaymentListResults } from "./payment-list-results";
import { PaymentLookup } from "./payment-lookup";

const PAGE_SIZE = 20;

export function PaymentsBoard() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const page = positiveInteger(searchParams.get("page")) ?? 1;
  const status = paymentStatus(searchParams.get("status"));
  const sort = paymentSort(searchParams.get("sort"));
  const orderID = positiveInteger(searchParams.get("order"));
  const userID = positiveInteger(searchParams.get("user"));

  const updateURL = React.useCallback(
    (
      updates: Record<string, string | undefined>,
      resetPage = false,
      replace = false,
    ) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value) params.set(key, value);
        else params.delete(key);
      }
      if (resetPage) params.delete("page");
      const suffix = params.toString();
      const href = suffix ? `${pathname}?${suffix}` : pathname;
      if (replace) router.replace(href);
      else router.push(href);
    },
    [pathname, router, searchParams],
  );

  const listQuery: PaymentTransactionListQuery = {
    page,
    limit: PAGE_SIZE,
    status,
    order_id: orderID,
    user_id: userID,
    ...(sort === "oldest"
      ? { sortBy: "created_at", orderBy: "asc" }
      : sort === "amount_desc"
        ? { sortBy: "amount", orderBy: "desc" }
        : sort === "amount_asc"
          ? { sortBy: "amount", orderBy: "asc" }
          : { sortBy: "created_at", orderBy: "desc" }),
  };
  const payments = useAdminPayments(listQuery);
  const outOfRangePage = Boolean(
    payments.data &&
    payments.data.results.length === 0 &&
    payments.data.pagination.total_items > 0 &&
    page > payments.data.pagination.total_pages,
  );

  React.useEffect(() => {
    if (!outOfRangePage || !payments.data) return;
    const lastPage = payments.data.pagination.total_pages;
    updateURL(
      { page: lastPage > 1 ? String(lastPage) : undefined },
      false,
      true,
    );
  }, [outOfRangePage, payments.data, updateURL]);

  const hasFilters = Boolean(status || orderID || userID || sort !== "newest");

  return (
    <AdminPage
      title="تراکنش‌های پرداخت"
      description="وضعیت پرداخت‌ها را بررسی و شناسه‌های درگاه را با سفارش‌های ثبت‌شده تطبیق دهید. این بخش عمداً فقط خواندنی است. فیلترها روی دادهٔ واقعی پرداخت اعمال می‌شوند؛ وضعیت و ترتیب بی‌درنگ، شناسه‌ها با «اعمال شناسه‌ها»."
      action={
        <Button variant="outline" size="sm" asChild>
          <Link href="/admin/gift-cards">
            <Gift className="size-4" aria-hidden /> صدور کارت هدیه
          </Link>
        </Button>
      }
    >
      <PaymentLookup />

      {/* Two panels on one page: the ledger keeps its own filter bar and pager
          directly above/below itself rather than in the page-level slots. */}
      <section aria-label="دفتر تراکنش‌ها" className="mt-6">
        <PaymentListFilters
          orderID={orderID}
          userID={userID}
          status={status}
          sort={sort}
          hasFilters={hasFilters}
          onUpdate={(updates) => updateURL(updates, true)}
          onReset={() => router.push(pathname)}
        />
        <PaymentListResults
          payments={payments}
          page={page}
          hasFilters={hasFilters}
          outOfRangePage={outOfRangePage}
          onPage={(nextPage) =>
            updateURL({ page: nextPage ? String(nextPage) : undefined })
          }
        />
      </section>
    </AdminPage>
  );
}
