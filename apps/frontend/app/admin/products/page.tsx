import Link from "next/link"
import { Plus, Pencil } from "lucide-react"

import { requirePermission } from "@/lib/auth/session"
import { PERMISSIONS } from "@/lib/rbac/permissions"
import { can } from "@/lib/rbac/can"
import { products, categoryFa, badgeFa, formatPrice, faNum } from "@/lib/products"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Bottle } from "@/components/bottle"
import { PageHeader } from "@/components/dashboard/page-header"

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

      <div className="border-hairline overflow-hidden rounded-2xl bg-card ring-1 ring-foreground/5">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-start">محصول</TableHead>
              <TableHead className="text-start">دسته</TableHead>
              <TableHead className="text-start">قیمت</TableHead>
              <TableHead className="text-start">امتیاز</TableHead>
              <TableHead className="text-start">وضعیت</TableHead>
              <TableHead className="text-end">عملیات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.map((product) => (
              <TableRow key={product.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <span className="flex h-12 w-8 items-end justify-center">
                      <Bottle product={product} className="h-12" />
                    </span>
                    <div className="leading-tight">
                      <p className="font-medium">{product.name}</p>
                      <p className="text-xs text-muted-foreground">{product.maker}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {categoryFa[product.category]}
                </TableCell>
                <TableCell className="font-medium">{formatPrice(product.price)}</TableCell>
                <TableCell className="text-muted-foreground">★ {faNum(product.rating)}</TableCell>
                <TableCell>
                  {product.badge ? (
                    <Badge className="bg-gold text-gold-foreground">{badgeFa[product.badge]}</Badge>
                  ) : (
                    <Badge variant="secondary">موجود</Badge>
                  )}
                </TableCell>
                <TableCell className="text-end">
                  <Button variant="ghost" size="icon" asChild aria-label="ویرایش">
                    <Link href={`/admin/products/${product.slug}`}>
                      <Pencil className="size-4" />
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
