"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Check, Loader2, ShoppingBag } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useBulkAddCartItems } from "@/features/cart/api";
import { bulkFeedback } from "@/features/recipes/bulk-feedback";
import { stashBulkAddIntent } from "@/features/recipes/pending-bulk-add";
import type { ShoppableProduct } from "@/features/recipes/types";
import { apiErrorToast } from "@/lib/api/user-facing-error";
import { faNum } from "@/lib/products";

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
    const items = available.map((product) => ({
      product_variant_id: product.product_variant_id,
      quantity: 1,
    }));

    if (status !== "authenticated") {
      stashBulkAddIntent(items);
      toast.info("برای افزودن به سبد ابتدا وارد شوید");
      router.push(`/login?callbackUrl=${encodeURIComponent(pathname)}`);
      return;
    }

    bulkAdd.mutate(
      items,
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
        onError: (error) => {
          const t = apiErrorToast(error, "افزودن به سبد ناموفق بود");
          toast.error(t.title, { description: t.description });
        },
      },
    );
  }

  const pending = status === "loading" || bulkAdd.isPending;
  return (
    <Button
      type="button"
      size="lg"
      onClick={onClick}
      disabled={pending}
      aria-label={`افزودن همهٔ مواد (${faNum(available.length)} مورد)`}
      className="h-12 shrink-0 cursor-pointer px-5 text-sm sm:px-6"
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
