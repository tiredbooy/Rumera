import { Ban, CheckCircle2 } from "lucide-react";

import { cn } from "@/lib/utils";

export function UserStatusBadge({
  active,
  banned = false,
}: {
  active: boolean;
  banned?: boolean;
}) {
  const available = active && !banned;
  const Icon = available ? CheckCircle2 : Ban;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        available
          ? "bg-emerald-500/10 text-emerald-600 ring-emerald-500/20 dark:text-emerald-400"
          : banned
            ? "bg-destructive/10 text-destructive ring-destructive/20"
            : "bg-muted text-muted-foreground ring-border/60",
      )}
    >
      <Icon className="size-3.5" aria-hidden />
      {banned ? "مسدود" : active ? "فعال" : "غیرفعال"}
    </span>
  );
}
