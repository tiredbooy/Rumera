"use client";

import { useSession } from "next-auth/react";
import { Sparkles } from "lucide-react";

import { RecommendationRail } from "@/features/catalog/products/components/recommendation-rail";
import { useForYou } from "@/features/recommendations/hooks";

/**
 * ForYouRail — a personalised strip on the home page. Signed-in shoppers who
 * see products from the interaction/order recommendation engine. Signed-out
 * visitors see nothing, keeping the cacheable home shell free of private data.
 */
export function ForYouRail() {
  const { status } = useSession();
  const authed = status === "authenticated";
  const forYou = useForYou(authed);

  if (!authed) return null;

  const items = forYou.data ?? [];
  if (forYou.isLoading || items.length === 0) return null;

  return (
    <RecommendationRail
      items={items.slice(0, 4)}
      eyebrow="برای شما"
      title="پیشنهادهای ویژهٔ شما"
      icon={Sparkles}
      className="container-px mx-auto max-w-7xl py-12"
    />
  );
}
