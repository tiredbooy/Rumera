import { TrendingUp, ShoppingCart, Users, Coins, ClipboardList, Boxes } from "lucide-react"

import { formatPrice, faNum } from "@/lib/products"
import { PageHeader } from "@/components/dashboard/page-header"
import { StatCard } from "@/components/dashboard/stat-card"
import { Placeholder } from "@/components/dashboard/placeholder"

export default function AdminDashboard() {
  return (
    <>
      <PageHeader
        title="داشبورد"
        description="نمای کلی عملکرد فروشگاه در یک نگاه."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="درآمد امروز"
          value={formatPrice(48_600_000)}
          icon={Coins}
          trend={{ value: "+۱۲٪", positive: true }}
          hint="نسبت به دیروز"
        />
        <StatCard
          label="سفارش‌های امروز"
          value={faNum(37)}
          icon={ShoppingCart}
          trend={{ value: "+۸٪", positive: true }}
          hint="نسبت به دیروز"
        />
        <StatCard
          label="مشتریان جدید"
          value={faNum(14)}
          icon={Users}
          trend={{ value: "−۳٪", positive: false }}
          hint="این هفته"
        />
        <StatCard
          label="میانگین سبد"
          value={formatPrice(6_400_000)}
          icon={TrendingUp}
          trend={{ value: "+۵٪", positive: true }}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div>
          <h2 className="mb-3 font-serif text-2xl">سفارش‌های اخیر</h2>
          <Placeholder
            icon={ClipboardList}
            title="در انتظار اتصال به سرویس سفارش‌ها"
            description="GET /api/v1/admin/orders — آخرین سفارش‌ها اینجا در یک جدول زنده نمایش داده می‌شود."
          />
        </div>
        <div>
          <h2 className="mb-3 font-serif text-2xl">موجودی رو به اتمام</h2>
          <Placeholder
            icon={Boxes}
            title="در انتظار اتصال به سرویس موجودی"
            description="GET /api/v1/inventory — کالاهای با موجودی کم اینجا هشدار داده می‌شوند."
          />
        </div>
      </div>
    </>
  )
}
