import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { requirePermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiFetch } from "@/lib/api/client";
import type { Paginated } from "@/lib/api/types";
import type { Brand } from "@/features/catalog/brands/types";
import type { Category } from "@/features/catalog/categories/types";
import type { Tag } from "@/features/catalog/tags/types";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/features/dashboard/components/page-header";
import { ProductForm } from "@/features/admin/products/components/ProductForm";

/** Catalogue lookups for the form selects. Empty on failure so the form still renders. */
async function fetchList<T>(path: string): Promise<T[]> {
  try {
    return (await apiFetch<Paginated<T>>(path)).results ?? [];
  } catch {
    return [];
  }
}

async function loadOptions() {
  const [categories, brands, tags] = await Promise.all([
    fetchList<Category>("/categories?limit=200"),
    fetchList<Brand>("/brands?limit=200"),
    fetchList<Tag>("/tags?limit=200"),
  ]);
  return { categories, brands, tags };
}

export default async function AdminNewProductPage() {
  await requirePermission(PERMISSIONS.PRODUCTS_WRITE);
  const { categories, brands, tags } = await loadOptions();

  return (
    <>
      <PageHeader
        title="محصول جدید"
        description="یک بطری تازه به کاتالوگ اضافه کنید."
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link href="/admin/products">
              <ArrowRight className="size-4" /> بازگشت
            </Link>
          </Button>
        }
      />
      <ProductForm
        mode="create"
        categories={categories}
        brands={brands}
        tags={tags}
      />
    </>
  );
}
