import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowRight } from "lucide-react"

import { requirePermission } from "@/lib/auth/session"
import { PERMISSIONS } from "@/lib/rbac/permissions"
import { serverApi, ApiError } from "@/lib/api/client"
import type { Brand } from "@/lib/catalog/types"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/dashboard/page-header"
import { BrandForm } from "@/components/admin/brand-form"

export default async function AdminEditBrandPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requirePermission(PERMISSIONS.PRODUCTS_WRITE)
  const { id } = await params

  let brand: Brand
  try {
    brand = await serverApi<Brand>(`/brands/${id}`)
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound()
    throw e
  }

  return (
    <>
      <PageHeader
        title="ویرایش برند"
        description={brand.title}
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link href="/admin/brands">
              <ArrowRight className="size-4" /> بازگشت
            </Link>
          </Button>
        }
      />
      <BrandForm mode="edit" brand={brand} submitLabel="ذخیرهٔ تغییرات" />
    </>
  )
}
