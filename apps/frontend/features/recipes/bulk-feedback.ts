import type {
  BulkAddCartResult,
  SkippedCartItemReason,
} from "@/features/cart/types";
import { faNum } from "@/lib/products";

const SKIP_REASON_LABELS: Record<SkippedCartItemReason, string> = {
  invalid: "درخواست نامعتبر",
  not_found: "محصول پیدا نشد",
  unavailable: "محصول دیگر قابل خرید نیست",
  out_of_stock: "موجودی کافی نیست",
};

export function bulkFeedback(result: BulkAddCartResult) {
  const skippedCount = result.skipped.length;
  const total = result.added + skippedCount;
  const counts = result.skipped.reduce(
    (current, item) => ({
      ...current,
      [item.reason]: current[item.reason] + 1,
    }),
    {
      invalid: 0,
      not_found: 0,
      unavailable: 0,
      out_of_stock: 0,
    } satisfies Record<SkippedCartItemReason, number>,
  );
  const description = (Object.keys(counts) as SkippedCartItemReason[])
    .filter((reason) => counts[reason] > 0)
    .map(
      (reason) =>
        `${faNum(counts[reason])} مورد: ${SKIP_REASON_LABELS[reason]}`,
    )
    .join("، ");

  if (skippedCount === 0) {
    return {
      tone: "success" as const,
      title: `${faNum(result.added)} مورد به سبد خرید افزوده شد`,
    };
  }
  if (result.added === 0) {
    return {
      tone: "error" as const,
      title: "هیچ موردی به سبد خرید افزوده نشد",
      description,
    };
  }
  return {
    tone: "warning" as const,
    title: `${faNum(result.added)} از ${faNum(total)} مورد به سبد خرید افزوده شد`,
    description,
  };
}
