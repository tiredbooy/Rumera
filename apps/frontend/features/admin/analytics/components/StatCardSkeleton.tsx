import { Skeleton } from "@/components/ui/skeleton";

export const StatCardSkeleton = () => (
  <div className="rounded-2xl border bg-card p-4 animate-pulse">
    <div className="flex items-start justify-between">
      <div className="space-y-2">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-3 w-16 mt-1" />
      </div>
      <Skeleton className="h-10 w-10 rounded-full" />
    </div>
  </div>
);
