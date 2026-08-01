"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Check, Loader2, ShoppingBag } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useBulkAddCartItems } from "@/features/cart/api";
import type {
  BulkAddCartResult,
  SkippedCartItemReason,
} from "@/features/cart/types";
import type { ShoppableProduct } from "@/features/recipes/types";
import { faNum } from "@/lib/products";

const SKIP_REASON_LABELS: Record<SkippedCartItemReason, string> = {
  invalid: "درخواست نامعتبر",
  not_found: "محصول پیدا نشد",
  unavailable: "محصول دیگر قابل خرید نیست",
  out_of_stock: "موجودی کافی نیست",
};

function bulkFeedback(result: BulkAddCartResult) {
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

export function AddAllIngredientsButton({
  products,
}: {
  products: ShoppableProduct[];
}) {
  const { status } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const bulkAdd = useBulkAddCartItems();
  const [done, setDone] = React.useState(false);
  const available = products.filter((product) => product.is_available);

  if (available.length === 0) return null;

  function onClick() {
    if (status === "loading") return;
    if (status !== "authenticated") {
      toast.info("برای افزودن به سبد ابتدا وارد شوید");
      router.push(`/login?callbackUrl=${encodeURIComponent(pathname)}`);
      return;
    }

    bulkAdd.mutate(
      available.map((product) => ({
        product_variant_id: product.product_variant_id,
        quantity: 1,
      })),
      {
        onSuccess: (result) => {
          const feedback = bulkFeedback(result);
          if (feedback.tone === "success") {
            setDone(true);
            window.setTimeout(() => setDone(false), 1800);
            toast.success(feedback.title, {
              action: {
                label: "مشاهدهٔ سبد",
                onClick: () => router.push("/cart"),
              },
            });
          } else if (feedback.tone === "warning") {
            toast.warning(feedback.title, {
              description: feedback.description,
            });
          } else {
            toast.error(feedback.title, { description: feedback.description });
          }
        },
        onError: () => toast.error("افزودن به سبد ناموفق بود"),
      },
    );
  }

  const pending = status === "loading" || bulkAdd.isPending;
  return (
    <Button
      size="lg"
      onClick={onClick}
      disabled={pending}
      aria-label={`افزودن همهٔ مواد (${faNum(available.length)} مورد)`}
      className="h-12 shrink-0 cursor-pointer px-6 text-sm"
    >
      {pending ? (
        <Loader2 className="animate-spin" aria-hidden="true" />
      ) : done ? (
        <Check aria-hidden="true" />
      ) : (
        <ShoppingBag aria-hidden="true" />
      )}
      {done ? "افزوده شد" : `افزودن همهٔ مواد (${faNum(available.length)})`}
    </Button>
  );
}
