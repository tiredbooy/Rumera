import { RouteLoadingRegion } from "@/components/route-state";
import { Skeleton } from "@/components/ui/skeleton";

export default function JournalDetailLoading() {
  return (
    <RouteLoadingRegion as="div" label="در حال بارگذاری نوشتهٔ ژورنال">
      <div aria-hidden="true">
        <header className="cellar-glow border-b border-border/60">
          <div className="container-px mx-auto flex max-w-3xl flex-col items-center py-14 sm:py-16">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="mt-8 h-12 w-full max-w-2xl sm:h-16" />
            <Skeleton className="mt-5 h-6 w-4/5 max-w-xl" />
            <Skeleton className="mt-7 h-4 w-56" />
          </div>
        </header>

        <div className="container-px mx-auto max-w-4xl pt-12">
          <Skeleton className="aspect-[16/9] w-full rounded-[2rem]" />
        </div>

        <article className="container-px mx-auto max-w-3xl space-y-5 py-14 sm:py-16">
          {Array.from({ length: 7 }).map((_, index) => (
            <Skeleton
              key={index}
              className={index % 3 === 2 ? "h-5 w-4/5" : "h-5 w-full"}
            />
          ))}
        </article>
      </div>
    </RouteLoadingRegion>
  );
}
