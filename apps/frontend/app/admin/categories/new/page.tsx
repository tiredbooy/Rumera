import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { requirePermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { serverApi } from "@/lib/api/client";
import type { CategoryTreeNode } from "@/lib/api/admin-client";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/features/dashboard/components/page-header";
import { CategoryForm } from "@/features/admin/categories/components/CategoryForm";

/** Category tree for the parent picker. Empty on failure so the form still renders. */
async function loadTree(): Promise<CategoryTreeNode[]> {
  try {
    return (await serverApi<CategoryTreeNode[]>("/categories/tree")) ?? [];
  } catch {
    return [];
  }
}

export default async function AdminNewCategoryPage() {
  await requirePermission(PERMISSIONS.PRODUCTS_WRITE);
  const tree = await loadTree();

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
      <CategoryForm mode="create" tree={tree} submitLabel="افزودن دسته‌بندی" />
    </>
  );
}
