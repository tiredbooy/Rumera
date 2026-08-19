import "server-only";

import { notFound } from "next/navigation";

import {
  getProductForAdmin,
  loadProductOptionCatalog,
} from "@/features/admin/products/api/server";
import { fetchLookupList } from "@/features/admin/shared/fetch-lookup-list";
import { PageHeader } from "@/features/dashboard/components/page-header";
import { ApiError } from "@/lib/api/client";
import { getBrand } from "@/features/catalog/brands/api";
import { getVariantInventory } from "@/features/inventory/api";
import type { InventoryItem } from "@/features/inventory/types";
import { listCategories } from "@/features/catalog/categories/api";
import type { Tag } from "@/features/catalog/tags/types";
import type { AdminProductDetail } from "@/features/admin/products/types";
import { toDuplicateSeed } from "@/features/admin/products/validations";

import { ProductForm } from "./ProductForm";

async function loadProductLookups() {
  const lookups = Promise.all([
    // The whole tree, paged through: `?limit=100` used to make every category
    // past #100 unassignable and render an assigned one as «بدون دسته» (PE-4).
    listCategories(),
    fetchLookupList<Tag>("/tags?limit=100&sortBy=title&orderBy=asc"),
  ]);
  const [lookedUp, catalog] = await Promise.all([
    lookups,
    loadProductOptionCatalog(),
  ]);
  const [categories, tags] = lookedUp;

  return {
    categories,
    tags,
    optionTypes: catalog.optionTypes,
    optionCatalogError: catalog.error,
  };
}

/**
 * Label the product's own brand by id (PE-4). The picker searches the server,
 * so this is only about naming an existing selection — a brand outside page one
 * used to render as «انتخاب برند» over a product that really had it, and the
 * next operator to «fix» that would have overwritten the real value. A brand
 * that cannot be read falls back to «برند ۱۰۱» in the picker, never to blank.
 */
async function loadSelectedBrand(brandId?: number) {
  if (!brandId) return null;
  try {
    const brand = await getBrand(brandId);
    return { id: brand.id, title: brand.title };
  } catch {
    return null;
  }
}

/**
 * Ledger rows for the product's own variants, so stock can be adjusted from
 * the variant grid instead of a trip to /admin/inventory and a SKU search
 * (PE-11).
 *
 * Read-only here: the adjustment itself is a movement posted to the inventory
 * endpoint, never a field of the product aggregate. A variant whose row cannot
 * be read — no `inventory:read`, or a variant with no ledger row yet — simply
 * keeps the read-only cell and its link, so this needs no permission plumbing
 * of its own.
 *
 * ponytail: one read per variant; the inventory API has no batch-by-product
 * endpoint. Fetch in small parallel waves so a 64-variant bottle still gets
 * the stock control PE-11 promised, without a 100-way fan-out.
 */
const VARIANT_INVENTORY_CHUNK = 8;

async function loadVariantInventory(
  variantIds: number[],
): Promise<InventoryItem[]> {
  if (variantIds.length === 0) return [];
  const rows: InventoryItem[] = [];
  for (let i = 0; i < variantIds.length; i += VARIANT_INVENTORY_CHUNK) {
    const chunk = variantIds.slice(i, i + VARIANT_INVENTORY_CHUNK);
    const batch = await Promise.all(
      chunk.map((id) => getVariantInventory(id).catch(() => null)),
    );
    for (const row of batch) {
      if (row) rows.push(row);
    }
  }
  return rows;
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
  const [{ categories, tags, optionTypes, optionCatalogError }, selectedBrand] =
    await Promise.all([lookups, loadSelectedBrand(source?.brand_id)]);
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
        selectedBrand={selectedBrand}
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
  canAdjustStock = false,
}: {
  id: string;
  canWrite: boolean;
  canAdjustStock?: boolean;
}) {
  let product: AdminProductDetail;
  try {
    product = await getProductForAdmin(Number(id));
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }

  const [
    { categories, tags, optionTypes, optionCatalogError },
    selectedBrand,
    inventory,
  ] = await Promise.all([
    loadProductLookups(),
    loadSelectedBrand(product.brand_id),
    loadVariantInventory((product.variants ?? []).map((variant) => variant.id)),
  ]);

  return (
    <>
      <PageHeader title="ویرایش محصول" description={product.title} />
      <ProductForm
        mode="edit"
        canWrite={canWrite}
        canAdjustStock={canAdjustStock}
        product={product}
        inventory={inventory}
        categories={categories}
        selectedBrand={selectedBrand}
        tags={tags}
        optionTypes={optionTypes}
        optionCatalogError={optionCatalogError}
      />
    </>
  );
}
