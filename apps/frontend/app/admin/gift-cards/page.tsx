import { requireGiftCardAdmin } from "@/features/admin/gift-cards/admin-only";
import { GiftCardsBoard } from "@/features/admin/gift-cards/components/gift-cards-board";

export default async function AdminGiftCardsPage() {
  await requireGiftCardAdmin();
  return <GiftCardsBoard />;
}
