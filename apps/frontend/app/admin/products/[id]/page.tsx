import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";

import { requirePermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { serverApi, ApiError } from "@/lib/api/client";
import type {
  Brand,
  Category,
  Paginated,
  ProductDetail,
} from "@/lib/catalog/types";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/dashboard/page-header";
import { ProductForm } from "@/features/admin/products/components/ProductForm";

type AdminTag = { id: number; title: string };

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

export default async function AdminEditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermission(PERMISSIONS.PRODUCTS_READ);
  const { id } = await params;

  let product: ProductDetail;
  try {
    product = await serverApi<ProductDetail>(`/products/${id}`);
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
        submitLabel="ذخیرهٔ تغییرات"
      />
    </>
  );
}
