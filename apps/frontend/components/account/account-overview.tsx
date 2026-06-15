"use client"

import Link from "next/link"
import {
  ShoppingBag,
  Wallet,
  Award,
  MapPin,
  ArrowLeft,
  Sparkles,
  MapPinOff,
} from "lucide-react"

import { faNum, formatPrice } from "@/lib/products"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Progress } from "@/components/ui/progress"
import { StatCard } from "@/components/dashboard/stat-card"
import { SmartImage } from "@/components/smart-image"
import {
  useOrders,
  useAddresses,
  useLoyalty,
  useTasteProfile,
} from "@/lib/api/hooks"
import { useWallet, useRecommendations } from "@/lib/api/account-hooks"
import type { OrderStatus } from "@/lib/catalog/types"
import { AccountSection } from "./account-section"
import { OrderCard } from "./order-card"
import { EmptyState } from "./empty-state"

const tierFa: Record<string, string> = {
  bronze: "برنزی",
  silver: "نقره‌ای",
  gold: "طلایی",
  cellar: "سرداب",
}

/** Statuses we treat as "in flight" for the active-orders KPI. */
const ACTIVE_STATUSES: OrderStatus[] = [
  "pending",
  "paid",
  "processing",
  "ready_to_ship",
  "shipped",
  "out_for_delivery",
]

function KpiSkeleton() {
  return <Skeleton className="h-[116px] rounded-2xl" />
}

