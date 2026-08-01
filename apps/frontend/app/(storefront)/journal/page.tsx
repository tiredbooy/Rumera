import type { Metadata } from "next";

import {
  JournalListView,
  type JournalListSearchParams,
} from "@/features/journal/components/journal-list-view";
import {
  getJournalSortLabel,
  journalPageHref,
  parseJournalRouteQuery,
} from "@/features/journal/routing";
import { buildMetadata } from "@/lib/seo/metadata";

export const revalidate = 3600;

const description =
  "یادداشت‌ها، راهنماها و داستان‌هایی از دنیای نوشیدنی و سبک زندگی — قابل جستجو و خواندنی.";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: JournalListSearchParams;
}): Promise<Metadata> {
  const query = parseJournalRouteQuery(await searchParams);
  const filtered = Boolean(query.q) || query.sort !== "new";
  const title = query.q
    ? `جستجوی «${query.q}» در ژورنال`
    : query.sort !== "new"
      ? `${getJournalSortLabel(query.sort)} ژورنال`
      : query.page > 1
        ? `ژورنال، صفحهٔ ${query.page.toLocaleString("fa-IR")}`
        : "ژورنال";

  return buildMetadata({
    title,
    description,
    path: filtered ? "/journal" : journalPageHref(query, query.page),
    index: !filtered && !query.needsRedirect,
  });
}

export default function JournalPage({
  searchParams,
}: {
  searchParams: JournalListSearchParams;
}) {
  return <JournalListView searchParams={searchParams} />;
}
