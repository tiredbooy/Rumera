import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { faNum } from "@/lib/products";
import { cn } from "@/lib/utils";

const CONTROL =
  "min-h-11 min-w-11 gap-1.5 px-3";

export function ListPagination({
  page,
  totalPages,
  hasPrev,
  hasNext,
  prevHref,
  nextHref,
  onPrev,
  onNext,
  disabled = false,
  ariaLabel = "صفحه‌بندی",
  label,
  className,
}: {
  page: number;
  totalPages: number;
  hasPrev: boolean;
  hasNext: boolean;
  prevHref?: string;
  nextHref?: string;
  onPrev?: () => void;
  onNext?: () => void;
  disabled?: boolean;
  ariaLabel?: string;
  /** Defaults to «صفحهٔ X از Y». */
  label?: ReactNode;
  className?: string;
}) {
  if (totalPages <= 1) return null;

  const prevDisabled = !hasPrev || disabled;
  const nextDisabled = !hasNext || disabled;
  const count =
    label ?? (
      <>
        صفحهٔ {faNum(page)} از {faNum(totalPages)}
      </>
    );

  return (
    <nav
      aria-label={ariaLabel}
      className={cn("flex flex-wrap items-center justify-center gap-3", className)}
    >
      <PageControl
        disabled={prevDisabled}
        href={!prevDisabled ? prevHref : undefined}
        onClick={!prevDisabled ? onPrev : undefined}
        ariaLabel="صفحهٔ قبلی"
      >
        <ChevronRight className="size-4" aria-hidden />
        قبلی
      </PageControl>
      <span
        className="px-2 text-sm text-muted-foreground"
        aria-current="page"
        aria-live="polite"
      >
        {count}
      </span>
      <PageControl
        disabled={nextDisabled}
        href={!nextDisabled ? nextHref : undefined}
        onClick={!nextDisabled ? onNext : undefined}
        ariaLabel="صفحهٔ بعدی"
      >
        بعدی
        <ChevronLeft className="size-4" aria-hidden />
      </PageControl>
    </nav>
  );
}

function PageControl({
  disabled,
  href,
  onClick,
  ariaLabel,
  children,
}: {
  disabled: boolean;
  href?: string;
  onClick?: () => void;
  ariaLabel: string;
  children: ReactNode;
}) {
  if (!disabled && href) {
    return (
      <Button variant="outline" size="sm" className={CONTROL} asChild>
        <Link href={href} aria-label={ariaLabel}>
          {children}
        </Link>
      </Button>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      className={CONTROL}
      disabled={disabled}
      onClick={onClick}
      aria-label={ariaLabel}
    >
      {children}
    </Button>
  );
}
