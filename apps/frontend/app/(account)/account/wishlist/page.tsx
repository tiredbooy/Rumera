import { PageHeader } from "@/components/dashboard/page-header"
import { WishlistView } from "@/components/account/wishlist-view"

export default function AccountWishlistPage() {
  return (
    <>
      <PageHeader
        title="علاقه‌مندی‌ها"
        description="بطری‌هایی که برای بعد ذخیره کرده‌اید."
      />
      <WishlistView />
    </>
  )
}
