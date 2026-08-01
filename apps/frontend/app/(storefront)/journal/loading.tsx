import { BookOpen } from "lucide-react";

import { RouteLoadingRegion } from "@/components/route-state";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Journal listing skeleton — mirrors the real page's header + featured lead +
 * card grid so navigating in feels instant and there's no layout shift while the
 * (ISR-cached) data resolves.
 */
export default function JournalLoading() {
  return (
    <RouteLoadingRegion as="div" label="در حال بارگذاری ژورنال">
      <div aria-hidden="true">
        {/* Header */}
        <section className="cellar-glow relative overflow-hidden border-b border-border/60">
          <div className="container-px mx-auto max-w-7xl py-16 sm:py-20 lg:py-24">
            <p className="eyebrow mb-4">
              <BookOpen className="size-3.5" aria-hidden /> ژورنال رومرا
            </p>
            <Skeleton className="h-12 w-3/4 max-w-2xl sm:h-16" />
            <Skeleton className="mt-5 h-6 w-full max-w-xl" />
          </div>
        </section>

        <section className="container-px mx-auto max-w-7xl py-12 sm:py-16">
          {/* Featured lead */}
          <div className="border-hairline mb-12 grid overflow-hidden rounded-[1.5rem] bg-card ring-1 ring-foreground/5 sm:mb-16 sm:rounded-[2rem] lg:grid-cols-2">
            <Skeleton className="aspect-[16/10] rounded-none lg:aspect-auto lg:h-full" />
            <div className="flex flex-col justify-center gap-4 p-6 sm:p-10">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-9 w-3/4" />
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-5 w-2/3" />
            </div>
          </div>

          {/* Filter bar */}
          <Skeleton className="h-16 w-full rounded-3xl" />

          {/* Card grid */}
          <div className="mt-8 grid gap-6 sm:grid-cols-2 sm:gap-8 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="border-hairline overflow-hidden rounded-2xl bg-card ring-1 ring-foreground/5 sm:rounded-3xl"
              >
                <Skeleton className="aspect-[16/10] rounded-none" />
                <div className="flex flex-col gap-3 p-5 sm:p-6">
                  <Skeleton className="h-3 w-28" />
                  <Skeleton className="h-6 w-5/6" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-2/3" />
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </RouteLoadingRegion>
  );
}
