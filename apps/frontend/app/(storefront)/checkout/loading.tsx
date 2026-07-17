import { RouteLoadingRegion } from "@/components/route-state";
import { Skeleton } from "@/components/ui/skeleton";

export default function CheckoutLoading() {
  return (
    <RouteLoadingRegion
      label="در حال آماده‌سازی تسویه حساب"
      className="container-px mx-auto w-full max-w-7xl py-8 pb-28 lg:py-12 lg:pb-12"
    >
      <div aria-hidden="true">
        <div className="space-y-3">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-10 w-64 max-w-full" />
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
          <div className="space-y-6">
            <Skeleton className="h-24 w-full" />
            {Array.from({ length: 3 }).map((_, index) => (
              <div
                key={index}
                className="border-hairline space-y-4 rounded-2xl bg-card/80 p-5 ring-1 ring-foreground/5"
              >
                <Skeleton className="h-6 w-40" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ))}
          </div>
          <div className="border-hairline h-fit space-y-4 rounded-2xl bg-card/80 p-5 ring-1 ring-foreground/5">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-4/5" />
            <Skeleton className="h-px w-full rounded-none" />
            <Skeleton className="h-8 w-2/3" />
            <Skeleton className="h-12 w-full" />
          </div>
        </div>
      </div>
    </RouteLoadingRegion>
  );
}
