import type { Metadata } from "next";

import { SearchView } from "@/features/storefront/search/components/search-view";
import { buildMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = buildMetadata({
  title: "جستجو",
  path: "/search",
  index: false,
});

export default function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  return <SearchView searchParams={searchParams} />;
}
