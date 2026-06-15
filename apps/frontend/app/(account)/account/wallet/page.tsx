import { Wallet, Plus } from "lucide-react"

import { formatPrice } from "@/lib/products"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/dashboard/page-header"
import { Placeholder } from "@/components/dashboard/placeholder"
import { GiftCardRedeem } from "@/components/wallet/gift-card-redeem"

export default function AccountWalletPage() {
  return (
    <>
      <PageHeader
        title="کیف پول"
        description="موجودی و تراکنش‌های کیف پول رومرا."
        actions={
          <Button size="sm">
            <Plus className="size-4" /> افزایش موجودی
          </Button>
        }
      />

      <div className="border-hairline mb-6 overflow-hidden rounded-3xl bg-gradient-to-bl from-primary/15 to-card p-7 ring-1 ring-foreground/5">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Wallet className="size-4" /> موجودی فعلی
        </div>
        <p className="mt-2 font-serif text-4xl text-foil">{formatPrice(1_250_000)}</p>
      </div>

      <div className="mb-6">
        <GiftCardRedeem />
      </div>

      <Placeholder
        icon={Wallet}
        title="تراکنشی برای نمایش نیست"
        description="با اتصال به /api/v1/wallet موجودی واقعی و تاریخچهٔ تراکنش‌ها اینجا نمایش داده می‌شود."
      />
    </>
  )
}
