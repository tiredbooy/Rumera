import Link from "next/link"
import { Eye } from "lucide-react"

import { requirePermission } from "@/lib/auth/session"
import { PERMISSIONS } from "@/lib/rbac/permissions"
import { formatPrice, faNum } from "@/lib/products"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { PageHeader } from "@/components/dashboard/page-header"

// Sample rows until GET /api/v1/admin/orders is wired.
const SAMPLE_ORDERS = [
  { id: "1042", customer: "نیلوفر مرادی", total: 18_900_000, status: "در حال پردازش", tone: "default" },
  { id: "1041", customer: "آرش کریمی", total: 8_400_000, status: "ارسال شد", tone: "secondary" },
  { id: "1040", customer: "سارا احمدی", total: 26_600_000, status: "تحویل شد", tone: "secondary" },
  { id: "1039", customer: "بهنام رضایی", total: 4_800_000, status: "لغو شد", tone: "destructive" },
] as const

export default async function AdminOrdersPage() {
  await requirePermission(PERMISSIONS.ORDERS_READ)

  return (
    <>
      <PageHeader title="سفارش‌ها" description="مدیریت و پیگیری سفارش‌های فروشگاه." />

      <div className="border-hairline overflow-hidden rounded-2xl bg-card ring-1 ring-foreground/5">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-start">شماره</TableHead>
              <TableHead className="text-start">مشتری</TableHead>
              <TableHead className="text-start">مبلغ</TableHead>
              <TableHead className="text-start">وضعیت</TableHead>
              <TableHead className="text-end">عملیات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {SAMPLE_ORDERS.map((order) => (
              <TableRow key={order.id}>
                <TableCell className="font-medium">#{faNum(Number(order.id))}</TableCell>
                <TableCell>{order.customer}</TableCell>
                <TableCell className="font-medium">{formatPrice(order.total)}</TableCell>
                <TableCell>
                  <Badge variant={order.tone === "destructive" ? "destructive" : "secondary"}>
                    {order.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-end">
                  <Button variant="ghost" size="icon" asChild aria-label="مشاهده">
                    <Link href={`/admin/orders/${order.id}`}>
                      <Eye className="size-4" />
                    </Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  )
}
