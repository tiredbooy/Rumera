"use client";

import { useRouter, usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { Bell, PackageCheck, TrendingDown, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCreateProductAlert } from "@/features/product-alerts/hooks";
import { stashAlertIntent } from "@/features/product-alerts/pending-alert";
import type { ProductAlertType } from "@/features/product-alerts/types";
import { ApiClientError } from "@/lib/api/store-client";
import { cn } from "@/lib/utils";

/**
 * AlertButton — lets a shopper subscribe to back-in-stock / price-drop alerts for
 * the selected variant. Restock-while-in-stock is rejected server-side (CONFLICT);
 * we surface that as a friendly "already available" message.
 */
export function AlertButton({
  productVariantId,
  isAvailable,
  className,
  layout = "inline",
}: {
  productVariantId?: number;
  isAvailable: boolean;
  className?: string;
  /** `bar` is the compact sticky CTA — restock only. */
  layout?: "inline" | "bar";
}) {
  const { status } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const create = useCreateProductAlert();

  function subscribe(type: ProductAlertType) {
    if (status !== "authenticated") {
      if (productVariantId) {
        stashAlertIntent({
          product_variant_id: productVariantId,
          alert_type: type,
        });
      }
      toast.info("برای دریافت اعلان ابتدا وارد شوید");
      const callbackUrl =
        typeof window === "undefined"
          ? pathname
          : `${window.location.pathname}${window.location.search}${window.location.hash}`;
      router.push(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
      return;
    }
    if (!productVariantId) return;
    create.mutate(
      { product_variant_id: productVariantId, alert_type: type },
      {
        onSuccess: () =>
          toast.success(
            type === "restock"
              ? "هنگام موجود شدن به شما اطلاع می‌دهیم"
              : "هنگام کاهش قیمت به شما اطلاع می‌دهیم",
          ),
        onError: (e) =>
          toast.error(
            e instanceof ApiClientError && e.code === "CONFLICT"
              ? "این محصول هم‌اکنون موجود است"
              : "ثبت اعلان ناموفق بود",
          ),
      },
    );
  }

  const pending = create.isPending;
  const disabled = !productVariantId || pending;

  if (!isAvailable) {
    return (
      <div className={cn("flex min-w-0 items-center gap-2", className)}>
        <Button
          size="lg"
          className="h-12 min-w-0 flex-1 cursor-pointer gap-2"
          disabled={disabled}
          onClick={() => subscribe("restock")}
        >
          {pending ? (
            <Loader2 className="animate-spin" />
          ) : (
            <PackageCheck className="size-4" />
          )}
          اطلاع از موجود شدن
        </Button>
        {layout === "inline" ? (
          <Button
            variant="outline"
            size="lg"
            className="h-12 shrink-0 cursor-pointer gap-2"
            disabled={disabled}
            onClick={() => subscribe("price_drop")}
            aria-label="اطلاع از کاهش قیمت"
          >
            <TrendingDown className="size-4" />
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="lg"
          className="h-12 cursor-pointer gap-2"
          disabled={disabled}
          aria-label="دریافت اعلان"
        >
          {pending ? (
            <Loader2 className="animate-spin" />
          ) : (
            <Bell className="size-4" />
          )}
          اعلان‌ها
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuItem
          onClick={() => subscribe("price_drop")}
          className="cursor-pointer gap-2"
        >
          <TrendingDown className="size-4 text-primary" /> اطلاع از کاهش قیمت
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
