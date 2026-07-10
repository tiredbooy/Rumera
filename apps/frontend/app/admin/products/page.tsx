import { requirePermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { PageHeader } from "@/features/dashboard/components/page-header";
import { ProductForm } from "@/features/admin/products/components/ProductForm";

import { fetchCategories } from "@/features/catalog/categories/api";
import { fetchBrands } from "@/features/catalog/brands/api";
import { fetchTags } from "@/features/catalog/tags/api/public";

export default async function NewProductPage() {
  await requirePermission(PERMISSIONS.PRODUCTS_WRITE);

  const [categoriesResult, brandsResult, tagsResult] = await Promise.allSettled(
    [fetchCategories(), fetchBrands(), fetchTags()],
  );

  const categories =
    categoriesResult.status === "fulfilled"
      ? categoriesResult.value.results
      : [];
  const brands =
    brandsResult.status === "fulfilled" ? brandsResult.value.items : [];
  const tags = tagsResult.status === "fulfilled" ? tagsResult.value : [];

  const lookupFailed =
    categoriesResult.status === "rejected" ||
    brandsResult.status === "rejected" ||
    tagsResult.status === "rejected";

  return (
    <>
      <PageHeader
        title="محصول جدید"
        description="اطلاعات محصول جدید را وارد کنید"
      />

      {lookupFailed ? (
        <p className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-sm text-amber-700">
          بارگذاری برخی فهرست‌ها (دسته‌بندی، برند یا برچسب) با خطا مواجه شد.
          می‌توانید بدون آن‌ها ادامه دهید یا صفحه را دوباره بارگذاری کنید.
        </p>
      ) : null}

      <ProductForm
        mode="create"
        categories={categories}
        brands={brands}
        tags={tags}
      />
    </>
  );
}
