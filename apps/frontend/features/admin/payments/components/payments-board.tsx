"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Gift } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useFilterParams } from "@/features/dashboard/components/admin-filter-controls";
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
  const searchParams = useSearchParams();
  const setFilters = useFilterParams();
  const page = positiveInteger(searchParams.get("page")) ?? 1;
  const status = paymentStatus(searchParams.get("status"));
  const sort = paymentSort(searchParams.get("sort"));
  const orderID = positiveInteger(searchParams.get("order"));
  const userID = positiveInteger(searchParams.get("user"));

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
    setFilters({ page: lastPage > 1 ? String(lastPage) : undefined });
  }, [outOfRangePage, payments.data, setFilters]);

  const hasFilters = Boolean(status || orderID || userID || sort !== "newest");

  return (
    <AdminPage
      title="تراکنش‌های پرداخت"
      description="وضعیت پرداخت‌ها را بررسی و شناسه‌های درگاه را با سفارش‌های ثبت‌شده تطبیق دهید. این بخش عمداً فقط خواندنی است. فیلترها روی دادهٔ واقعی پرداخت اعمال می‌شوند و بدون دکمهٔ اعمال اثر می‌گذارند."
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
        />
        <PaymentListResults
          payments={payments}
          page={page}
          hasFilters={hasFilters}
          outOfRangePage={outOfRangePage}
          onPage={(nextPage) =>
            setFilters({ page: nextPage ? String(nextPage) : undefined })
          }
        />
      </section>
    </AdminPage>
  );
}
