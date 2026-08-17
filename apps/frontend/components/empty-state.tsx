import type { ReactNode } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Shared editorial empty panel — gold medallion, serif title, optional CTA.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  actionHref,
  onAction,
  className,
  children,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
  className?: string;
  children?: ReactNode;
}) {
  const action = actionLabel ? (
    actionHref ? (
      <Button asChild>
        <Link href={actionHref}>{actionLabel}</Link>
      </Button>
    ) : (
      <Button onClick={onAction} className="cursor-pointer">
        {actionLabel}
      </Button>
    )
  ) : null;

  return (
    <div
      className={cn(
        "border-hairline flex flex-col items-center justify-center rounded-2xl border-dashed bg-card/50 px-6 py-16 text-center",
        className,
      )}
    >
      {Icon ? (
        <span className="mb-5 flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/15">
          <Icon className="size-6" />
        </span>
      ) : null}
      <p className="font-serif text-xl leading-tight">{title}</p>
      {description ? (
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-6">{action}</div> : null}
      {children ? <div className="mt-6">{children}</div> : null}
    </div>
  );
}
