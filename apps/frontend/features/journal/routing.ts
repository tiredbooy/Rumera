import type {
  JournalSortDirection,
  JournalSortField,
} from "@/features/journal/types";

export const JOURNAL_PAGE_SIZE = 24;
export const JOURNAL_SEARCH_MAX_LENGTH = 80;

export const JOURNAL_SORT_OPTIONS = [
  {
    value: "new",
    label: "جدیدترین",
    sortBy: "published_at",
    orderBy: "desc",
  },
  {
    value: "popular",
    label: "پربازدیدترین",
    sortBy: "total_reads",
    orderBy: "desc",
  },
] as const satisfies readonly {
  value: string;
  label: string;
  sortBy: JournalSortField;
  orderBy: JournalSortDirection;
}[];

export type JournalSortMode = (typeof JOURNAL_SORT_OPTIONS)[number]["value"];
export type JournalSearchParamValue = string | string[] | undefined;
export type JournalSearchParamsRecord = Record<string, JournalSearchParamValue>;
export type JournalListSearchParams = Promise<JournalSearchParamsRecord>;

export type JournalRouteQuery = {
  page: number;
  q?: string;
  sort: JournalSortMode;
  sortBy: JournalSortField;
  orderBy: JournalSortDirection;
  needsRedirect: boolean;
};

const QUERY_KEYS = new Set(["page", "q", "sort"]);

export function parseJournalPage(
  value: JournalSearchParamValue,
): number | null {
  if (value === undefined) return 1;
  if (typeof value !== "string" || !/^[1-9]\d*$/.test(value)) return null;
  const page = Number(value);
  return Number.isSafeInteger(page) ? page : null;
}

export function parseJournalRouteQuery(
  searchParams: JournalSearchParamsRecord,
): JournalRouteQuery {
  let needsRedirect = Object.entries(searchParams).some(
    ([key, value]) => value !== undefined && !QUERY_KEYS.has(key),
  );

  const parsedPage = parseJournalPage(searchParams.page);
  const page = parsedPage ?? 1;
  if (parsedPage === null || searchParams.page === "1") needsRedirect = true;

  let q: string | undefined;
  const rawQuery = searchParams.q;
  if (rawQuery !== undefined) {
    if (typeof rawQuery !== "string") {
      needsRedirect = true;
    } else {
      const trimmed = rawQuery.trim();
      const bounded = Array.from(trimmed)
        .slice(0, JOURNAL_SEARCH_MAX_LENGTH)
        .join("");
      q = bounded || undefined;
      if (!bounded || rawQuery !== bounded) needsRedirect = true;
    }
  }

  let sort: JournalSortMode = "new";
  const rawSort = searchParams.sort;
  if (rawSort !== undefined) {
    const option =
      typeof rawSort === "string"
        ? JOURNAL_SORT_OPTIONS.find((candidate) => candidate.value === rawSort)
        : undefined;
    if (option) sort = option.value;
    if (!option || sort === "new") needsRedirect = true;
  }

  const sortOption = JOURNAL_SORT_OPTIONS.find(
    (option) => option.value === sort,
  )!;

  return {
    page,
    q,
    sort,
    sortBy: sortOption.sortBy,
    orderBy: sortOption.orderBy,
    needsRedirect,
  };
}

export function journalPageHref(
  query: Pick<JournalRouteQuery, "q" | "sort">,
  page: number,
  hash?: string,
): string {
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  if (query.sort !== "new") params.set("sort", query.sort);
  if (page > 1) params.set("page", String(page));
  const value = params.toString();
  const path = value ? `/journal?${value}` : "/journal";
  return hash ? `${path}#${hash}` : path;
}

export function getJournalSortLabel(sort: JournalSortMode): string {
  return (
    JOURNAL_SORT_OPTIONS.find((option) => option.value === sort)?.label ??
    JOURNAL_SORT_OPTIONS[0].label
  );
}
