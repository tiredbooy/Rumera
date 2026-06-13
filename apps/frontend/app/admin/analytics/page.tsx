import { Coins, ShoppingCart, Users, Percent, LineChart } from "lucide-react"

import { requirePermission } from "@/lib/auth/session"
import { PERMISSIONS } from "@/lib/rbac/permissions"
import { formatPrice, faNum } from "@/lib/products"
import { PageHeader } from "@/components/dashboard/page-header"
import { StatCard } from "@/components/dashboard/stat-card"
import { Placeholder } from "@/components/dashboard/placeholder"

export default async function AdminAnalyticsPage() {
  await requirePermission(PERMISSIONS.ANALYTICS_READ)

  return (
    <>
      <PageHeader title="تحلیل‌ها" description="عملکرد فروش در ۳۰ روز گذشته." />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="درآمد کل" value={formatPrice(1_284_000_000)} icon={Coins} trend={{ value: "+۱۸٪", positive: true }} />
        <StatCard label="سفارش‌ها" value={faNum(948)} icon={ShoppingCart} trend={{ value: "+۹٪", positive: true }} />
        <StatCard label="مشتریان فعال" value={faNum(412)} icon={Users} trend={{ value: "+۴٪", positive: true }} />
        <StatCard label="نرخ تبدیل" value="٪۳٫۲" icon={Percent} trend={{ value: "−۱٪", positive: false }} />
      </div>

      <div className="mt-6">
        <Placeholder
          icon={LineChart}
          title="نمودار فروش در انتظار اتصال به سرویس"
          description="GET /api/v1/analytics — با اتصال به سرویس تحلیل‌ها، نمودار درآمد و سفارش‌ها (recharts) اینجا رسم می‌شود."
        />
      </div>
    </>
  )
}
