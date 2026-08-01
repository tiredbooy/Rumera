import "server-only";

import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { getProductForAdmin } from "@/features/admin/products/api/server";
import { listTags } from "@/features/catalog/tags/api/public";
import type { Tag } from "@/features/catalog/tags/types";
import { PageHeader } from "@/features/dashboard/components/page-header";
import {
  getAdminJournalCategory,
  getAdminJournalPost,
  listAdminJournalCategories,
} from "@/features/journal/api/admin";
import type { JournalCategory, JournalDetail } from "@/features/journal/types";
import { ApiError } from "@/lib/api/client";

import { JournalCategoryForm } from "./journal-category-form";
import { JournalForm } from "./journal-form";
import type { JournalProductOption } from "./journal-product-picker";

function BackButton({
  href,
  label = "بازگشت",
}: {
  href: string;
  label?: string;
}) {
  return (
    <Button variant="outline" size="sm" asChild>
      <Link href={href}>
        <ArrowRight className="size-4" /> {label}
      </Link>
    </Button>
  );
}

async function listAllTags(): Promise<Tag[]> {
  const tags: Tag[] = [];
  let page = 1;
  for (;;) {
    const result = await listTags({
      page,
      limit: 100,
      sortBy: "title",
      orderBy: "asc",
    });
    tags.push(...result.results);
    if (!result.pagination.has_next || result.results.length === 0) return tags;
    page += 1;
  }
}

async function loadInitialProducts(
  post: JournalDetail,
): Promise<JournalProductOption[]> {
  const results = await Promise.allSettled(
    Array.from(new Set(post.product_ids)).map((id) => getProductForAdmin(id)),
  );
  return results.flatMap((result) =>
    result.status === "fulfilled"
      ? [{ id: result.value.id, title: result.value.title }]
      : [],
  );
}

async function loadEditorOptions(): Promise<{
  categories: JournalCategory[];
  tags: Tag[];
}> {
  const [categories, tags] = await Promise.all([
    listAdminJournalCategories(),
    listAllTags(),
  ]);
  return { categories, tags };
}

export async function JournalCreateView() {
  const { categories, tags } = await loadEditorOptions();
  return (
    <>
      <PageHeader
        title="نوشتهٔ جدید"
        description="یک راهنما، روایت یا یادداشت تازه را ابتدا امن و قابل بازبینی ذخیره کنید."
        actions={<BackButton href="/admin/journal" />}
      />
      <JournalForm
        mode="create"
        categories={categories}
        tags={tags}
        initialProducts={[]}
      />
    </>
  );
}

export async function JournalEditView({ id }: { id: number }) {
  let post: JournalDetail;
  try {
    post = await getAdminJournalPost(id);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }
  const [{ categories, tags }, initialProducts] = await Promise.all([
    loadEditorOptions(),
    loadInitialProducts(post),
  ]);

  return (
    <>
      <PageHeader
        title="ویرایش نوشته"
        description={post.title}
        actions={<BackButton href="/admin/journal" />}
      />
      <JournalForm
        mode="edit"
        post={post}
        categories={categories}
        tags={tags}
        initialProducts={initialProducts}
      />
    </>
  );
}

export async function JournalCategoryCreateView() {
  const categories = await listAdminJournalCategories();
  return (
    <>
      <PageHeader
        title="دستهٔ جدید ژورنال"
        description="یک موضوع روشن برای سازمان‌دهی نوشته‌های ژورنال بسازید."
        actions={<BackButton href="/admin/journal/categories" />}
      />
      <JournalCategoryForm mode="create" categories={categories} />
    </>
  );
}

export async function JournalCategoryEditView({ id }: { id: number }) {
  let category: JournalCategory;
  try {
    category = await getAdminJournalCategory(id);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }
  const categories = await listAdminJournalCategories();
  return (
    <>
      <PageHeader
        title="ویرایش دستهٔ ژورنال"
        description={category.name}
        actions={<BackButton href="/admin/journal/categories" />}
      />
      <JournalCategoryForm
        mode="edit"
        category={category}
        categories={categories}
      />
    </>
  );
}
