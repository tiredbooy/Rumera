import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

export function StatCardSkeleton({ count = 1 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="border-hairline rounded-2xl bg-card p-5 ring-1 ring-foreground/[0.04]"
        >
          <Skeleton className="h-4 w-20" />
          <Skeleton className="mt-3 h-7 w-28" />
          <Skeleton className="mt-2 h-3 w-16" />
        </div>
      ))}
    </>
  );
}

export function ChartSkeleton({
  className,
  count = 1,
}: {
  className?: string;
  count?: number;
}) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "border-hairline rounded-2xl bg-card p-5 ring-1 ring-foreground/[0.04]",
            className,
          )}
        >
          <Skeleton className="h-4 w-32" />
          <Skeleton className="mt-2 h-3 w-24" />
          <Skeleton className="mt-4 h-56 w-full" />
        </div>
      ))}
    </>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="border-hairline overflow-hidden rounded-2xl bg-card ring-1 ring-foreground/[0.04]">
      <div className="space-y-3 p-4">
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-full" />
        ))}
      </div>
    </div>
  );
}

export function ListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="border-hairline overflow-hidden rounded-2xl bg-card ring-1 ring-foreground/[0.04]">
      <div className="space-y-3 p-4">
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    </div>
  );
}

export function KpiSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCardSkeleton count={4} />
    </div>
  );
}

export function ChartsSkeleton({ count = 2 }: { count?: number }) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <ChartSkeleton count={count} />
    </div>
  );
}
