"use client"

import Link from "next/link"
import { Loader2, Eye, ShoppingBag } from "lucide-react"

import { faNum, formatPrice } from "@/lib/products"
import { ORDER_STATUS_FA, faDate } from "@/lib/catalog/labels"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Placeholder } from "@/components/dashboard/placeholder"
import { useOrders } from "@/lib/api/hooks"

export function OrdersList() {
  const { data, isLoading, isError } = useOrders()

  if (isLoading) {
    return (
      <div className="flex justify-center py-12 text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
      </div>
    )
  }

  if (isError || !data || data.results.length === 0) {
    return (
      <Placeholder
        icon={ShoppingBag}
        title="هنوز سفارشی ثبت نکرده‌اید"
        description="پس از اولین خرید، سفارش‌های شما اینجا نمایش داده می‌شوند."
      >
        <Button asChild>
          <Link href="/products">شروع خرید</Link>
        </Button>
      </Placeholder>
    )
  }

  return (
    <div className="border-hairline overflow-hidden rounded-2xl bg-card ring-1 ring-foreground/5">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-start">شماره</TableHead>
            <TableHead className="text-start">تاریخ</TableHead>
            <TableHead className="text-start">مبلغ</TableHead>
            <TableHead className="text-start">وضعیت</TableHead>
            <TableHead className="text-end">عملیات</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.results.map((order) => (
            <TableRow key={order.id}>
              <TableCell className="font-medium">#{faNum(order.id)}</TableCell>
              <TableCell className="text-muted-foreground">{faDate(order.created_at)}</TableCell>
              <TableCell className="font-medium">{formatPrice(order.total_amount)}</TableCell>
              <TableCell>
                <Badge variant={order.status === "cancelled" ? "destructive" : "secondary"}>
                  {ORDER_STATUS_FA[order.status] ?? order.status}
                </Badge>
              </TableCell>
              <TableCell className="text-end">
                <Button variant="ghost" size="icon" asChild aria-label="مشاهده">
                  <Link href={`/account/orders/${order.id}`}>
                    <Eye className="size-4" />
                  </Link>
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
