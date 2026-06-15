import Link from "next/link"
import { Coins, ShoppingCart, Users, TrendingUp, ArrowLeft, Boxes } from "lucide-react"

import { formatPrice, faNum } from "@/lib/products"
import {
  dashboardSummary,
  revenueSeries,
  ordersByStatus,
  recentOrders,
  lowStock,
} from "@/lib/admin/data"
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
import { FulfilmentBadge, StockBadge } from "@/components/admin/status-badge"
import { ChartCard, RevenueAreaChart, DonutChart, DonutLegend } from "@/components/admin/charts"

export default function AdminDashboard() {
  const s = dashboardSummary
  const totalOrders = ordersByStatus.reduce((a, b) => a + b.value, 0)

  return (
    <>
      <PageHeader title="داشبورد" description="نمای کلی عملکرد فروشگاه در یک نگاه." />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="درآمد امروز"
          value={formatPrice(s.revenueToday)}
          icon={Coins}
          trend={{ value: s.revenueTodayTrend, positive: true }}
          hint="نسبت به دیروز"
        />
        <StatCard
          label="سفارش‌های امروز"
          value={faNum(s.ordersToday)}
          icon={ShoppingCart}
          trend={{ value: s.ordersTodayTrend, positive: true }}
          hint="نسبت به دیروز"
        />
        <StatCard
          label="مشتریان جدید"
          value={faNum(s.newCustomers)}
          icon={Users}
          trend={{ value: s.newCustomersTrend, positive: false }}
          hint="این هفته"
        />
        <StatCard
          label="میانگین سبد"
          value={formatPrice(s.avgOrderValue)}
          icon={TrendingUp}
          trend={{ value: s.avgOrderValueTrend, positive: true }}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <ChartCard
          title="روند درآمد"
          description="۳۰ روز اخیر — تومان"
          className="lg:col-span-2"
          action={
            <Button variant="ghost" size="sm" asChild>
              <Link href="/admin/analytics">
                تحلیل کامل <ArrowLeft className="size-4" />
              </Link>
            </Button>
          }
        >
          <RevenueAreaChart data={revenueSeries} />
        </ChartCard>

        <ChartCard title="سفارش‌ها بر اساس وضعیت" description={`${faNum(totalOrders)} سفارش`}>
          <DonutChart
            data={ordersByStatus}
            centerValue={faNum(totalOrders)}
            centerLabel="سفارش"
          />
          <div className="mt-4">
            <DonutLegend data={ordersByStatus} />
          </div>
        </ChartCard>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-serif text-2xl">سفارش‌های اخیر</h2>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/admin/orders">
                مشاهدهٔ همه <ArrowLeft className="size-4" />
              </Link>
            </Button>
          </div>
          <div className="border-hairline overflow-hidden rounded-2xl bg-card ring-1 ring-foreground/5">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-start">شماره</TableHead>
                  <TableHead className="text-start">مشتری</TableHead>
                  <TableHead className="text-start">مبلغ</TableHead>
                  <TableHead className="text-start">وضعیت</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentOrders.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell className="font-medium">#{faNum(o.number)}</TableCell>
                    <TableCell>{o.customerName}</TableCell>
                    <TableCell className="font-medium">{formatPrice(o.total)}</TableCell>
                    <TableCell>
                      <FulfilmentBadge status={o.fulfilment} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>

        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-serif text-2xl">موجودی رو به اتمام</h2>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/admin/inventory">
                <Boxes className="size-4" /> انبار
              </Link>
            </Button>
          </div>
          <div className="border-hairline divide-y divide-border/60 overflow-hidden rounded-2xl bg-card ring-1 ring-foreground/5">
            {lowStock.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">
                موجودی همهٔ کالاها سالم است.
              </p>
            ) : (
              lowStock.map((r) => (
                <div key={r.product.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1 leading-tight">
                    <p className="truncate text-sm font-medium">{r.product.name}</p>
                    <p className="text-xs text-muted-foreground">
                      موجودی قابل فروش: {faNum(r.available)}
                    </p>
                  </div>
                  <StockBadge status={r.status} />
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </>
  )
}
