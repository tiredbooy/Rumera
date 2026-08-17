import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { formatPrice, faNum } from "@/lib/products";
import { faDate } from "@/lib/utils/date";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { OrderStatusBadge } from "@/features/orders/components/order-status-badge";
import { listAdminOrders } from "@/features/orders/api/admin";

import { can } from "@/lib/rbac/can";
import { PERMISSIONS, type Permission } from "@/lib/rbac/permissions";

import { AnalyticsErrorState } from "./AnalyticsErrorState";

export async function RecentOrdersTable({
  permissions,
}: {
  permissions: Permission[];
}) {
  if (!can({ permissions }, PERMISSIONS.ORDERS_READ)) return null;

  let result = null;
  let error = false;

  try {
    result = await listAdminOrders({
      limit: 10,
      sortBy: "created_at",
      orderBy: "desc",
    });
  } catch {
    error = true;
  }

  const recentOrders = result?.results ?? [];

  return (
    <>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-serif text-lg">سفارش‌های اخیر</h2>
        <Button
          variant="ghost"
          size="sm"
          className="gap-1 text-muted-foreground"
          asChild
        >
          <Link href="/admin/orders">
            مشاهدهٔ همه <ArrowLeft className="size-4" />
          </Link>
        </Button>
      </div>
      <div className="border-hairline overflow-hidden rounded-2xl bg-card ring-1 ring-foreground/[0.04]">
        <Table>
          <TableHeader>
            <TableRow className="border-border/60 bg-muted/30 hover:bg-muted/30">
              <TableHead className="h-10 text-xs font-medium text-muted-foreground">
                شماره
              </TableHead>
              <TableHead className="h-10 text-xs font-medium text-muted-foreground">
                تاریخ
              </TableHead>
              <TableHead className="h-10 text-xs font-medium text-muted-foreground">
                مبلغ
              </TableHead>
              <TableHead className="h-10 text-xs font-medium text-muted-foreground">
                وضعیت
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {error ? (
              <TableRow className="hover:bg-transparent">
                <TableCell
                  colSpan={4}
                  className="h-32"
                >
                  <AnalyticsErrorState>
                    خطا در دریافت سفارش‌ها
                  </AnalyticsErrorState>
                </TableCell>
              </TableRow>
            ) : recentOrders.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell
                  colSpan={4}
                  className="h-32 text-center text-sm text-muted-foreground"
                >
                  سفارشی یافت نشد.
                </TableCell>
              </TableRow>
            ) : (
              recentOrders.map((o) => (
                <TableRow key={o.id} className="border-border/40">
                  <TableCell className="font-medium tabular-nums" dir="ltr">
                    #{faNum(o.id)}
                  </TableCell>
                  <TableCell className="text-muted-foreground" dir="ltr">
                    {faDate(o.created_at)}
                  </TableCell>
                  <TableCell className="font-medium tabular-nums">
                    {formatPrice(o.total_amount)}
                  </TableCell>
                  <TableCell>
                    <OrderStatusBadge status={o.status} />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
