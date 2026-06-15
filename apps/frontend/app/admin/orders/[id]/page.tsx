import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowRight, MapPin, User, Check } from "lucide-react"

import { requirePermission } from "@/lib/auth/session"
import { PERMISSIONS } from "@/lib/rbac/permissions"
import { can } from "@/lib/rbac/can"
import { formatPrice, faNum } from "@/lib/products"
import { getOrder } from "@/lib/admin/data"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { PageHeader } from "@/components/dashboard/page-header"
import { PaymentBadge, FulfilmentBadge } from "@/components/admin/status-badge"
import { OrderActions } from "@/components/admin/order-actions"

export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await requirePermission(PERMISSIONS.ORDERS_READ)
  const { id } = await params
  const order = getOrder(id)
  if (!order) notFound()

  const canWrite = can(session, PERMISSIONS.ORDERS_WRITE)
  const canRefund = can(session, PERMISSIONS.ORDERS_REFUND)

  return (
    <>
      <PageHeader
        title={`سفارش #${faNum(order.number)}`}
        description={`ثبت‌شده در ${order.date}`}
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link href="/admin/orders">
              <ArrowRight className="size-4" /> بازگشت
            </Link>
          </Button>
        }
      />

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <PaymentBadge status={order.payment} />
          <FulfilmentBadge status={order.fulfilment} />
        </div>
        <OrderActions status={order.fulfilment} canWrite={canWrite} canRefund={canRefund} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="border-hairline overflow-hidden rounded-2xl bg-card ring-1 ring-foreground/5">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-start">محصول</TableHead>
                  <TableHead className="text-center">تعداد</TableHead>
                  <TableHead className="text-start">قیمت واحد</TableHead>
                  <TableHead className="text-end">جمع</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {order.lines.map((l) => (
                  <TableRow key={l.productId}>
                    <TableCell className="font-medium">{l.name}</TableCell>
                    <TableCell className="text-center tabular-nums">{faNum(l.qty)}</TableCell>
                    <TableCell className="text-muted-foreground">{formatPrice(l.price)}</TableCell>
                    <TableCell className="text-end font-medium">{formatPrice(l.price * l.qty)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <dl className="space-y-2 border-t border-border/60 p-5 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">جمع اقلام</dt>
                <dd>{formatPrice(order.subtotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">هزینهٔ ارسال</dt>
                <dd>{order.shipping ? formatPrice(order.shipping) : "رایگان"}</dd>
              </div>
              {order.discount ? (
                <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                  <dt>تخفیف</dt>
                  <dd>−{formatPrice(order.discount)}</dd>
                </div>
              ) : null}
              <div className="flex justify-between border-t border-border/60 pt-2 font-serif text-lg">
                <dt>مبلغ نهایی</dt>
                <dd className="text-foil">{formatPrice(order.total)}</dd>
              </div>
            </dl>
          </div>
        </div>

        <div className="flex flex-col gap-6">
          <div className="border-hairline rounded-2xl bg-card p-5 ring-1 ring-foreground/5">
            <div className="mb-3 flex items-center gap-2 text-sm font-medium">
              <User className="size-4 text-muted-foreground" /> مشتری
            </div>
            <p className="font-medium">{order.customerName}</p>
            <p className="text-xs text-muted-foreground" dir="ltr">{order.customerEmail}</p>
            <Button variant="outline" size="sm" className="mt-3 w-full" asChild>
              <Link href={`/admin/customers/${order.customerId}`}>مشاهدهٔ پرونده</Link>
            </Button>
          </div>

          <div className="border-hairline rounded-2xl bg-card p-5 ring-1 ring-foreground/5">
            <div className="mb-3 flex items-center gap-2 text-sm font-medium">
              <MapPin className="size-4 text-muted-foreground" /> نشانی ارسال
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">{order.address}</p>
          </div>

          <div className="border-hairline rounded-2xl bg-card p-5 ring-1 ring-foreground/5">
            <p className="mb-4 text-sm font-medium">روند سفارش</p>
            <ol className="relative space-y-5 ps-6">
              <span className="absolute inset-y-1 start-[7px] w-px bg-border" />
              {order.timeline.map((e, i) => (
                <li key={i} className="relative">
                  <span
                    className={cn(
                      "absolute -start-6 top-0.5 flex size-3.5 items-center justify-center rounded-full ring-2 ring-card",
                      e.done ? "bg-primary text-primary-foreground" : "bg-muted"
                    )}
                  >
                    {e.done ? <Check className="size-2.5" /> : null}
                  </span>
                  <p className={cn("text-sm", e.done ? "font-medium" : "text-muted-foreground")}>
                    {e.label}
                  </p>
                  {e.done ? (
                    <p className="text-xs text-muted-foreground" dir="ltr">{e.at}</p>
                  ) : null}
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </>
  )
}
