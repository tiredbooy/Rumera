import "server-only";

import { notFound } from "next/navigation";

import {
  getProductForAdmin,
  getProductOptionCatalog,
} from "@/features/admin/products/api/server";
import { PageHeader } from "@/features/dashboard/components/page-header";
import { apiFetch, ApiError } from "@/lib/api/client";
import type { Paginated } from "@/lib/api/types";
import type { Brand } from "@/features/catalog/brands/types";
import type { Category } from "@/features/catalog/categories/types";
import type { AdminProductDetail } from "@/features/admin/products/types";

import { ProductForm } from "./ProductForm";

async function fetchList<T>(path: string): Promise<T[]> {
  try {
    return (await apiFetch<Paginated<T>>(path)).results ?? [];
  } catch {
    return [];
  }
}

async function loadProductLookups() {
  const [categories, brands, optionTypes] = await Promise.all([
    fetchList<Category>("/categories?limit=200"),
    fetchList<Brand>("/brands?limit=200"),
    getProductOptionCatalog(),
  ]);

  return { categories, brands, optionTypes };
}

export async function ProductCreateView() {
  const { categories, brands, optionTypes } = await loadProductLookups();

  return (
    <>
      <PageHeader
        title="محصول جدید"
        description="یک بطری تازه به کاتالوگ اضافه کنید."
      />
      <ProductForm
        mode="create"
        categories={categories}
        brands={brands}
        optionTypes={optionTypes}
      />
    </>
  );
}

export async function ProductEditView({ id }: { id: string }) {
  let product: AdminProductDetail;
  try {
    product = await getProductForAdmin(Number(id));
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }

  const { categories, brands, optionTypes } = await loadProductLookups();

  return (
    <>
      <PageHeader title="ویرایش محصول" description={product.title} />
      <ProductForm
        mode="edit"
        product={product}
        categories={categories}
        brands={brands}
        optionTypes={optionTypes}
      />
    </>
  );
}
