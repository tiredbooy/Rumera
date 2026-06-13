import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowRight } from "lucide-react"

import { requirePermission } from "@/lib/auth/session"
import { PERMISSIONS } from "@/lib/rbac/permissions"
import { products } from "@/lib/products"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/dashboard/page-header"
import { ProductForm } from "@/components/admin/product-form"

export default async function AdminEditProductPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requirePermission(PERMISSIONS.PRODUCTS_READ)
  const { id } = await params
  const product = products.find((p) => p.slug === id || p.id === id)
  if (!product) notFound()

  return (
    <>
      <PageHeader
        title="ویرایش محصول"
        description={product.name}
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link href="/admin/products">
              <ArrowRight className="size-4" /> بازگشت
            </Link>
          </Button>
        }
      />
      <ProductForm product={product} submitLabel="ذخیرهٔ تغییرات" />
    </>
  )
}
