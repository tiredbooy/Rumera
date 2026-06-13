import Link from "next/link"
import { Eye } from "lucide-react"

import { requirePermission } from "@/lib/auth/session"
import { PERMISSIONS } from "@/lib/rbac/permissions"
import { ROLE_LABELS, type Role } from "@/lib/rbac/roles"
import { faNum, formatPrice } from "@/lib/products"
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

// Sample rows until GET /api/v1/admin/users is wired.
const SAMPLE_CUSTOMERS: {
  id: string
  name: string
  email: string
  role: Role
  orders: number
  spent: number
}[] = [
  { id: "u1", name: "نیلوفر مرادی", email: "niloofar@example.com", role: "customer", orders: 12, spent: 142_000_000 },
  { id: "u2", name: "آرش کریمی", email: "arash@example.com", role: "customer", orders: 5, spent: 38_400_000 },
  { id: "u3", name: "تیم پشتیبانی", email: "support@rumera.example", role: "support", orders: 0, spent: 0 },
  { id: "u4", name: "مدیر فروشگاه", email: "manager@rumera.example", role: "manager", orders: 0, spent: 0 },
]

export default async function AdminCustomersPage() {
  await requirePermission(PERMISSIONS.CUSTOMERS_READ)

  return (
    <>
      <PageHeader title="مشتریان" description="حساب‌های مشتریان و کارکنان فروشگاه." />

      <div className="border-hairline overflow-hidden rounded-2xl bg-card ring-1 ring-foreground/5">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-start">نام</TableHead>
              <TableHead className="text-start">نقش</TableHead>
              <TableHead className="text-start">سفارش‌ها</TableHead>
              <TableHead className="text-start">مجموع خرید</TableHead>
              <TableHead className="text-end">عملیات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {SAMPLE_CUSTOMERS.map((c) => (
              <TableRow key={c.id}>
                <TableCell>
                  <div className="leading-tight">
                    <p className="font-medium">{c.name}</p>
                    <p className="text-xs text-muted-foreground" dir="ltr">{c.email}</p>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={c.role === "customer" ? "secondary" : "default"}>
                    {ROLE_LABELS[c.role]}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">{faNum(c.orders)}</TableCell>
                <TableCell className="font-medium">{formatPrice(c.spent)}</TableCell>
                <TableCell className="text-end">
                  <Button variant="ghost" size="icon" asChild aria-label="مشاهده">
                    <Link href={`/admin/customers/${c.id}`}>
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
