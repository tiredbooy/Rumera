import { requireGiftCardAdmin } from "@/features/admin/gift-cards/admin-only";
import { GiftCardIssuer } from "@/features/admin/gift-cards/components/gift-card-issuer";

export default async function AdminNewGiftCardPage() {
  await requireGiftCardAdmin("/admin/gift-cards/new");
  return <GiftCardIssuer />;
}
