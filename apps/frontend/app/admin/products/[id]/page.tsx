import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";

import { requirePermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiFetch, ApiError } from "@/lib/api/client";
import type { Paginated } from "@/lib/api/types";
import type { Brand } from "@/features/catalog/brands/types";
import type { Category } from "@/features/catalog/categories/types";
import type { ProductDetail } from "@/features/catalog/products/types";
import type { Tag } from "@/features/catalog/tags/types";
import { getProductForAdmin } from "@/features/admin/products/api/server";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/features/dashboard/components/page-header";
import { ProductForm } from "@/features/admin/products/components/ProductForm";

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

export default async function AdminEditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermission(PERMISSIONS.PRODUCTS_READ);
  const { id } = await params;

  let product: ProductDetail;
  try {
    product = await getProductForAdmin(Number(id));
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }

  const { categories, brands, tags } = await loadOptions();

  return (
    <>
      <PageHeader
        title="ویرایش محصول"
        description={product.title}
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link href="/admin/products">
              <ArrowRight className="size-4" /> بازگشت
            </Link>
          </Button>
        }
      />
      <ProductForm
        mode="edit"
        product={product}
        categories={categories}
        brands={brands}
        tags={tags}
      />
    </>
  );
}
