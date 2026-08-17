import { RouteLoadingRegion } from "@/components/route-state";
import { Skeleton } from "@/components/ui/skeleton";

export default function AdminLoyaltyMemberLoading() {
  return (
    <RouteLoadingRegion
      as="div"
      label="در حال بارگذاری عضو باشگاه"
      className="animate-in fade-in duration-200 motion-reduce:animate-none"
    >
      <div className="mb-6 flex flex-col gap-2">
        <Skeleton className="h-4 w-36" />
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-56" />
      </div>
      <div className="border-hairline rounded-2xl bg-card p-5 ring-1 ring-foreground/[0.04]">
        <div className="flex items-center gap-4">
          <Skeleton className="size-12 rounded-full" />
          <div className="grid flex-1 grid-cols-2 gap-4 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-5 w-20" />
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-6 border-hairline rounded-2xl bg-card p-5 ring-1 ring-foreground/[0.04]">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="mt-4 h-11 w-full" />
      </div>
      <div className="mt-6 space-y-3">
        <Skeleton className="h-5 w-36" />
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    </RouteLoadingRegion>
  );
}