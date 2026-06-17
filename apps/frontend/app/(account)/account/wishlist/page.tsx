import { AccountPageHeader } from "@/components/account/account-page-header"
import { WishlistView } from "@/components/account/wishlist-view"

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
  )
}
