import { Ban, CheckCircle2 } from "lucide-react";

import { cn } from "@/lib/utils";

export function UserStatusBadge({ active }: { active: boolean }) {
  const Icon = active ? CheckCircle2 : Ban;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        active
          ? "bg-emerald-500/10 text-emerald-600 ring-emerald-500/20 dark:text-emerald-400"
          : "bg-muted text-muted-foreground ring-border/60",
      )}
    >
      <Icon className="size-3.5" aria-hidden />
      {active ? "فعال" : "غیرفعال"}
    </span>
  );
}