export function AccountOverview() {
  const orders = useOrders()
  const addresses = useAddresses()
  const wallet = useWallet()
  const loyalty = useLoyalty()
  const taste = useTasteProfile()
  const recs = useRecommendations()

  const results = orders.data?.results ?? []
  const activeCount = results.filter((o) => ACTIVE_STATUSES.includes(o.status)).length
  const recentOrders = results.slice(0, 3)

  const loyaltyProgress =
    loyalty.data && loyalty.data.next_tier && loyalty.data.points_to_next > 0
      ? Math.min(
          100,
          Math.round(
            (loyalty.data.lifetime_points /
              (loyalty.data.lifetime_points + loyalty.data.points_to_next)) *
              100
          )
        )
      : 100

  const needsAddress = addresses.isSuccess && (addresses.data?.length ?? 0) === 0
  const needsTaste = taste.isSuccess && (taste.data?.categories?.length ?? 0) === 0

  return (
    <>
      {/* KPI row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {orders.isLoading ? (
          <KpiSkeleton />
        ) : (
          <StatCard
            label="سفارش‌های فعال"
            value={faNum(activeCount)}
            icon={ShoppingBag}
            hint="در حال پردازش"
          />
        )}
        {wallet.isLoading ? (
          <KpiSkeleton />
        ) : (
          <StatCard
            label="موجودی کیف پول"
            value={wallet.data ? formatPrice(wallet.data.balance) : "—"}
            icon={Wallet}
          />
        )}
        {loyalty.isLoading ? (
          <KpiSkeleton />
        ) : (
          <StatCard
            label="امتیاز باشگاه"
            value={loyalty.data ? faNum(loyalty.data.points_balance) : "—"}
            icon={Award}
            hint={loyalty.data ? `سطح ${tierFa[loyalty.data.tier] ?? loyalty.data.tier}` : undefined}
          />
        )}
        {addresses.isLoading ? (
          <KpiSkeleton />
        ) : (
          <StatCard
            label="آدرس‌ها"
            value={faNum(addresses.data?.length ?? 0)}
            icon={MapPin}
          />
        )}
      </div>

      {/* Profile-completeness nudges */}
      {needsAddress || needsTaste ? (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {needsAddress ? (
            <div className="border-hairline flex items-center justify-between gap-3 rounded-2xl bg-card p-5 ring-1 ring-foreground/5">
              <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <MapPinOff className="size-5" />
                </span>
                <div className="leading-tight">
                  <p className="text-sm font-medium">یک آدرس تحویل اضافه کنید</p>
                  <p className="text-xs text-muted-foreground">برای تسریع در ثبت سفارش‌های بعدی.</p>
                </div>
              </div>
              <Button size="sm" variant="outline" asChild>
                <Link href="/account/addresses">افزودن</Link>
              </Button>
            </div>
          ) : null}
          {needsTaste ? (
            <div className="border-hairline flex items-center justify-between gap-3 rounded-2xl bg-card p-5 ring-1 ring-foreground/5">
              <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Sparkles className="size-5" />
                </span>
                <div className="leading-tight">
                  <p className="text-sm font-medium">سلیقهٔ خود را مشخص کنید</p>
                  <p className="text-xs text-muted-foreground">تا پیشنهادها برایتان شخصی شوند.</p>
                </div>
              </div>
              <Button size="sm" variant="outline" asChild>
                <Link href="/account/taste">شروع</Link>
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Recent orders */}
      <div className="mt-8 flex items-center justify-between">
        <h2 className="font-serif text-2xl">سفارش‌های اخیر</h2>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/account/orders">
            مشاهدهٔ همه <ArrowLeft />
          </Link>
        </Button>
      </div>
      <div className="mt-4">
        {orders.isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Skeleton className="h-44 rounded-2xl" />
            <Skeleton className="h-44 rounded-2xl" />
            <Skeleton className="h-44 rounded-2xl" />
          </div>
        ) : orders.isError ? (
          <div className="border-hairline rounded-2xl bg-card p-6 text-sm text-muted-foreground ring-1 ring-foreground/5">
            خطا در دریافت سفارش‌ها.{" "}
            <button
              type="button"
              onClick={() => orders.refetch()}
              className="cursor-pointer font-medium text-primary hover:underline"
            >
              تلاش دوباره
            </button>
          </div>
        ) : recentOrders.length === 0 ? (
          <EmptyState
            icon={ShoppingBag}
            title="هنوز سفارشی برای نمایش نیست"
            description="پس از اولین خرید، آخرین سفارش‌های شما اینجا نمایش داده می‌شود."
            actionLabel="شروع خرید"
            actionHref="/products"
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {recentOrders.map((order) => (
              <OrderCard key={order.id} order={order} />
            ))}
          </div>
        )}
      </div>

      {/* Loyalty snapshot */}
      {loyalty.data ? (
        <div className="mt-8">
          <AccountSection
            title="باشگاه مشتریان"
            action={
              <Button variant="ghost" size="sm" asChild>
                <Link href="/account/rewards">
                  جزئیات <ArrowLeft />
                </Link>
              </Button>
            }
          >
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-sm text-muted-foreground">امتیاز قابل استفاده</p>
                <p className="mt-1 font-serif text-3xl text-foil">
                  {faNum(loyalty.data.points_balance)}
                </p>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/15 px-3 py-1.5 text-sm font-medium text-primary">
                <Award className="size-4" /> سطح {tierFa[loyalty.data.tier] ?? loyalty.data.tier}
              </span>
            </div>
            {loyalty.data.next_tier ? (
              <div className="mt-5">
                <div className="mb-1.5 flex items-center justify-between text-xs text-muted-foreground">
                  <span>تا سطح {tierFa[loyalty.data.next_tier] ?? loyalty.data.next_tier}</span>
                  <span>{faNum(loyalty.data.points_to_next)} امتیاز دیگر</span>
                </div>
                <Progress value={loyaltyProgress} />
              </div>
            ) : null}
          </AccountSection>
        </div>
      ) : null}

      {/* Recommendations */}
      {recs.isLoading ? (
        <div className="mt-8">
          <h2 className="font-serif text-2xl">بر اساس سلیقهٔ شما</h2>
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="aspect-4/5 rounded-2xl" />
            ))}
          </div>
        </div>
      ) : recs.data && recs.data.length > 0 ? (
        <div className="mt-8">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-serif text-2xl">
              <Sparkles className="size-5 text-primary" /> بر اساس سلیقهٔ شما
            </h2>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {recs.data.slice(0, 4).map((p) => (
              <Link
                key={p.id}
                href={`/products/${p.slug}`}
                className="group/rec border-hairline overflow-hidden rounded-2xl bg-card ring-1 ring-foreground/5 transition-colors hover:ring-primary/30"
              >
                <div className="relative aspect-4/5 overflow-hidden">
                  <SmartImage
                    src={p.image_url}
                    alt={p.title}
                    sizes="(max-width: 640px) 50vw, 25vw"
                    monogram={p.title.charAt(0)}
                    label={p.brand}
                    fallbackClassName="from-accent/40 via-card to-secondary"
                  />
                </div>
                <div className="p-3">
                  <p className="line-clamp-1 font-serif text-sm leading-tight transition-colors group-hover/rec:text-primary">
                    {p.title}
                  </p>
                  <p className="mt-1 font-serif text-base text-foreground">
                    {formatPrice(p.min_price)}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </>
  )
}
