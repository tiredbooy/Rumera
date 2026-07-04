import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { requirePermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { serverApi } from "@/lib/api/client";
import type { Brand, Category, Paginated } from "@/lib/catalog/types";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/dashboard/page-header";
import { ProductForm } from "@/features/admin/products/components/ProductForm";

type AdminTag = { id: number; title: string };

/** Catalogue lookups for the form selects. Empty on failure so the form still renders. */
async function fetchList<T>(path: string): Promise<T[]> {
  try {
    return (await serverApi<Paginated<T>>(path)).results ?? [];
  } catch {
    return [];
  }
}

async function loadOptions() {
  const [categories, brands, tags] = await Promise.all([
    fetchList<Category>("/categories?limit=200"),
    fetchList<Brand>("/brands?limit=200"),
    fetchList<AdminTag>("/tags?limit=200"),
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
        submitLabel="افزودن محصول"
      />
    </>
  );
}
