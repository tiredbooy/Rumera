import Link from "next/link"
import { Plus } from "lucide-react"

import { requirePermission } from "@/lib/auth/session"
import { PERMISSIONS } from "@/lib/rbac/permissions"
import { can } from "@/lib/rbac/can"
import { products, faNum } from "@/lib/products"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/dashboard/page-header"
import { ProductsTable } from "@/components/admin/products-table"

export default async function AdminProductsPage() {
  const session = await requirePermission(PERMISSIONS.PRODUCTS_READ)
  const canWrite = can(session, PERMISSIONS.PRODUCTS_WRITE)

  return (
    <>
      <PageHeader
        title="محصولات"
        description={`${faNum(products.length)} محصول در کاتالوگ`}
        actions={
          canWrite ? (
            <Button size="sm" asChild>
              <Link href="/admin/products/new">
                <Plus className="size-4" /> محصول جدید
              </Link>
            </Button>
          ) : null
        }
      />

      <ProductsTable canWrite={canWrite} />
    </>
  )
}
