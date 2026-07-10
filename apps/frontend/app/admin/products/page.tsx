import { requirePermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { PageHeader } from "@/features/dashboard/components/page-header";
import { ProductForm } from "@/features/admin/products/components/ProductForm";

// ── TODO: confirm these imports ─────────────────────────────────────────
// I don't have your fetch functions for categories/brands/admin-tags yet —
// they weren't in the catalog or admin/products API files you shared, since
// those only cover products/variants/images. Guessed paths below; swap in
// the real ones (or tell me where they live and I'll fix this in one pass).
import { fetchCategories } from "@/features/catalog/categories/api";
import { fetchBrands } from "@/features/catalog/brands/api";
import { fetchAdminTags } from "@/features/admin/tags/api";

export default async function NewProductPage() {
  await requirePermission(PERMISSIONS.PRODUCTS_WRITE);

  // Error-safe like the list page: a failed lookup falls back to an empty
  // list instead of crashing the whole page, but we surface it so an admin
  // doesn't silently get a category-less dropdown.
  const [categoriesResult, brandsResult, tagsResult] = await Promise.allSettled(
    [fetchCategories(), fetchBrands(), fetchAdminTags()],
  );

  const categories =
    categoriesResult.status === "fulfilled" ? categoriesResult.value : [];
  const brands = brandsResult.status === "fulfilled" ? brandsResult.value : [];
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
