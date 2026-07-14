import "server-only";

import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  getCategory,
  getCategoryTree,
} from "@/features/admin/categories/api";
import type {
  Category,
  CategoryTree,
} from "@/features/catalog/categories/types";
import { PageHeader } from "@/features/dashboard/components/page-header";
import { ApiError } from "@/lib/api/client";

import { CategoryForm } from "./CategoryForm";

async function loadCategoryTree(): Promise<CategoryTree[]> {
  try {
    return await getCategoryTree();
  } catch {
    return [];
  }
}

export async function CategoryCreateView() {
  const tree = await loadCategoryTree();

  return (
    <>
      <PageHeader
        title="دسته‌بندی جدید"
        description="یک دستهٔ تازه برای سازمان‌دهی کاتالوگ بسازید."
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link href="/admin/categories">
              <ArrowRight className="size-4" /> بازگشت
            </Link>
          </Button>
        }
      />
      <CategoryForm
        mode="create"
        tree={tree}
        submitLabel="افزودن دسته‌بندی"
      />
    </>
  );
}

export async function CategoryEditView({ id }: { id: string }) {
  let category: Category;
  try {
    category = await getCategory(id);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }

  const tree = await loadCategoryTree();

  return (
    <>
      <PageHeader
        title="ویرایش دسته‌بندی"
        description={category.title}
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link href="/admin/categories">
              <ArrowRight className="size-4" /> بازگشت
            </Link>
          </Button>
        }
      />
      <CategoryForm
        mode="edit"
        category={category}
        tree={tree}
        submitLabel="ذخیرهٔ تغییرات"
      />
    </>
  );
}
