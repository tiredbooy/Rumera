import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowRight, ShoppingBag, Coins, TrendingUp, Wallet } from "lucide-react"

import { requirePermission } from "@/lib/auth/session"
import { PERMISSIONS } from "@/lib/rbac/permissions"
import { can } from "@/lib/rbac/can"
import { formatPrice, faNum } from "@/lib/products"
import { getCustomer, ordersForCustomer, TIER_LABELS } from "@/lib/admin/data"
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
import { StatCard } from "@/components/dashboard/stat-card"
import {
  CustomerBadge,
  PaymentBadge,
  FulfilmentBadge,
} from "@/components/admin/status-badge"
import { CustomerActions } from "@/components/admin/customer-actions"

export default async function AdminCustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await requirePermission(PERMISSIONS.CUSTOMERS_READ)
  const { id } = await params
  const customer = getCustomer(id)
  if (!customer) notFound()

  const orders = ordersForCustomer(customer.id)
  const avgOrder = customer.ordersCount ? Math.round(customer.ltv / customer.ordersCount) : 0
  const canWrite = can(session, PERMISSIONS.CUSTOMERS_WRITE)
  const canBan = can(session, PERMISSIONS.CUSTOMERS_BAN)

  return (
    <>
      <PageHeader
        eyebrow={
          <nav className="flex items-center gap-1.5 text-xs text-muted-foreground" aria-label="مسیر">
            <Link href="/admin/customers" className="transition-colors hover:text-foreground">
              مشتریان
            </Link>
            <span aria-hidden>/</span>
            <span className="text-foreground">{customer.name}</span>
          </nav>
        }
        title={customer.name}
        description={customer.email}
        actions={
          <div className="flex items-center gap-2">
            <CustomerActions
              name={customer.name}
              status={customer.status}
              canWrite={canWrite}
              canBan={canBan}
            />
            <Button variant="outline" size="sm" asChild>
              <Link href="/admin/customers">
                <ArrowRight className="size-4" /> بازگشت
              </Link>
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="ارزش کل" value={formatPrice(customer.ltv)} icon={Coins} />
        <StatCard label="سفارش‌ها" value={faNum(customer.ordersCount)} icon={ShoppingBag} />
        <StatCard label="میانگین سبد" value={formatPrice(avgOrder)} icon={TrendingUp} />
        <StatCard label="کیف پول" value={formatPrice(customer.walletBalance)} icon={Wallet} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <h2 className="mb-3 font-serif text-lg">تاریخچهٔ سفارش‌ها</h2>
          <div className="border-hairline overflow-hidden rounded-2xl bg-card ring-1 ring-foreground/[0.04]">
            {orders.length === 0 ? (
              <p className="p-8 text-center text-sm text-muted-foreground">
                این مشتری هنوز سفارشی ثبت نکرده است.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-border/60 bg-muted/30 hover:bg-muted/30">
                    <TableHead className="h-10 text-xs font-medium text-muted-foreground">شماره</TableHead>
                    <TableHead className="h-10 text-xs font-medium text-muted-foreground">تاریخ</TableHead>
                    <TableHead className="h-10 text-xs font-medium text-muted-foreground">مبلغ</TableHead>
                    <TableHead className="h-10 text-xs font-medium text-muted-foreground">پرداخت</TableHead>
                    <TableHead className="h-10 text-end text-xs font-medium text-muted-foreground">ارسال</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((o) => (
                    <TableRow key={o.id} className="cursor-pointer border-border/40">
                      <TableCell className="font-medium">
                        <Link href={`/admin/orders/${o.id}`}>#{faNum(o.number)}</Link>
                      </TableCell>
                      <TableCell className="text-muted-foreground" dir="ltr">{o.date}</TableCell>
                      <TableCell className="font-medium">{formatPrice(o.total)}</TableCell>
                      <TableCell><PaymentBadge status={o.payment} /></TableCell>
                      <TableCell className="text-end"><FulfilmentBadge status={o.fulfilment} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </div>

        <div className="border-hairline h-fit rounded-2xl bg-card p-5 ring-1 ring-foreground/[0.04]">
          <p className="mb-4 font-serif text-base">مشخصات</p>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">وضعیت</dt>
              <dd><CustomerBadge status={customer.status} /></dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">سطح باشگاه</dt>
              <dd className="font-medium">{TIER_LABELS[customer.tier]}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">تلفن</dt>
              <dd className="tabular-nums" dir="ltr">{customer.phone}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">شهر</dt>
              <dd>{customer.city}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">تاریخ عضویت</dt>
              <dd dir="ltr">{customer.joined}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">آخرین بازدید</dt>
              <dd>{customer.lastSeen}</dd>
            </div>
          </dl>
        </div>
      </div>
    </>
  )
}
