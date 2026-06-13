import Link from "next/link"
import { ArrowRight, Package } from "lucide-react"

import { requirePermission } from "@/lib/auth/session"
import { PERMISSIONS } from "@/lib/rbac/permissions"
import { faNum } from "@/lib/products"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/dashboard/page-header"
import { Placeholder } from "@/components/dashboard/placeholder"

export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requirePermission(PERMISSIONS.ORDERS_READ)
  const { id } = await params

  return (
    <>
      <PageHeader
        title={`سفارش #${faNum(Number(id) || 0)}`}
        description="اقلام، پرداخت، مشتری و وضعیت ارسال."
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link href="/admin/orders">
              <ArrowRight className="size-4" /> بازگشت
            </Link>
          </Button>
        }
      />
      <Placeholder
        icon={Package}
        title="جزئیات سفارش در انتظار اتصال به سرویس"
        description="GET /api/v1/admin/orders/{id} — اقلام و امکان تغییر وضعیت/بازپرداخت اینجا قرار می‌گیرد."
      />
    </>
  )
}
