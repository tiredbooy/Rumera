"use client";

import { useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function AnalyticsErrorState({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <div
      className={cn(
        "flex min-h-24 flex-col items-center justify-center gap-3 text-center text-sm text-destructive",
        className,
      )}
      role="alert"
      aria-busy={isPending}
    >
      <p>{children}</p>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={isPending}
        onClick={() => startTransition(() => router.refresh())}
      >
        {isPending ? (
          <Loader2 className="size-4 animate-spin" aria-hidden />
        ) : (
          <RotateCcw className="size-4" aria-hidden />
        )}
        {isPending ? "در حال تلاش…" : "تلاش دوباره"}
      </Button>
    </div>
  );
}
