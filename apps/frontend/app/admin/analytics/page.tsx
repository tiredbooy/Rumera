import { Coins, ShoppingCart, Users, Percent } from "lucide-react"

import { requirePermission } from "@/lib/auth/session"
import { PERMISSIONS } from "@/lib/rbac/permissions"
import { formatPrice, faNum } from "@/lib/products"
import { dashboardSummary } from "@/lib/admin/data"
import { PageHeader } from "@/components/dashboard/page-header"
import { StatCard } from "@/components/dashboard/stat-card"
import { AnalyticsView } from "@/components/admin/analytics-view"

export default async function AdminAnalyticsPage() {
  await requirePermission(PERMISSIONS.ANALYTICS_READ)
  const s = dashboardSummary

  return (
    <>
      <PageHeader title="تحلیل‌ها" description="عملکرد فروش در ۳۰ روز گذشته." />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="درآمد کل"
          value={formatPrice(s.revenue30d)}
          icon={Coins}
          trend={{ value: s.revenue30dTrend, positive: true }}
        />
        <StatCard
          label="سفارش‌ها"
          value={faNum(s.orders30d)}
          icon={ShoppingCart}
          trend={{ value: s.orders30dTrend, positive: true }}
        />
        <StatCard
          label="مشتریان فعال"
          value={faNum(s.activeCustomers)}
          icon={Users}
          trend={{ value: s.activeCustomersTrend, positive: true }}
        />
        <StatCard
          label="نرخ تبدیل"
          value={s.conversionRate}
          icon={Percent}
          trend={{ value: s.conversionTrend, positive: false }}
        />
      </div>

      <AnalyticsView />
    </>
  )
}
