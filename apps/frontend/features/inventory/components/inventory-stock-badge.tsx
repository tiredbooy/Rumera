import type { InventoryStatus } from "../types";

const BADGES: Record<InventoryStatus, { label: string; className: string }> = {
  in_stock: {
    label: "موجود",
    className:
      "bg-emerald-500/10 text-emerald-600 ring-emerald-500/20 dark:text-emerald-400",
  },
  low: {
    label: "رو به اتمام",
    className:
      "bg-amber-500/10 text-amber-600 ring-amber-500/20 dark:text-amber-400",
  },
  out: {
    label: "ناموجود",
    className: "bg-destructive/10 text-destructive ring-destructive/20",
  },
};

export function InventoryStockBadge({ status }: { status: InventoryStatus }) {
  const badge = BADGES[status];

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${badge.className}`}
    >
      <span className="size-1.5 rounded-full bg-current" aria-hidden />
      {badge.label}
    </span>
  );
}
