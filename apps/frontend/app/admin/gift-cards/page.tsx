import { GiftCardIssuer } from "@/features/admin/gift-cards/components/gift-card-issuer";
import { requireStaff } from "@/lib/auth/session";

export default async function AdminGiftCardsPage() {
  await requireStaff("/admin/gift-cards");
  return <GiftCardIssuer />;
}
