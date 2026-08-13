/**
 * Sum cart line package weights for shipping quotes (PH-020c).
 * Only positive unit weights count; missing weight contributes 0 (backend
 * CreateOrder re-sums authoritatively from the same catalogue column).
 */
export function packageWeightKg(
  items:
    | Array<{ quantity: number; weight_kg?: number | null }>
    | null
    | undefined,
): number {
  if (!items?.length) return 0;
  let sum = 0;
  for (const item of items) {
    const qty = Number(item.quantity);
    if (!Number.isFinite(qty) || qty <= 0) continue;
    const unit =
      typeof item.weight_kg === "number" &&
      Number.isFinite(item.weight_kg) &&
      item.weight_kg > 0
        ? item.weight_kg
        : 0;
    sum += unit * qty;
  }
  return sum;
}
