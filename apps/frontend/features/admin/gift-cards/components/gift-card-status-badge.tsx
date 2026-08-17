import { Badge, type BadgeSemantic } from "@/components/ui/badge";
import { GIFT_CARD_STATUS_FA } from "@/features/gift-cards/labels";
import type { GiftCardStatus } from "@/features/gift-cards/types";

export { GIFT_CARD_STATUS_FA } from "@/features/gift-cards/labels";

const STATUS_VARIANTS: Record<GiftCardStatus, BadgeSemantic> = {
  active: { tone: "success" },
  // Fully spent — an expected end of life, not a win and not a failure.
  redeemed: { tone: "neutral" },
  disabled: { variant: "outline", tone: "neutral" },
};

export function GiftCardStatusBadge({ status }: { status: GiftCardStatus }) {
  return (
    <Badge {...STATUS_VARIANTS[status]}>{GIFT_CARD_STATUS_FA[status]}</Badge>
  );
}
