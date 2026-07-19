import type { Metadata } from "next";

import { getTag, listAllTags } from "@/features/catalog/tags/api/public";
import { TagDetailView } from "@/features/catalog/tags/components/tag-detail-view";
import {
  parseTagID,
  type TagPageSearchParams,
} from "@/features/catalog/tags/routing";
import { getSafeApiErrorContext } from "@/lib/api/error-semantics";
import { buildMetadata } from "@/lib/seo/metadata";

export async function generateStaticParams() {
  try {
    return (await listAllTags()).map((tag) => ({ id: String(tag.id) }));
  } catch (error) {
    console.error(
      "generateStaticParams: failed to load tag ids",
      getSafeApiErrorContext(error),
    );
    return [];
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id: rawID } = await params;
  const id = parseTagID(rawID);
  if (id === null) {
    return buildMetadata({
      title: "برچسب یافت نشد",
      path: "/tags",
      index: false,
    });
  }

  const tag = await getTag(id);
  if (!tag) {
    return buildMetadata({
      title: "برچسب یافت نشد",
      path: `/tags/${id}`,
      index: false,
    });
  }

  return buildMetadata({
    title: tag.title,
    description:
      tag.description ?? `مشاهدهٔ محصولات منتخب رومرا با برچسب ${tag.title}.`,
    path: `/tags/${id}`,
    keywords: [tag.title],
  });
}

export default function TagPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: TagPageSearchParams;
}) {
  return <TagDetailView params={params} searchParams={searchParams} />;
}
