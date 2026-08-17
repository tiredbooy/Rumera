import "server-only";

import { notFound } from "next/navigation";

import {
  getProductForAdmin,
  loadProductOptionCatalog,
} from "@/features/admin/products/api/server";
import { fetchLookupList } from "@/features/admin/shared/fetch-lookup-list";
import { PageHeader } from "@/features/dashboard/components/page-header";
import { ApiError } from "@/lib/api/client";
import type { Brand } from "@/features/catalog/brands/types";
import type { Category } from "@/features/catalog/categories/types";
import type { Tag } from "@/features/catalog/tags/types";
import type { AdminProductDetail } from "@/features/admin/products/types";
import { toDuplicateSeed } from "@/features/admin/products/validations";

import { ProductForm } from "./ProductForm";

async function loadProductLookups() {
  const lookups = Promise.all([
    fetchLookupList<Category>("/categories?limit=100"),
    fetchLookupList<Brand>("/brands?limit=100"),
    fetchLookupList<Tag>("/tags?limit=100&sortBy=title&orderBy=asc"),
  ]);
  const [lookedUp, catalog] = await Promise.all([
    lookups,
    loadProductOptionCatalog(),
  ]);
  const [categories, brands, tags] = lookedUp;

  return {
    categories,
    brands,
    tags,
    optionTypes: catalog.optionTypes,
    optionCatalogError: catalog.error,
  };
}

export async function ProductCreateView({ fromId }: { fromId?: string } = {}) {
  const lookups = loadProductLookups();
  const sourceId = Number(fromId);
  const source =
    Number.isInteger(sourceId) && sourceId > 0
      ? await getProductForAdmin(sourceId).catch((error) => {
          if (error instanceof ApiError && error.status === 404) return null;
          throw error;
        })
      : null;
  const { categories, brands, tags, optionTypes, optionCatalogError } =
    await lookups;
  const seed = source ? toDuplicateSeed(source) : undefined;

  return (
    <>
      <PageHeader
        title={source ? "تکثیر محصول" : "محصول جدید"}
        description={
          source
            ? `بر اساس «${source.title}» — نام، شناسه و تصاویر خالی‌اند.`
            : "یک بطری تازه به کاتالوگ اضافه کنید."
        }
      />
      <ProductForm
        mode="create"
        canWrite
        product={seed as AdminProductDetail | undefined}
        categories={categories}
        brands={brands}
        tags={tags}
        optionTypes={optionTypes}
        optionCatalogError={optionCatalogError}
      />
    </>
  );
}

export async function ProductEditView({
  id,
  canWrite,
}: {
  id: string;
  canWrite: boolean;
}) {
  let product: AdminProductDetail;
  try {
    product = await getProductForAdmin(Number(id));
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }

  const { categories, brands, tags, optionTypes, optionCatalogError } =
    await loadProductLookups();

  return (
    <>
      <PageHeader title="ویرایش محصول" description={product.title} />
      <ProductForm
        mode="edit"
        canWrite={canWrite}
        product={product}
        categories={categories}
        brands={brands}
        tags={tags}
        optionTypes={optionTypes}
        optionCatalogError={optionCatalogError}
      />
    </>
  );
}
