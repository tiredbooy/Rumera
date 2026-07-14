import type { Metadata } from "next";

import {
  RecipeListView,
  type RecipeListSearchParams,
} from "@/features/recipes/components/recipe-list-view";
import { buildMetadata } from "@/lib/seo/metadata";

export const revalidate = 3600;

export const metadata: Metadata = buildMetadata({
  title: "دستورها و ایده‌ها",
  description:
    "دستورهای کوکتل و ایده‌های میزبانی — قابل جستجو و فیلتر، با محصولات پیشنهادی برای تهیهٔ هر دستور.",
  path: "/recipes",
});

export default function RecipesPage({
  searchParams,
}: {
  searchParams: RecipeListSearchParams;
}) {
  return <RecipeListView searchParams={searchParams} />;
}
