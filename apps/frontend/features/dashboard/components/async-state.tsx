"use client";

import type { LucideIcon } from "lucide-react";
import { AlertTriangle, Loader2, RotateCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { cn } from "@/lib/utils";

/**
 * Shared async states for account + admin dashboards.
 * Keeps loading / error / empty language consistent and retryable.
 */
export function DashboardLoadingState({
  label = "در حال بارگذاری…",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div
      role="status"
      className={cn(
        "flex min-h-40 flex-col items-center justify-center gap-3 rounded-2xl border border-border/60 bg-card/40 px-6 py-12 text-sm text-muted-foreground",
        className,
      )}
    >
      <Loader2 className="size-6 animate-spin text-primary" aria-hidden />
      <p>{label}</p>
    </div>
  );
}

export function DashboardErrorState({
  title = "بارگذاری ناموفق بود",
  description = "اتصال یا سرویس موقتاً در دسترس نیست. می‌توانید دوباره تلاش کنید.",
  onRetry,
  retryLabel = "تلاش مجدد",
  isRetrying = false,
  className,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
  retryLabel?: string;
  isRetrying?: boolean;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "flex min-h-40 flex-col items-center justify-center gap-4 rounded-2xl border border-destructive/25 bg-destructive/5 px-6 py-12 text-center",
        className,
      )}
    >
      <AlertTriangle className="size-8 text-destructive" aria-hidden />
      <div className="max-w-md space-y-1.5">
        <p className="font-medium text-foreground">{title}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {onRetry ? (
        <Button
          type="button"
          variant="outline"
          onClick={onRetry}
          disabled={isRetrying}
          className="min-h-11"
        >
          <RotateCw
            className={cn("size-4", isRetrying && "animate-spin")}
            aria-hidden
          />
          {retryLabel}
        </Button>
      ) : null}
    </div>
  );
}

export function DashboardEmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <EmptyState
      icon={icon}
      title={title}
      description={description}
      className={className}
    >
      {action}
    </EmptyState>
  );
}
