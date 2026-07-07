import Link from "next/link";
import { Boxes } from "lucide-react";
import { faNum } from "@/lib/products";
import { Button } from "@/components/ui/button";
import { StockBadge } from "@/components/admin/status-badge";
import { getLowStockInventory } from "@/lib/api/admin-client";
import type { AdminInventoryRow } from "@/lib/api/admin-client";

function stockStatus(row: AdminInventoryRow): "out" | "low" {
  return row.available_stock <= 0 ? "out" : "low";
}

export async function LowStockList() {
  const rows = await getLowStockInventory().catch(() => null);

  return (
    <>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-serif text-lg">موجودی رو به اتمام</h2>
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 text-muted-foreground"
          asChild
        >
          <Link href="/admin/inventory">
            <Boxes className="size-4" /> انبار
          </Link>
        </Button>
      </div>
      <div className="border-hairline divide-y divide-border/50 overflow-hidden rounded-2xl bg-card ring-1 ring-foreground/[0.04]">
        {rows === null ? (
          <p className="p-6 text-center text-sm text-destructive">
            خطا در دریافت موجودی
          </p>
        ) : rows.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">
            موجودی همهٔ کالاها سالم است.
          </p>
        ) : (
          rows.map((row) => (
            <div
              key={row.id}
              className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-muted/30"
            >
              <div className="min-w-0 flex-1 leading-tight">
                {/* TODO: no product name in AdminInventoryRow — placeholder until
                    the endpoint joins a name or you have a variant lookup to call. */}
                <p className="truncate text-sm font-medium">
                  متغیر #{faNum(row.product_variant_id)}
                </p>
                <p className="text-xs text-muted-foreground tabular-nums">
                  موجودی قابل فروش: {faNum(row.available_stock)}
                </p>
              </div>
              <StockBadge status={stockStatus(row)} />
            </div>
          ))
        )}
      </div>
    </>
  );
}
