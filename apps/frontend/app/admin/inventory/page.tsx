import { requirePermission } from "@/lib/auth/session"
import { PERMISSIONS } from "@/lib/rbac/permissions"
import { products, categoryFa, faNum } from "@/lib/products"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { PageHeader } from "@/components/dashboard/page-header"

// Deterministic sample stock until /api/v1/inventory is wired.
const stockFor = (i: number) => [42, 8, 0, 120, 5, 64, 17, 3][i] ?? 20

export default async function AdminInventoryPage() {
  await requirePermission(PERMISSIONS.INVENTORY_READ)

  return (
    <>
      <PageHeader title="موجودی" description="پایش موجودی انبار و هشدار کسری." />

      <div className="border-hairline overflow-hidden rounded-2xl bg-card ring-1 ring-foreground/5">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-start">محصول</TableHead>
              <TableHead className="text-start">دسته</TableHead>
              <TableHead className="text-start">موجودی</TableHead>
              <TableHead className="text-start">وضعیت</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.map((product, i) => {
              const stock = stockFor(i)
              const tone = stock === 0 ? "out" : stock <= 10 ? "low" : "ok"
              return (
                <TableRow key={product.id}>
                  <TableCell className="font-medium">{product.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {categoryFa[product.category]}
                  </TableCell>
                  <TableCell className="tabular-nums">{faNum(stock)}</TableCell>
                  <TableCell>
                    {tone === "out" ? (
                      <Badge variant="destructive">ناموجود</Badge>
                    ) : tone === "low" ? (
                      <Badge className="bg-wine text-wine-foreground">رو به اتمام</Badge>
                    ) : (
                      <Badge variant="secondary">موجود</Badge>
                    )}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </>
  )
}
