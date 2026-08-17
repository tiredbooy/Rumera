"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2, RotateCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Storefront list/search outage — never reuse the zero-hits empty copy. */
export function CatalogueLoadError({
  title,
  description,
  className,
}: {
  title: string;
  description: string;
  className?: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <div
      role="alert"
      aria-busy={isPending}
      className={cn(
        "border-hairline mx-auto flex max-w-lg flex-col items-center rounded-3xl bg-destructive/5 px-6 py-14 text-center ring-1 ring-destructive/20",
        className,
      )}
    >
      <span className="mb-5 flex size-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
        <AlertTriangle className="size-7" aria-hidden />
      </span>
      <h2 className="font-serif text-2xl">{title}</h2>
      <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
        {description}
      </p>
      <Button
        type="button"
        variant="outline"
        className="mt-6 min-h-11"
        disabled={isPending}
        onClick={() => startTransition(() => router.refresh())}
      >
        {isPending ? (
          <Loader2 className="size-4 animate-spin" aria-hidden />
        ) : (
          <RotateCw className="size-4" aria-hidden />
        )}
        {isPending ? "در حال تلاش…" : "تلاش مجدد"}
      </Button>
    </div>
  );
}
