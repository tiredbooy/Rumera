import { RouteLoadingRegion } from "@/components/route-state";
import { Skeleton } from "@/components/ui/skeleton";

export default function ProductDetailLoading() {
  return (
    <RouteLoadingRegion
      as="div"
      label="در حال بارگذاری جزئیات محصول"
      className="container-px mx-auto w-full max-w-7xl py-10 sm:py-12"
    >
      <div className="space-y-8" aria-hidden="true">
        <Skeleton className="h-4 w-52" />

        <div className="grid gap-10 lg:grid-cols-2 lg:gap-12">
          <div className="space-y-4">
            <Skeleton className="aspect-square w-full rounded-[2rem]" />
            <div className="grid grid-cols-5 gap-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <Skeleton key={index} className="aspect-square rounded-2xl" />
              ))}
            </div>
          </div>

          <div className="space-y-5">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-14 w-4/5" />
            <Skeleton className="h-5 w-32" />
            <div className="space-y-3 py-2">
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-5 w-11/12" />
              <Skeleton className="h-5 w-3/4" />
            </div>
            <div className="rounded-3xl border border-border/60 bg-card/60 p-5 sm:p-6">
              <Skeleton className="h-11 w-2/3" />
              <Skeleton className="mt-5 h-12 w-full" />
              <div className="mt-4 flex gap-3">
                <Skeleton className="h-12 flex-1" />
                <Skeleton className="size-12" />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <Skeleton key={index} className="h-24 rounded-2xl" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </RouteLoadingRegion>
  );
}
