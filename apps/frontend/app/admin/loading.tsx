import { RouteLoadingRegion } from "@/components/route-state";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Route-level loading skeleton for the admin console. Mirrors the dashboard's
 * KPI + chart + table rhythm so the shell stays stable while data streams in
 * (no layout shift, motion-safe — `Skeleton` disables its pulse when reduced
 * motion is requested).
 */
export default function AdminLoading() {
  return (
    <RouteLoadingRegion
      as="div"
      label="در حال بارگذاری پنل مدیریت"
      className="animate-in fade-in duration-200 motion-reduce:animate-none"
    >
      <div className="mb-6 flex flex-col gap-2">
        <Skeleton className="h-7 w-44" />
        <Skeleton className="h-4 w-72" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="border-hairline rounded-2xl bg-card p-5 ring-1 ring-foreground/[0.04]"
          >
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="size-8 rounded-lg" />
            </div>
            <Skeleton className="mt-3 h-7 w-28" />
            <Skeleton className="mt-3 h-5 w-16 rounded-md" />
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="border-hairline rounded-2xl bg-card p-5 ring-1 ring-foreground/[0.04] lg:col-span-2">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="mt-4 h-64 w-full" />
        </div>
        <div className="border-hairline rounded-2xl bg-card p-5 ring-1 ring-foreground/[0.04]">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="mx-auto mt-4 size-56 rounded-full" />
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Skeleton className="mb-3 h-6 w-40" />
          <div className="border-hairline overflow-hidden rounded-2xl bg-card ring-1 ring-foreground/[0.04]">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="border-b border-border/40 px-4 py-3 last:border-0"
              >
                <Skeleton className="h-5 w-full" />
              </div>
            ))}
          </div>
        </div>
        <div>
          <Skeleton className="mb-3 h-6 w-40" />
          <div className="border-hairline overflow-hidden rounded-2xl bg-card ring-1 ring-foreground/[0.04]">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="border-b border-border/40 px-4 py-3 last:border-0"
              >
                <Skeleton className="h-5 w-full" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </RouteLoadingRegion>
  );
}
