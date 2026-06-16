import { Skeleton } from "@/components/ui/skeleton"

/**
 * Route-level loading skeleton for the admin console. Mirrors the dashboard's
 * KPI + chart + table rhythm so the shell stays stable while data streams in
 * (no layout shift, motion-safe — `Skeleton`'s pulse is gated by the global
 * `prefers-reduced-motion` handling).
 */
export default function AdminLoading() {
  return (
    <div className="animate-in fade-in duration-200">
      <div className="mb-7 flex flex-col gap-2">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="border-hairline rounded-2xl bg-card p-5 ring-1 ring-foreground/5">
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="size-9 rounded-xl" />
            </div>
            <Skeleton className="mt-3 h-8 w-28" />
            <Skeleton className="mt-2 h-3 w-20" />
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="border-hairline rounded-2xl bg-card p-5 ring-1 ring-foreground/5 lg:col-span-2">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="mt-4 h-64 w-full" />
        </div>
        <div className="border-hairline rounded-2xl bg-card p-5 ring-1 ring-foreground/5">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="mx-auto mt-4 size-56 rounded-full" />
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="border-hairline rounded-2xl bg-card p-5 ring-1 ring-foreground/5 lg:col-span-2">
          <Skeleton className="mb-4 h-6 w-40" />
          <div className="flex flex-col gap-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        </div>
        <div className="border-hairline rounded-2xl bg-card p-5 ring-1 ring-foreground/5">
          <Skeleton className="mb-4 h-6 w-40" />
          <div className="flex flex-col gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
