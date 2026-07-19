import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { Pagination } from "@/lib/api/types";
import { faNum } from "@/lib/products";

import { tagPageHref } from "../routing";

export function TagPagination({
  pagination,
  basePath,
  ariaLabel,
}: {
  pagination: Pagination;
  basePath: string;
  ariaLabel: string;
}) {
  if (pagination.total_pages <= 1) return null;

  return (
    <nav
      aria-label={ariaLabel}
      className="mt-12 flex flex-wrap items-center justify-center gap-3"
    >
      <Button
        variant="outline"
        size="sm"
        disabled={!pagination.has_prev}
        asChild={pagination.has_prev}
      >
        {pagination.has_prev ? (
          <Link href={tagPageHref(basePath, pagination.page - 1)}>
            <ArrowRight className="size-4" aria-hidden /> قبلی
          </Link>
        ) : (
          <span>
            <ArrowRight className="size-4" aria-hidden /> قبلی
          </span>
        )}
      </Button>

      <span className="text-sm text-muted-foreground" aria-current="page">
        صفحهٔ {faNum(pagination.page)} از {faNum(pagination.total_pages)}
      </span>

      <Button
        variant="outline"
        size="sm"
        disabled={!pagination.has_next}
        asChild={pagination.has_next}
      >
        {pagination.has_next ? (
          <Link href={tagPageHref(basePath, pagination.page + 1)}>
            بعدی <ArrowLeft className="size-4" aria-hidden />
          </Link>
        ) : (
          <span>
            بعدی <ArrowLeft className="size-4" aria-hidden />
          </span>
        )}
      </Button>
    </nav>
  );
}
