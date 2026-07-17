"use client";

import { useEffect } from "react";
import { RotateCcw, TriangleAlert } from "lucide-react";

import {
  RouteState,
  RouteStateLink,
  type RouteStateElement,
} from "@/components/route-state";
import { Button } from "@/components/ui/button";

export type RouteErrorBoundaryProps = {
  error: Error & { digest?: string };
  unstable_retry: () => void;
};

type RouteErrorProps = RouteErrorBoundaryProps & {
  as?: RouteStateElement;
  eyebrow?: string;
  title: string;
  description: string;
  navigationHref: string;
  navigationLabel: string;
  className?: string;
};

export function RouteRetryButton({
  unstable_retry,
}: Pick<RouteErrorBoundaryProps, "unstable_retry">) {
  return (
    <Button
      type="button"
      size="lg"
      className="h-11 min-w-36 cursor-pointer px-5"
      onClick={unstable_retry}
    >
      <RotateCcw aria-hidden="true" />
      تلاش دوباره
    </Button>
  );
}

export function RouteError({
  error,
  unstable_retry,
  as,
  eyebrow = "خطای موقت",
  title,
  description,
  navigationHref,
  navigationLabel,
  className,
}: RouteErrorProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <RouteState
      as={as}
      ariaLive="assertive"
      eyebrow={eyebrow}
      title={title}
      description={description}
      icon={<TriangleAlert className="size-7" aria-hidden="true" />}
      className={className}
    >
      <RouteRetryButton unstable_retry={unstable_retry} />
      <RouteStateLink href={navigationHref} variant="outline">
        {navigationLabel}
      </RouteStateLink>
    </RouteState>
  );
}
