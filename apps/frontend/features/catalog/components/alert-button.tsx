"use client"

import { useRouter, usePathname } from "next/navigation"
import { useSession } from "next-auth/react"
import { Bell, PackageCheck, TrendingDown, Loader2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useCreateAlert } from "@/lib/api/hooks"
import { ApiClientError } from "@/lib/api/store-client"

/**
 * AlertButton — lets a shopper subscribe to back-in-stock / price-drop alerts for
 * the selected variant. Restock-while-in-stock is rejected server-side (CONFLICT);
 * we surface that as a friendly "already available" message.
 */
export function AlertButton({ productVariantId }: { productVariantId?: number }) {
  const { status } = useSession()
  const router = useRouter()
  const pathname = usePathname()
  const create = useCreateAlert()

  function subscribe(type: "restock" | "price_drop") {
    if (status !== "authenticated") {
      toast.info("برای دریافت اعلان ابتدا وارد شوید")
      router.push(`/login?callbackUrl=${encodeURIComponent(pathname)}`)
      return
    }
    if (!productVariantId) return
    create.mutate(
      { product_variant_id: productVariantId, alert_type: type },
      {
        onSuccess: () =>
          toast.success(
            type === "restock"
              ? "هنگام موجود شدن به شما اطلاع می‌دهیم"
              : "هنگام کاهش قیمت به شما اطلاع می‌دهیم"
          ),
        onError: (e) =>
          toast.error(
            e instanceof ApiClientError && e.code === "CONFLICT"
              ? "این محصول هم‌اکنون موجود است"
              : "ثبت اعلان ناموفق بود"
          ),
      }
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="lg"
          className="h-12 cursor-pointer gap-2"
          disabled={!productVariantId || create.isPending}
          aria-label="دریافت اعلان"
        >
          {create.isPending ? <Loader2 className="animate-spin" /> : <Bell className="size-4" />}
          اعلان‌ها
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuItem onClick={() => subscribe("restock")} className="cursor-pointer gap-2">
          <PackageCheck className="size-4 text-primary" /> اطلاع از موجود شدن
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => subscribe("price_drop")} className="cursor-pointer gap-2">
          <TrendingDown className="size-4 text-primary" /> اطلاع از کاهش قیمت
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
