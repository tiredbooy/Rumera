import "server-only";

import Link from "next/link";
import { Package } from "lucide-react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AdminDataErrorState } from "@/features/dashboard/components/admin-data-error-state";
import { listAdminOrders } from "@/features/orders/api/admin";
import { OrderStatusBadge } from "@/features/orders/components/order-status-badge";
import { PAYMENT_FA } from "@/features/orders/labels";
import type { OrderListItem } from "@/features/orders/types";
import { ApiError } from "@/lib/api/errors";
import { faNum, formatPrice } from "@/lib/products";
import { faDate } from "@/lib/utils/date";

import { adminOrdersForUserHref } from "./customers-view";

/** Recent rows on the customer file; the full history is one link away. */
const RECENT_ORDERS = 5;

/** `orders: null` is "could not read" — an empty array is a customer with none. */
export type CustomerOrders = {
  orders: OrderListItem[] | null;
  total: number;
};

export async function loadCustomerOrders(
  userID: string,
): Promise<CustomerOrders> {
  try {
    const page = await listAdminOrders({
      user_uuid: userID,
      page: 1,
      limit: RECENT_ORDERS,
      sortBy: "created_at",
      orderBy: "desc",
    });
    return { orders: page.results, total: page.pagination.total_items };
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) throw error;
    // 403 lands here too: orders:read is a separate grant from customers:read,
    // so an operator who may open this file may legitimately not read orders.
    return { orders: null, total: 0 };
  }
}

/**
 * The customer's orders on the customer file (CF-3).
 *
 * This is the screen opened when a customer calls, and the first thing they ask
 * is what they ordered and what happened to it. The rows come from the admin
 * orders list filtered by the public customer id that CF-1 taught it to accept —
 * no second endpoint, and the same link the customers list already offers.
 */
export function CustomerOrdersPanel({
  userID,
  orders,
  total,
}: { userID: string } & CustomerOrders) {
  const allHref = adminOrdersForUserHref(userID);

  return (
    <section className="mt-6" aria-labelledby="customer-orders-title">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2
            id="customer-orders-title"
            className="flex items-center gap-2 font-serif text-lg"
          >
            <Package className="size-4.5 text-primary" aria-hidden />
            سفارش‌ها
          </h2>
          {orders && orders.length > 0 ? (
            <p className="mt-1 text-xs text-muted-foreground">
              {faNum(total)} سفارش ثبت شده؛ تازه‌ترین‌ها در ابتدای فهرست.
            </p>
          ) : null}
        </div>
        {allHref && orders && total > orders.length ? (
          <Link
            href={allHref}
            className="inline-flex min-h-11 items-center rounded-lg text-sm underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/40"
          >
            همهٔ سفارش‌های این مشتری
          </Link>
        ) : null}
      </div>

      {orders === null ? (
        <AdminDataErrorState
          title="فهرست سفارش‌ها در دسترس نیست"
          description="برای دیدن سفارش‌های این مشتری به دسترسی «مشاهدهٔ سفارش‌ها» نیاز است، یا دریافت فهرست ناموفق بوده است."
        />
      ) : orders.length === 0 ? (
        <div className="border-hairline flex flex-col items-center gap-2 rounded-2xl bg-card px-6 py-10 text-center ring-1 ring-foreground/[0.04]">
          <Package className="size-6 text-muted-foreground" aria-hidden />
          <p className="text-sm font-medium">هنوز سفارشی ثبت نشده است</p>
          <p className="text-xs text-muted-foreground">
            نخستین سفارش این مشتری پس از ثبت در همین بخش دیده می‌شود.
          </p>
        </div>
      ) : (
        <div className="border-hairline overflow-hidden rounded-2xl bg-card ring-1 ring-foreground/[0.04]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>شماره</TableHead>
                <TableHead>تاریخ</TableHead>
                <TableHead>وضعیت</TableHead>
                <TableHead>اقلام</TableHead>
                <TableHead>پرداخت</TableHead>
                <TableHead>مبلغ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((order) => (
                <TableRow key={order.id}>
                  <TableCell>
                    <Link
                      href={`/admin/orders/${order.id}`}
                      className="-m-1 inline-flex min-h-11 items-center rounded-lg p-1 font-medium tabular-nums underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/40"
                    >
                      #{faNum(order.id)}
                    </Link>
                  </TableCell>
                  <TableCell className="tabular-nums text-muted-foreground">
                    {faDate(order.created_at)}
                  </TableCell>
                  <TableCell>
                    <OrderStatusBadge status={order.status} />
                  </TableCell>
                  <TableCell className="tabular-nums text-muted-foreground">
                    {faNum(order.item_count)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {PAYMENT_FA[order.payment_method] ?? order.payment_method}
                  </TableCell>
                  <TableCell className="font-medium tabular-nums">
                    {formatPrice(order.total_amount)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </section>
  );
}
