import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, SearchX } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export type RouteStateElement = "main" | "section" | "div";

type RouteStateProps = {
  as?: RouteStateElement;
  eyebrow: string;
  title: string;
  description: string;
  icon: ReactNode;
  children?: ReactNode;
  className?: string;
  ariaLive?: "assertive";
};

export function RouteState({
  as: Component = "section",
  eyebrow,
  title,
  description,
  icon,
  children,
  className,
  ariaLive,
}: RouteStateProps) {
  return (
    <Component
      id={Component === "main" ? "main-content" : undefined}
      tabIndex={Component === "main" ? -1 : undefined}
      data-slot="route-state"
      aria-live={ariaLive}
      aria-atomic={ariaLive ? "true" : undefined}
      aria-label={title}
      className={cn(
        "container-px mx-auto flex min-h-[32rem] w-full max-w-7xl items-center justify-center py-14 sm:py-20",
        className,
      )}
    >
      <div className="cellar-glow relative isolate w-full max-w-2xl overflow-hidden rounded-[2rem] border border-border/70 bg-card/85 px-6 py-12 text-center shadow-e2 ring-1 ring-foreground/5 sm:px-12 sm:py-16">
        <div
          className="pointer-events-none absolute inset-0 -z-10"
          aria-hidden="true"
        >
          <span className="absolute -start-16 -top-20 size-56 rounded-full bg-primary/10 blur-3xl" />
          <span className="absolute -bottom-24 -end-12 size-64 rounded-full bg-wine/10 blur-3xl" />
        </div>

        <div className="mx-auto flex max-w-xl flex-col items-center">
          <span className="mb-6 flex size-16 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary shadow-e1">
            {icon}
          </span>
          <p className="eyebrow justify-center">{eyebrow}</p>
          <h1 className="mt-3 text-balance font-serif text-3xl leading-tight sm:text-4xl">
            {title}
          </h1>
          <p className="mt-4 max-w-lg text-pretty leading-8 text-muted-foreground">
            {description}
          </p>
          {children ? (
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              {children}
            </div>
          ) : null}
        </div>
      </div>
    </Component>
  );
}

type RouteStateLinkProps = {
  href: string;
  children: ReactNode;
  variant?: "default" | "outline" | "secondary" | "ghost";
};

export function RouteStateLink({
  href,
  children,
  variant = "default",
}: RouteStateLinkProps) {
  return (
    <Button asChild size="lg" variant={variant} className="h-11 min-w-36 px-5">
      <Link href={href}>
        <ArrowRight aria-hidden="true" />
        {children}
      </Link>
    </Button>
  );
}

type RouteNotFoundProps = {
  as?: RouteStateElement;
  eyebrow?: string;
  title: string;
  description: string;
  primaryHref: string;
  primaryLabel: string;
  secondaryHref?: string;
  secondaryLabel?: string;
  className?: string;
};

export function RouteNotFound({
  as,
  eyebrow = "مسیر پیدا نشد",
  title,
  description,
  primaryHref,
  primaryLabel,
  secondaryHref,
  secondaryLabel,
  className,
}: RouteNotFoundProps) {
  return (
    <RouteState
      as={as}
      eyebrow={eyebrow}
      title={title}
      description={description}
      icon={<SearchX className="size-7" aria-hidden="true" />}
      className={className}
    >
      <RouteStateLink href={primaryHref}>{primaryLabel}</RouteStateLink>
      {secondaryHref && secondaryLabel ? (
        <RouteStateLink href={secondaryHref} variant="outline">
          {secondaryLabel}
        </RouteStateLink>
      ) : null}
    </RouteState>
  );
}

type RouteLoadingRegionProps = {
  as?: RouteStateElement;
  label: string;
  children: ReactNode;
  className?: string;
};

export function RouteLoadingRegion({
  as: Component = "section",
  label,
  children,
  className,
}: RouteLoadingRegionProps) {
  return (
    <>
      <p role="status" className="sr-only">
        {label}
      </p>
      <Component
        id={Component === "main" ? "main-content" : undefined}
        tabIndex={Component === "main" ? -1 : undefined}
        data-slot="route-loading"
        aria-busy="true"
        aria-label={label}
        className={className}
      >
        {children}
      </Component>
    </>
  );
}

type RouteLoadingProps = {
  as?: RouteStateElement;
  label: string;
  variant?: "content" | "dashboard";
  className?: string;
};

export function RouteLoading({
  as,
  label,
  variant = "content",
  className,
}: RouteLoadingProps) {
  return (
    <RouteLoadingRegion
      as={as}
      label={label}
      className={cn(
        "container-px mx-auto w-full max-w-7xl py-12 sm:py-16",
        className,
      )}
    >
      <div className="space-y-8" aria-hidden="true">
        <div className="space-y-3">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-10 w-2/3 max-w-xl" />
          <Skeleton className="h-5 w-full max-w-2xl" />
        </div>

        {variant === "dashboard" ? (
          <>
            <div className="grid gap-4 sm:grid-cols-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <div
                  key={index}
                  className="border-hairline rounded-2xl bg-card p-5 ring-1 ring-foreground/5"
                >
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="mt-4 h-8 w-32" />
                  <Skeleton className="mt-3 h-4 w-20" />
                </div>
              ))}
            </div>
            <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
              <Skeleton className="h-64 w-full" />
              <Skeleton className="h-64 w-full" />
            </div>
          </>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div
                key={index}
                className="border-hairline overflow-hidden rounded-3xl bg-card ring-1 ring-foreground/5"
              >
                <Skeleton className="h-44 w-full rounded-none" />
                <div className="space-y-3 p-5">
                  <Skeleton className="h-5 w-4/5" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-2/3" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </RouteLoadingRegion>
  );
}
