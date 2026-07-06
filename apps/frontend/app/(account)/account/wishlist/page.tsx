import { AccountPageHeader } from "@/features/account/account/components/account-page-header";
import { WishlistView } from "@/features/account/wishlist/components/wishlist-view";

export default function AccountWishlistPage() {
  return (
    <>
      <AccountPageHeader
        eyebrow="ذخیره‌شده‌ها"
        title="علاقه‌مندی‌ها"
        description="بطری‌هایی که برای بعد ذخیره کرده‌اید."
      />
      <WishlistView />
    </>
  );
}
