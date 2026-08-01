"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function AdminDataErrorState({
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
      className={cn(
        "border-hairline flex flex-col items-center gap-3 rounded-2xl bg-card px-6 py-12 text-center ring-1 ring-foreground/[0.04]",
        className,
      )}
      role="alert"
      aria-busy={isPending}
    >
      <p className="font-serif text-lg">{title}</p>
      <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
        {description}
      </p>
      <Button
        type="button"
        variant="outline"
        size="lg"
        disabled={isPending}
        onClick={() => startTransition(() => router.refresh())}
        className="mt-1 cursor-pointer"
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
