import type { Metadata } from "next";

import {
  JournalListView,
  type JournalListSearchParams,
} from "@/features/journal/components/journal-list-view";
import { buildMetadata } from "@/lib/seo/metadata";

export const revalidate = 3600;

export const metadata: Metadata = buildMetadata({
  title: "ژورنال",
  description:
    "یادداشت‌ها، راهنماها و داستان‌هایی از دنیای نوشیدنی و سبک زندگی — قابل جستجو و خواندنی.",
  path: "/journal",
});

export default function JournalPage({
  searchParams,
}: {
  searchParams: JournalListSearchParams;
}) {
  return <JournalListView searchParams={searchParams} />;
}
