import "server-only";

import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { getProductForAdmin } from "@/features/admin/products/api/server";
import { PageHeader } from "@/features/dashboard/components/page-header";
import { apiFetch, ApiError } from "@/lib/api/client";
import type { Paginated } from "@/lib/api/types";
import type { Brand } from "@/features/catalog/brands/types";
import type { Category } from "@/features/catalog/categories/types";
import type { ProductDetail } from "@/features/catalog/products/types";
import type { Tag } from "@/features/catalog/tags/types";

import { ProductForm } from "./ProductForm";

async function fetchList<T>(path: string): Promise<T[]> {
  try {
    return (await apiFetch<Paginated<T>>(path)).results ?? [];
  } catch {
    return [];
  }
}

async function loadProductOptions() {
  const [categories, brands, tags] = await Promise.all([
    fetchList<Category>("/categories?limit=200"),
    fetchList<Brand>("/brands?limit=200"),
    fetchList<Tag>("/tags?limit=200"),
  ]);

  return { categories, brands, tags };
}

export async function ProductCreateView() {
  const { categories, brands, tags } = await loadProductOptions();

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

export async function ProductEditView({ id }: { id: string }) {
  let product: ProductDetail;
  try {
    product = await getProductForAdmin(Number(id));
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }

  const { categories, brands, tags } = await loadProductOptions();

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
