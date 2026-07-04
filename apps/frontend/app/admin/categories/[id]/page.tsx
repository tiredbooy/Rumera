import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";

import { requirePermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { serverApi, ApiError } from "@/lib/api/client";
import type { Category } from "@/lib/catalog/types";
import type { CategoryTreeNode } from "@/lib/api/admin-client";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/dashboard/page-header";
import { CategoryForm } from "@/features/admin/categories/components/CategoryForm";

async function loadTree(): Promise<CategoryTreeNode[]> {
  try {
    return (await serverApi<CategoryTreeNode[]>("/categories/tree")) ?? [];
  } catch {
    return [];
  }
}

export default async function AdminEditCategoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermission(PERMISSIONS.PRODUCTS_READ);
  const { id } = await params;

  let category: Category;
  try {
    category = await serverApi<Category>(`/categories/${id}`);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }

  const tree = await loadTree();

  return (
    <>
      <PageHeader
        title="ویرایش دسته‌بندی"
        description={category.name}
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
