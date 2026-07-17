import Link from "next/link";
import { Boxes } from "lucide-react";
import { faNum } from "@/lib/products";
import { Button } from "@/components/ui/button";
import { InventoryStockBadge } from "@/features/inventory/components/inventory-stock-badge";
import { fetchLowStockInventory } from "@/features/inventory/api";
import type { InventoryItem } from "@/features/inventory/types";
import { getInventoryStatus } from "@/features/inventory/utils";

import { AnalyticsErrorState } from "./AnalyticsErrorState";

export async function LowStockList() {
  let rows: InventoryItem[] | null = null;
  let error = false;

  try {
    rows = await fetchLowStockInventory();
    // limit to first 10 for display
    if (rows && rows.length > 10) rows = rows.slice(0, 10);
  } catch {
    error = true;
  }

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
        {error ? (
          <AnalyticsErrorState className="p-6">
            خطا در دریافت موجودی
          </AnalyticsErrorState>
        ) : rows === null || rows.length === 0 ? (
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
                <p className="truncate text-sm font-medium">
                  متغیر #{faNum(row.product_variant_id)}
                </p>
                <p className="text-xs text-muted-foreground tabular-nums">
                  موجودی قابل فروش: {faNum(row.available_stock)}
                </p>
              </div>
              <InventoryStockBadge status={getInventoryStatus(row)} />
            </div>
          ))
        )}
      </div>
    </>
  );
}
