import Link from "next/link"
import { ShoppingBag, Wallet, Heart, MapPin, ArrowLeft } from "lucide-react"

import { getSession } from "@/lib/auth/session"
import { faNum, formatPrice } from "@/lib/products"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/dashboard/page-header"
import { StatCard } from "@/components/dashboard/stat-card"
import { Placeholder } from "@/components/dashboard/placeholder"

export default async function AccountOverview() {
  const session = await getSession()
  const firstName = session?.user?.name?.split(" ")[0] ?? "دوست عزیز"

  return (
    <>
      <PageHeader
        title={`سلام، ${firstName} 👋`}
        description="خلاصه‌ای از حساب، سفارش‌ها و کیف پول شما."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="سفارش‌های فعال" value={faNum(2)} icon={ShoppingBag} hint="در حال پردازش" />
        <StatCard label="موجودی کیف پول" value={formatPrice(1_250_000)} icon={Wallet} />
        <StatCard label="علاقه‌مندی‌ها" value={faNum(8)} icon={Heart} />
        <StatCard label="آدرس‌ها" value={faNum(1)} icon={MapPin} />
      </div>

      <div className="mt-8 flex items-center justify-between">
        <h2 className="font-serif text-2xl">سفارش‌های اخیر</h2>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/account/orders">
            مشاهدهٔ همه <ArrowLeft />
          </Link>
        </Button>
      </div>
      <div className="mt-4">
        <Placeholder
          icon={ShoppingBag}
          title="هنوز سفارشی برای نمایش نیست"
          description="پس از اتصال به سرویس سفارش‌ها، آخرین سفارش‌های شما اینجا نمایش داده می‌شود."
        >
          <Button asChild>
            <Link href="/products">شروع خرید</Link>
          </Button>
        </Placeholder>
      </div>
    </>
  )
}
