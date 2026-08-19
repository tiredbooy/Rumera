import { Skeleton } from "@/components/ui/skeleton";
import {
  PRODUCT_CARD_GRID_CLASS,
  PRODUCT_CARD_MEDIA_FRAME_CLASS,
} from "@/features/catalog/products/components/product-card";
import { cn } from "@/lib/utils";

/**
 * Placeholder card, block for block the shape of {@link ProductCard}: same
 * media frame, same `min-h-*` floors on the meta row, title, tag row and price
 * footer. A fallback that is a different height than what replaces it trades a
 * blocking render for a layout shift, which is the worse of the two.
 */
function ProductCardSkeleton() {
  return (
    <div className="border-hairline shadow-e2 flex h-full min-w-0 flex-col overflow-hidden rounded-[min(var(--radius-4xl),24px)] bg-card ring-1 ring-foreground/5">
      <div className={PRODUCT_CARD_MEDIA_FRAME_CLASS}>
        <Skeleton className="absolute inset-0 rounded-none" />
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-0 p-4 sm:p-5">
        {/* برند + وضعیت موجودی */}
        <div className="flex min-h-6 min-w-0 items-center justify-between gap-2">
          <Skeleton className="h-3.5 w-20 rounded-full" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>

        {/* عنوان دو خطی */}
        <div className="mt-2.5 flex min-h-[2.75rem] flex-col justify-center gap-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>

        {/* برچسب‌ها */}
        <div className="mt-2.5 flex min-h-7 items-center gap-1.5">
          <Skeleton className="h-6 w-20 rounded-full" />
          <Skeleton className="h-6 w-14 rounded-full" />
        </div>

        <div className="mt-auto pt-4">
          <div className="flex min-h-14 items-end justify-between gap-3 border-t border-border/50 pt-3.5">
            <div className="min-w-0 space-y-1.5">
              <Skeleton className="h-3 w-10" />
              <Skeleton className="h-6 w-24" />
            </div>
            <Skeleton className="h-11 w-20 shrink-0 rounded-2xl" />
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Streaming fallback for any surface that renders a `PRODUCT_CARD_GRID_CLASS`
 * grid. `count` is the route's page size — never a hand-picked number — so the
 * placeholder grid fills the same rows the resolved grid will.
 */
export function ProductGridSkeleton({
  count,
  className,
}: {
  count: number;
  className?: string;
}) {
  return (
    <div className={cn(PRODUCT_CARD_GRID_CLASS, className)} aria-hidden="true">
      {Array.from({ length: count }).map((_, index) => (
        <ProductCardSkeleton key={index} />
      ))}
    </div>
  );
}
