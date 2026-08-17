import { Badge, type BadgeSemantic } from "@/components/ui/badge";

import type { InventoryStatus } from "../types";

const BADGES: Record<
  InventoryStatus,
  BadgeSemantic & { label: string }
> = {
  in_stock: { label: "موجود", tone: "success" },
  low: { label: "رو به اتمام", tone: "warning" },
  out: { label: "ناموجود", variant: "destructive" },
};

export function InventoryStockBadge({ status }: { status: InventoryStatus }) {
  const { label, ...semantic } = BADGES[status];

  return (
    <Badge {...semantic} className="gap-1.5 rounded-full">
      <span className="size-1.5 rounded-full bg-current" aria-hidden />
      {label}
    </Badge>
  );
}
