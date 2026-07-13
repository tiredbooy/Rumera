import { cn } from "@/lib/utils";

import type { ReviewStatus } from "./types";

const STATUS = {
  pending: {
    label: "در انتظار بازبینی",
    className:
      "bg-amber-500/10 text-amber-600 ring-amber-500/20 dark:text-amber-400",
    dot: "bg-amber-500",
  },
  approved: {
    label: "تأییدشده",
    className:
      "bg-emerald-500/10 text-emerald-600 ring-emerald-500/20 dark:text-emerald-400",
    dot: "bg-emerald-500",
  },
  rejected: {
    label: "ردشده",
    className: "bg-destructive/10 text-destructive ring-destructive/20",
    dot: "bg-destructive",
  },
} satisfies Record<
  ReviewStatus,
  { label: string; className: string; dot: string }
>;

export function ReviewStatusBadge({ status }: { status: ReviewStatus }) {
  const config = STATUS[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        config.className,
      )}
    >
      <span className={cn("size-1.5 rounded-full", config.dot)} aria-hidden />
      {config.label}
    </span>
  );
}
