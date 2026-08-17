import { ListPagination } from "@/components/list-pagination";
import type { Pagination } from "@/lib/api/types";

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
  return (
    <ListPagination
      page={pagination.page}
      totalPages={pagination.total_pages}
      hasPrev={pagination.has_prev}
      hasNext={pagination.has_next}
      prevHref={tagPageHref(basePath, pagination.page - 1)}
      nextHref={tagPageHref(basePath, pagination.page + 1)}
      ariaLabel={ariaLabel}
      className="mt-12"
    />
  );
}
