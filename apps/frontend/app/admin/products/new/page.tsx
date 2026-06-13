import Link from "next/link"
import { ArrowRight } from "lucide-react"

import { requirePermission } from "@/lib/auth/session"
import { PERMISSIONS } from "@/lib/rbac/permissions"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/dashboard/page-header"
import { ProductForm } from "@/components/admin/product-form"

export default async function AdminNewProductPage() {
  await requirePermission(PERMISSIONS.PRODUCTS_WRITE)
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
      <ProductForm submitLabel="افزودن محصول" />
    </>
  )
}
