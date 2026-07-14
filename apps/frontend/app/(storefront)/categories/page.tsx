import type { Metadata } from "next";

import { CategoryIndexView } from "@/features/catalog/categories/components/category-index-view";
import { buildMetadata } from "@/lib/seo/metadata";

export const revalidate = 3600;

export const metadata: Metadata = buildMetadata({
  title: "دسته‌بندی‌ها",
  description:
    "فهرست کامل دسته‌بندی‌های رومرا — از ویسکی و شراب تا شامپاین و اسپیریت‌های نایاب. دسته‌ای را برگزینید و مجموعهٔ منتخب آن را مرور کنید.",
  path: "/categories",
});

export default function CategoriesPage() {
  return <CategoryIndexView />;
}
